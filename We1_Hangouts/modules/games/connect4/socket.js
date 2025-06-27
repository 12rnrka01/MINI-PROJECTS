// modules/games/connect4/socket.js - FIXED VERSION (Circular Reference Issue)
const gameLogic = require('./gameLogic');

class Connect4SocketManager {
    constructor() {
        this.gameRooms = new Map();
        this.playerStats = new Map();
        this.io = null;
    }

    initialize(io) {
        this.io = io;
        console.log('Connect4 Socket Manager initialized');
    }

    createGameRoom(roomId) {
        return {
            id: roomId,
            players: [],
            board: gameLogic.createBoard(),
            currentPlayer: 'red',
            gameStatus: 'waiting', // waiting, playing, finished
            winner: null,
            winningPositions: [],
            messages: [],
            gameCount: 0,
            roundHistory: [],
            lastMoveTime: Date.now(),
            turnTimer: null,
            turnTimeLimit: 30000, // 30 seconds per turn
            gameType: 'connect4',
            lastMove: null // Store last move for animation
        };
    }

    // CRITICAL FIX: Clean room data to prevent circular references
    getCleanRoomData(room) {
        return {
            id: room.id,
            players: room.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                stats: player.stats ? {
                    wins: player.stats.wins || 0,
                    losses: player.stats.losses || 0,
                    ties: player.stats.ties || 0,
                    totalGames: player.stats.totalGames || 0,
                    currentStreak: player.stats.currentStreak || 0,
                    bestStreak: player.stats.bestStreak || 0
                } : null
            })),
            board: [...room.board], // Create a copy of the board array
            currentPlayer: room.currentPlayer,
            gameStatus: room.gameStatus,
            winner: room.winner,
            winningPositions: room.winningPositions ? [...room.winningPositions] : [],
            gameCount: room.gameCount,
            gameType: room.gameType,
            lastMove: room.lastMove ? {
                column: room.lastMove.column,
                row: room.lastMove.row,
                player: room.lastMove.player,
                timestamp: room.lastMove.timestamp
            } : null
        };
    }

    getOrCreatePlayerStats(playerId, playerName) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, {
                id: playerId,
                name: playerName,
                wins: 0,
                losses: 0,
                ties: 0,
                totalGames: 0,
                currentStreak: 0,
                bestStreak: 0,
                lastActive: new Date()
            });
        }
        return this.playerStats.get(playerId);
    }

    updatePlayerStats(playerId, result) {
        const stats = this.playerStats.get(playerId);
        if (!stats) return;
        
        stats.totalGames++;
        stats.lastActive = new Date();
        
        switch(result) {
            case 'win':
                stats.wins++;
                stats.currentStreak++;
                if (stats.currentStreak > stats.bestStreak) {
                    stats.bestStreak = stats.currentStreak;
                }
                break;
            case 'loss':
                stats.losses++;
                stats.currentStreak = 0;
                break;
            case 'tie':
                stats.ties++;
                // Streak continues on tie
                break;
        }
    }

    startTurnTimer(room) {
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }

        room.turnTimer = setTimeout(() => {
            this.handleTimeOut(room);
        }, room.turnTimeLimit);
    }

    handleTimeOut(room) {
        if (room.gameStatus !== 'playing') return;

        // Switch to other player
        room.currentPlayer = gameLogic.switchPlayer(room.currentPlayer);
        
        this.io.to(room.id).emit('turn-timeout', {
            newCurrentPlayer: room.currentPlayer,
            message: 'Turn timed out!'
        });

        // Send clean game state
        this.io.to(room.id).emit('game-state', this.getCleanRoomData(room));
        this.startTurnTimer(room);
    }

    autoStartNextGame(roomId) {
        const room = this.gameRooms.get(roomId);
        if (!room || room.players.length !== 2) return;
        
        this.startNewRound(room, roomId);
        
        this.io.to(roomId).emit('auto-next-game', {
            message: 'Starting next game...',
            gameCount: room.gameCount + 1
        });
    }

    startNewRound(room, roomId) {
        room.board = gameLogic.createBoard();
        room.currentPlayer = 'red';
        room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
        room.winner = null;
        room.winningPositions = [];
        room.lastMove = null;
        
        // Alternate who goes first based on game count
        if (room.gameCount % 2 === 1) {
            room.currentPlayer = 'yellow';
            const [player1, player2] = room.players;
            player1.color = player1.color === 'red' ? 'yellow' : 'red';
            player2.color = player2.color === 'red' ? 'yellow' : 'red';
        }
        
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }
        
        if (room.gameStatus === 'playing') {
            this.startTurnTimer(room);
        }
        
        // Send clean game state
        this.io.to(roomId).emit('game-state', this.getCleanRoomData(room));
        this.io.to(roomId).emit('game-reset', {
            gameCount: room.gameCount,
            nextStarter: room.currentPlayer
        });
    }

    handleJoinRoom(socket, io, roomId, playerName) {
        console.log(`[Connect4] Player ${playerName} attempting to join room ${roomId}`);
        
        roomId = roomId.toUpperCase();
        socket.join(roomId);
        
        if (!this.gameRooms.has(roomId)) {
            console.log(`[Connect4] Creating new room: ${roomId}`);
            this.gameRooms.set(roomId, this.createGameRoom(roomId));
        }
        
        const room = this.gameRooms.get(roomId);
        console.log(`[Connect4] Room ${roomId} current state:`, {
            playersCount: room.players.length,
            players: room.players.map(p => ({ name: p.name, color: p.color })),
            gameStatus: room.gameStatus
        });
        
        // Check if player is already in the room (reconnection)
        let existingPlayerIndex = room.players.findIndex(p => p.name === playerName);
        
        if (existingPlayerIndex !== -1) {
            // Update existing player's socket ID for reconnection
            room.players[existingPlayerIndex].id = socket.id;
            socket.playerData = { roomId, gameType: 'connect4', ...room.players[existingPlayerIndex] };
            console.log(`[Connect4] Player ${playerName} reconnected to room ${roomId}`);
        } else if (room.players.length < 2) {
            // Get or create player stats
            const stats = this.getOrCreatePlayerStats(socket.id, playerName);
            stats.name = playerName;
            
            // Add new player
            const playerColor = room.players.length === 0 ? 'red' : 'yellow';
            const player = {
                id: socket.id,
                name: playerName,
                color: playerColor,
                stats: stats
            };
            
            room.players.push(player);
            socket.playerData = { roomId, gameType: 'connect4', ...player };
            
            console.log(`[Connect4] Player ${playerName} joined room ${roomId} as ${playerColor}. Players now: ${room.players.length}/2`);
            
            // Update game status if room is full
            if (room.players.length === 2) {
                room.gameStatus = 'playing';
                this.startTurnTimer(room);
                console.log(`[Connect4] Room ${roomId} is now full, starting game`);
            } else {
                room.gameStatus = 'waiting';
                console.log(`[Connect4] Room ${roomId} still waiting for more players`);
            }
        } else {
            // Room is full
            console.log(`[Connect4] Room ${roomId} is full, rejecting ${playerName}`);
            socket.emit('room-full', { message: 'Room is full' });
            return;
        }
        
        // Send CLEAN game state to all players in room
        console.log(`[Connect4] Sending clean game state to room ${roomId}`);
        const cleanRoomData = this.getCleanRoomData(room);
        
        // Emit to all players in the room
        io.to(roomId).emit('game-state', cleanRoomData);
        
        // Send join notification to all players
        io.to(roomId).emit('player-joined', {
            playerName: playerName,
            playersCount: room.players.length
        });

        // Send room activity to all players  
        io.to(roomId).emit('room-activity', {
            icon: '👋',
            message: `${playerName} joined the room`
        });
        
        // Send updated stats to all players
        this.sendStatsUpdate(roomId, room, io);

        console.log(`[Connect4] Successfully processed join for ${playerName} in room ${roomId}`);
    }

    handleGameEvents(socket, io, socketRegistry) {
        // Handle Connect4-specific game events
        socket.on('make-move', (roomId, column) => {
            // Only handle if this is a Connect4 room
            if (!socket.playerData || socket.playerData.gameType !== 'connect4') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (!player || player.color !== room.currentPlayer) return;
            
            // Make the move
            const moveResult = gameLogic.makeMove(room.board, column, player.color);
            if (!moveResult) return; // Invalid move
            
            room.lastMove = {
                column: column,
                row: moveResult.row,
                player: player.color,
                timestamp: Date.now()
            };

            // Clear turn timer
            if (room.turnTimer) {
                clearTimeout(room.turnTimer);
            }
            
            // Check for winner
            const winResult = gameLogic.checkWinner(room.board);
            if (winResult) {
                room.gameStatus = 'finished';
                room.gameCount++;
                room.winner = winResult.winner;
                room.winningPositions = winResult.positions || [];
                
                // Update player statistics
                if (winResult.winner === 'draw') {
                    room.players.forEach(p => {
                        this.updatePlayerStats(p.id, 'tie');
                    });
                } else {
                    const winnerPlayer = room.players.find(p => p.color === winResult.winner);
                    const loserPlayer = room.players.find(p => p.color !== winResult.winner);
                    
                    if (winnerPlayer && loserPlayer) {
                        this.updatePlayerStats(winnerPlayer.id, 'win');
                        this.updatePlayerStats(loserPlayer.id, 'loss');
                    }
                }
                
                // Add to round history - CREATE CLEAN COPY
                room.roundHistory.push({
                    gameNumber: room.gameCount,
                    winner: room.winner,
                    board: [...room.board], // Clean copy
                    winningPositions: [...(room.winningPositions || [])], // Clean copy
                    timestamp: new Date()
                });
                
                // Update player objects with new stats
                room.players.forEach(p => {
                    p.stats = this.playerStats.get(p.id);
                });
            } else {
                // Switch player
                room.currentPlayer = gameLogic.switchPlayer(room.currentPlayer);
                this.startTurnTimer(room);
            }
            
            // Send CLEAN updated game state
            io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            
            if (winResult) {
                // Send CLEAN game over data
                io.to(roomId).emit('game-over', {
                    winner: room.winner,
                    winningPositions: [...(room.winningPositions || [])],
                    board: [...room.board],
                    gameCount: room.gameCount,
                    roundHistory: room.roundHistory.map(game => ({
                        gameNumber: game.gameNumber,
                        winner: game.winner,
                        board: [...game.board],
                        winningPositions: [...(game.winningPositions || [])],
                        timestamp: game.timestamp
                    }))
                });
                
                // Send updated stats
                this.sendStatsUpdate(roomId, room, io);
                
                // Auto start next game after 3 seconds
                setTimeout(() => {
                    if (room.players.length === 2 && room.gameStatus === 'finished') {
                        this.autoStartNextGame(roomId);
                    }
                }, 3000);
            }
            
            // Add activity notification
            io.to(roomId).emit('room-activity', {
                icon: '🔴',
                message: `${player.name} dropped ${player.color} disc in column ${column + 1}`
            });
        });

        socket.on('reset-game', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'connect4') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            this.startNewRound(room, roomId);
        });

        socket.on('next-game', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'connect4') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            this.startNewRound(room, roomId);
        });

        socket.on('send-reaction', (roomId, reactionData) => {
            if (!socket.playerData || socket.playerData.gameType !== 'connect4') return;
            io.to(roomId).emit('show-reaction', reactionData);
        });

    }

    sendStatsUpdate(roomId, room, io) {
        // Send CLEAN stats data
        const cleanStatsData = {
            players: room.players.map(p => ({
                name: p.name,
                color: p.color,
                stats: p.stats ? {
                    wins: p.stats.wins || 0,
                    losses: p.stats.losses || 0,
                    ties: p.stats.ties || 0,
                    totalGames: p.stats.totalGames || 0,
                    currentStreak: p.stats.currentStreak || 0,
                    bestStreak: p.stats.bestStreak || 0
                } : null
            }))
        };
        
        io.to(roomId).emit('stats-update', cleanStatsData);
    }

    handleDisconnection(socket, io) {
        if (socket.playerData && socket.playerData.gameType === 'connect4') {
            const { roomId } = socket.playerData;
            const room = this.gameRooms.get(roomId);
            
            if (room) {
                // Clear turn timer
                if (room.turnTimer) {
                    clearTimeout(room.turnTimer);
                }
                
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    this.gameRooms.delete(roomId);
                    console.log(`[Connect4] Deleted empty room: ${roomId}`);
                } else {
                    room.gameStatus = 'waiting';
                    io.to(roomId).emit('player-left', {
                        playerName: socket.playerData.name,
                        playersCount: room.players.length
                    });
                    // Send clean game state
                    io.to(roomId).emit('game-state', this.getCleanRoomData(room));
                    console.log(`[Connect4] Player left room ${roomId}, now ${room.players.length}/2 players`);
                }
            }
        }
    }
}

module.exports = new Connect4SocketManager();