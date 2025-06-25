// modules/games/tictactoe/socket.js - FIXED VERSION
const gameLogic = require('./gameLogic');

class TicTacToeSocketManager {
    constructor() {
        this.gameRooms = new Map();
        this.playerStats = new Map();
        this.io = null;
    }
    
    initialize(io) {
        this.io = io;
        console.log('🎯 Tic-Tac-Toe Socket Manager initialized');
    }

    createGameRoom(roomId) {
        return {
            id: roomId,
            players: [],
            board: Array(9).fill(null),
            currentPlayer: 'X',
            gameStatus: 'waiting', // waiting, playing, finished
            winner: null,
            winningLine: null,
            messages: [],
            gameCount: 0,
            roundHistory: [],
            gameType: 'tictactoe',
            lastMoveTime: Date.now()
        };
    }

    // Check for winner - implementing the missing method
    checkWinner(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];
        
        for (let pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], winningLine: pattern };
            }
        }
        
        if (!board.includes(null)) {
            return { winner: 'tie', winningLine: null };
        }
        
        return null;
    }
    
    handleJoinRoom(socket, io, roomId, playerName) {
        console.log(`[TicTacToe] Player ${playerName} attempting to join room ${roomId}`);
        
        roomId = roomId.toUpperCase();
        socket.join(roomId);
        
        if (!this.gameRooms.has(roomId)) {
            console.log(`[TicTacToe] Creating new room: ${roomId}`);
            this.gameRooms.set(roomId, this.createGameRoom(roomId));
        }
        
        const room = this.gameRooms.get(roomId);
        
        // Check if player is already in the room (reconnection)
        let existingPlayerIndex = room.players.findIndex(p => p.name === playerName);
        
        if (existingPlayerIndex !== -1) {
            // Update existing player's socket ID for reconnection
            room.players[existingPlayerIndex].id = socket.id;
            socket.playerData = { roomId, gameType: 'tictactoe', ...room.players[existingPlayerIndex] };
            console.log(`[TicTacToe] Player ${playerName} reconnected to room ${roomId}`);
        } else if (room.players.length < 2) {
            // Get or create player stats
            const stats = this.getOrCreatePlayerStats(socket.id, playerName);
            stats.name = playerName;
            
            // Add new player
            const playerSymbol = room.players.length === 0 ? 'X' : 'O';
            const player = {
                id: socket.id,
                name: playerName,
                symbol: playerSymbol,
                stats: stats
            };
            
            room.players.push(player);
            socket.playerData = { roomId, gameType: 'tictactoe', ...player };
            
            console.log(`[TicTacToe] Player ${playerName} joined room ${roomId} as ${playerSymbol}. Players now: ${room.players.length}/2`);
            
            // Update game status if room is full
            if (room.players.length === 2) {
                room.gameStatus = 'playing';
                console.log(`[TicTacToe] Room ${roomId} is now full, starting game`);
            }
        } else {
            // Room is full
            console.log(`[TicTacToe] Room ${roomId} is full, rejecting ${playerName}`);
            socket.emit('room-full', { message: 'Room is full' });
            return;
        }
        
        // Send game state to all players in room
        console.log(`[TicTacToe] Sending game state to room ${roomId}:`, {
            players: room.players.map(p => ({ name: p.name, symbol: p.symbol })),
            playersCount: room.players.length,
            gameStatus: room.gameStatus,
            currentPlayer: room.currentPlayer
        });
        
        io.to(roomId).emit('game-state', room);
        io.to(roomId).emit('player-joined', {
            playerName: playerName,
            playersCount: room.players.length
        });

        io.to(roomId).emit('room-activity', {
            icon: '👋',
            message: `${playerName} joined the room`
        });
        
        // Send updated stats
        this.sendStatsUpdate(roomId, room, io);
    }
    
    handleGameEvents(socket, io, socketRegistry) {
        // Handle TicTacToe-specific game events
        socket.on('make-move', (roomId, cellIndex) => {
            // Only handle if this is a TicTacToe room
            if (!socket.playerData || socket.playerData.gameType !== 'tictactoe') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (!player || player.symbol !== room.currentPlayer) return;
            
            if (room.board[cellIndex] !== null) return;
            
            // Make the move
            room.board[cellIndex] = player.symbol;
            
            // Check for winner
            const winResult = this.checkWinner(room.board);
            if (winResult) {
                room.gameStatus = 'finished';
                room.gameCount++;
                room.winner = winResult.winner;
                room.winningLine = winResult.winningLine;
                
                // Update player statistics
                if (winResult.winner === 'tie') {
                    room.players.forEach(p => {
                        this.updatePlayerStats(p.id, 'tie');
                    });
                } else {
                    const winnerPlayer = room.players.find(p => p.symbol === winResult.winner);
                    const loserPlayer = room.players.find(p => p.symbol !== winResult.winner);
                    
                    if (winnerPlayer && loserPlayer) {
                        this.updatePlayerStats(winnerPlayer.id, 'win');
                        this.updatePlayerStats(loserPlayer.id, 'loss');
                    }
                }
                
                // Add to round history
                room.roundHistory.push({
                    gameNumber: room.gameCount,
                    winner: winResult.winner,
                    board: [...room.board],
                    winningLine: winResult.winningLine,
                    timestamp: new Date()
                });
                
                // Update player objects with new stats
                room.players.forEach(p => {
                    p.stats = this.playerStats.get(p.id);
                });
            } else {
                // Switch player
                room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            }
            
            // Send updated game state
            io.to(roomId).emit('game-state', room);
            
            if (winResult) {
                io.to(roomId).emit('game-over', {
                    winner: room.winner,
                    winningLine: room.winningLine,
                    board: room.board,
                    gameCount: room.gameCount,
                    roundHistory: room.roundHistory
                });
                
                this.sendStatsUpdate(roomId, room, io);
                
                // Auto start next game after 3 seconds
                setTimeout(() => {
                    if (room.players.length === 2 && room.gameStatus === 'finished') {
                        this.autoStartNextGame(roomId, io);
                    }
                }, 3000);
            }
            
            // Add activity notification
            io.to(roomId).emit('room-activity', {
                icon: '🎯',
                message: `${player.name} placed ${player.symbol}`
            });
        });

        socket.on('reset-game', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'tictactoe') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            this.startNewRound(room, roomId, io);
        });

        socket.on('send-reaction', (roomId, reactionData) => {
            if (!socket.playerData || socket.playerData.gameType !== 'tictactoe') return;
            io.to(roomId).emit('show-reaction', reactionData);
        });
    }
    
    handleDisconnection(socket, io) {
        if (socket.playerData && socket.playerData.gameType === 'tictactoe') {
            const { roomId } = socket.playerData;
            const room = this.gameRooms.get(roomId);
            
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    this.gameRooms.delete(roomId);
                    console.log(`[TicTacToe] Deleted empty room: ${roomId}`);
                } else {
                    room.gameStatus = 'waiting';
                    io.to(roomId).emit('player-left', {
                        playerName: socket.playerData.name,
                        playersCount: room.players.length
                    });
                    io.to(roomId).emit('game-state', room);
                    console.log(`[TicTacToe] Player left room ${roomId}, now ${room.players.length}/2 players`);
                }
            }
        }
    }
    
    // Helper methods
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
                break;
        }
    }
    
    autoStartNextGame(roomId, io) {
        const room = this.gameRooms.get(roomId);
        if (!room || room.players.length !== 2) return;
        
        this.startNewRound(room, roomId, io);
        
        io.to(roomId).emit('auto-next-game', {
            message: 'Starting next game...',
            gameCount: room.gameCount + 1
        });
    }
    
    startNewRound(room, roomId, io) {
        room.board = Array(9).fill(null);
        room.currentPlayer = 'X';
        room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
        room.winner = null;
        room.winningLine = null;
        
        // Alternate who goes first based on game count
        if (room.gameCount % 2 === 1) {
            room.currentPlayer = 'O';
            const [player1, player2] = room.players;
            player1.symbol = player1.symbol === 'X' ? 'O' : 'X';
            player2.symbol = player2.symbol === 'X' ? 'O' : 'X';
        }
        
        io.to(roomId).emit('game-state', room);
        io.to(roomId).emit('game-reset', {
            gameCount: room.gameCount,
            nextStarter: room.currentPlayer
        });
    }
    
    sendStatsUpdate(roomId, room, io) {
        io.to(roomId).emit('stats-update', {
            players: room.players.map(p => ({
                name: p.name,
                symbol: p.symbol,
                stats: p.stats
            }))
        });
    }
}

module.exports = new TicTacToeSocketManager();