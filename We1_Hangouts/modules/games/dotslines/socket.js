// modules/games/dotslines/socket.js
const gameLogic = require('./gameLogic');

class DotsLinesSocketManager {
    constructor() {
        this.gameRooms = new Map();
        this.playerStats = new Map();
        this.io = null;
    }

    initialize(io) {
        this.io = io;
        console.log('🔴 Dots and Lines Socket Manager initialized');
    }

    createGameRoom(roomId, gridSize = 'medium') {
        return gameLogic.createGameRoom(roomId, gridSize);
    }

    // Clean room data to prevent circular references
    getCleanRoomData(room) {
        return {
            id: room.id,
            players: room.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                stats: player.stats ? {
                    wins: player.stats.wins || 0,
                    gamesPlayed: player.stats.gamesPlayed || 0,
                    totalBoxes: player.stats.totalBoxes || 0,
                    bestScore: player.stats.bestScore || 0
                } : null,
                joinedAt: player.joinedAt
            })),
            gridSize: room.gridSize,
            dotCount: room.dotCount,
            boxCount: room.boxCount,
            gameStatus: room.gameStatus,
            currentPlayer: room.currentPlayer,
            gameType: room.gameType,
            maxPlayers: room.maxPlayers,
            gameCount: room.gameCount,
            
            // Game board state (clean copies)
            horizontalLines: room.horizontalLines.map(row => 
                row.map(line => ({
                    drawn: line.drawn,
                    playerId: line.playerId,
                    playerName: line.playerName,
                    color: line.color,
                    timestamp: line.timestamp
                }))
            ),
            verticalLines: room.verticalLines.map(row => 
                row.map(line => ({
                    drawn: line.drawn,
                    playerId: line.playerId,
                    playerName: line.playerName,
                    color: line.color,
                    timestamp: line.timestamp
                }))
            ),
            boxes: room.boxes.map(row => 
                row.map(box => ({
                    completed: box.completed,
                    playerId: box.playerId,
                    playerName: box.playerName,
                    color: box.color,
                    timestamp: box.timestamp,
                    completingLine: box.completingLine
                }))
            ),
            
            // Game statistics
            scores: room.scores ? { ...room.scores } : {},
            totalBoxes: room.totalBoxes,
            completedBoxes: room.completedBoxes,
            
            // Turn management
            lastMove: room.lastMove ? {
                playerId: room.lastMove.playerId,
                playerName: room.lastMove.playerName,
                lineType: room.lastMove.lineType,
                row: room.lastMove.row,
                col: room.lastMove.col,
                completedBoxes: room.lastMove.completedBoxes,
                timestamp: room.lastMove.timestamp
            } : null,
            consecutiveTurns: room.consecutiveTurns,
            
            settings: room.settings ? { ...room.settings } : {}
        };
    }

    getOrCreatePlayerStats(playerId, playerName) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, {
                id: playerId,
                name: playerName,
                wins: 0,
                gamesPlayed: 0,
                totalBoxes: 0,
                bestScore: 0,
                averageScore: 0,
                lastActive: new Date()
            });
        }
        return this.playerStats.get(playerId);
    }

    handleJoinRoom(socket, io, roomId, playerName, gridSize = 'medium') {
        console.log(`[DotsLines] Player ${playerName} attempting to join room ${roomId} with grid size ${gridSize}`);
        
        roomId = roomId.toUpperCase();
        socket.join(roomId);
        
        // Create room if it doesn't exist
        if (!this.gameRooms.has(roomId)) {
            console.log(`[DotsLines] Creating new room: ${roomId} with grid size: ${gridSize}`);
            if (!gameLogic.isValidGridSize(gridSize)) {
                gridSize = 'medium'; // Default fallback
            }
            this.gameRooms.set(roomId, this.createGameRoom(roomId, gridSize));
        }
        
        const room = this.gameRooms.get(roomId);
        
        // Check if player is already in the room (reconnection)
        let existingPlayerIndex = room.players.findIndex(p => p.name === playerName);
        
        if (existingPlayerIndex !== -1) {
            // Update existing player's socket ID for reconnection
            room.players[existingPlayerIndex].id = socket.id;
            socket.playerData = { roomId, gameType: 'dotslines', ...room.players[existingPlayerIndex] };
            console.log(`[DotsLines] Player ${playerName} reconnected to room ${roomId}`);
        } else if (room.players.length < room.maxPlayers) {
            // Get or create player stats
            const stats = this.getOrCreatePlayerStats(socket.id, playerName);
            stats.name = playerName;
            
            // Create new player
            const playerColor = gameLogic.PLAYER_COLORS[room.players.length % gameLogic.PLAYER_COLORS.length];
            const player = {
                id: socket.id,
                name: playerName,
                color: playerColor,
                stats: stats,
                joinedAt: new Date()
            };
            
            room.players.push(player);
            socket.playerData = { roomId, gameType: 'dotslines', ...player };
            
            console.log(`[DotsLines] Player ${playerName} joined room ${roomId} as ${playerColor}. Players now: ${room.players.length}/${room.maxPlayers}`);
            
            // Start game if minimum players (2) are present
            if (room.players.length >= 2 && room.gameStatus === 'waiting') {
                room.gameStatus = 'playing';
                room.gameStartTime = Date.now();
                console.log(`[DotsLines] Room ${roomId} game started with ${room.players.length} players`);
            }
        } else {
            // Room is full
            console.log(`[DotsLines] Room ${roomId} is full, rejecting ${playerName}`);
            socket.emit('room-full', { message: 'Room is full! Maximum 8 players allowed.' });
            return;
        }
        
        // Send clean game state to all players
        const cleanRoomData = this.getCleanRoomData(room);
        io.to(roomId).emit('game-state', cleanRoomData);
        
        // Send join notification
        io.to(roomId).emit('player-joined', {
            playerName: playerName,
            playersCount: room.players.length,
            maxPlayers: room.maxPlayers
        });

        // Send room activity
        io.to(roomId).emit('room-activity', {
            icon: '🎯',
            message: `${playerName} joined the Dots and Lines game`
        });
        
        // Send game stats
        this.sendGameStats(roomId, room, io);
        
        console.log(`[DotsLines] Successfully processed join for ${playerName} in room ${roomId}`);
    }

    handleGameEvents(socket, io, socketRegistry) {
        // Handle line drawing
        socket.on('draw-line', (roomId, lineData) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const { lineType, row, col } = lineData;
            
            console.log(`[DotsLines] Player ${socket.playerData.name} drawing ${lineType} line at ${row},${col}`);
            
            // Make the move
            const result = gameLogic.makeMove(room, socket.id, lineType, row, col);
            
            if (!result.success) {
                socket.emit('move-error', { message: result.message });
                return;
            }
            
            console.log(`[DotsLines] Move successful, completed ${result.completedBoxes.length} boxes`);
            
            // Update player stats if boxes were completed
            if (result.completedBoxes.length > 0) {
                this.updatePlayerStats(socket.id, 'boxes', result.completedBoxes.length);
            }
            
            // Send updated game state
            io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            
            // Send move notification
            io.to(roomId).emit('line-drawn', {
                playerName: socket.playerData.name,
                playerId: socket.id,
                lineType: lineType,
                row: row,
                col: col,
                completedBoxes: result.completedBoxes.length,
                newScore: result.newScore,
                consecutiveTurn: result.consecutiveTurn,
                timestamp: new Date()
            });
            
            // Send room activity
            const boxText = result.completedBoxes.length > 0 ? 
                ` and completed ${result.completedBoxes.length} box${result.completedBoxes.length > 1 ? 'es' : ''}` : '';
            
            io.to(roomId).emit('room-activity', {
                icon: '✏️',
                message: `${socket.playerData.name} drew a line${boxText}`
            });
            
            // Handle game finish
            if (result.gameFinished) {
                console.log(`[DotsLines] Game finished in room ${roomId}`);
                
                // Update final stats
                room.players.forEach(player => {
                    const finalScore = room.scores[player.id] || 0;
                    this.updatePlayerStats(player.id, 'game', finalScore, room.gameResults?.winners?.some(w => w.playerId === player.id));
                    player.stats = this.playerStats.get(player.id);
                });
                
                // Send game over event
                io.to(roomId).emit('game-over', {
                    results: room.gameResults,
                    finalScores: room.scores,
                    gameStats: gameLogic.getGameStats(room)
                });
                
                // Send updated stats
                this.sendStatsUpdate(roomId, room, io);
                
                // Auto-restart game after delay
                setTimeout(() => {
                    if (room.players.length >= 2) {
                        this.startNewGame(room, roomId, io);
                    }
                }, 5000);
            }
            
            // Send updated stats
            this.sendGameStats(roomId, room, io);
        });

        // Handle game reset
        socket.on('reset-game', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            // Any player can reset the game
            this.startNewGame(room, roomId, io);
            
            io.to(roomId).emit('room-activity', {
                icon: '🔄',
                message: `${socket.playerData.name} started a new game`
            });
        });

        // Handle spectator mode toggle
        socket.on('toggle-spectator', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isSpectator = !player.isSpectator;
                
                io.to(roomId).emit('player-spectator-toggle', {
                    playerName: player.name,
                    isSpectator: player.isSpectator
                });
                
                io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            }
        });

        // Handle hint request
        socket.on('request-hint', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const currentPlayer = room.players[room.currentPlayer];
            if (currentPlayer.id !== socket.id) return;
            
            // Calculate AI suggestion
            const suggestedMove = gameLogic.calculateAIMove(room);
            
            if (suggestedMove) {
                socket.emit('hint-suggestion', {
                    lineType: suggestedMove.lineType,
                    row: suggestedMove.row,
                    col: suggestedMove.col,
                    reason: 'AI suggested move'
                });
            }
        });

        // Handle reactions
        socket.on('send-reaction', (roomId, reactionData) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            io.to(roomId).emit('show-reaction', reactionData);
        });

        // Handle turn skip (if implemented)
        socket.on('skip-turn', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'dotslines') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const currentPlayer = room.players[room.currentPlayer];
            if (currentPlayer.id !== socket.id) return;
            
            // Move to next player
            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
            room.consecutiveTurns = false;
            
            io.to(roomId).emit('turn-skipped', {
                playerName: currentPlayer.name,
                nextPlayer: room.players[room.currentPlayer].name
            });
            
            io.to(roomId).emit('game-state', this.getCleanRoomData(room));
        });
    }

    startNewGame(room, roomId, io) {
        gameLogic.resetGame(room);
        
        // Update all players with new stats
        room.players.forEach(player => {
            player.stats = this.playerStats.get(player.id);
        });
        
        io.to(roomId).emit('game-reset', {
            gameCount: room.gameCount,
            currentPlayer: room.players[room.currentPlayer]?.name
        });
        
        io.to(roomId).emit('game-state', this.getCleanRoomData(room));
        this.sendGameStats(roomId, room, io);
        
        console.log(`[DotsLines] New game started in room ${roomId}`);
    }

    handleDisconnection(socket, io) {
        if (socket.playerData && socket.playerData.gameType === 'dotslines') {
            const { roomId } = socket.playerData;
            const room = this.gameRooms.get(roomId);
            
            if (room) {
                // Find player index
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                
                // Adjust current player index if necessary
                if (playerIndex !== -1 && playerIndex <= room.currentPlayer && room.currentPlayer > 0) {
                    room.currentPlayer--;
                }
                
                // Remove player from room
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    this.gameRooms.delete(roomId);
                    console.log(`[DotsLines] Deleted empty room: ${roomId}`);
                } else {
                    // Update game status if too few players
                    if (room.players.length < 2) {
                        room.gameStatus = 'waiting';
                    }
                    
                    // Adjust current player if out of bounds
                    if (room.currentPlayer >= room.players.length) {
                        room.currentPlayer = 0;
                    }
                    
                    io.to(roomId).emit('player-left', {
                        playerName: socket.playerData.name,
                        playersCount: room.players.length
                    });
                    
                    io.to(roomId).emit('game-state', this.getCleanRoomData(room));
                    console.log(`[DotsLines] Player left room ${roomId}, now ${room.players.length} players`);
                }
            }
        }
    }

    updatePlayerStats(playerId, type, value, isWin = false) {
        const stats = this.playerStats.get(playerId);
        if (!stats) return;
        
        stats.lastActive = new Date();
        
        switch(type) {
            case 'boxes':
                stats.totalBoxes += value;
                break;
            case 'game':
                stats.gamesPlayed++;
                if (isWin) {
                    stats.wins++;
                }
                if (value > stats.bestScore) {
                    stats.bestScore = value;
                }
                // Calculate average score
                stats.averageScore = stats.totalBoxes / stats.gamesPlayed;
                break;
        }
    }

    sendGameStats(roomId, room, io) {
        const stats = gameLogic.getGameStats(room);
        io.to(roomId).emit('game-stats', stats);
    }

    sendStatsUpdate(roomId, room, io) {
        const cleanStatsData = {
            players: room.players.map(p => ({
                name: p.name,
                color: p.color,
                stats: p.stats ? {
                    wins: p.stats.wins || 0,
                    gamesPlayed: p.stats.gamesPlayed || 0,
                    totalBoxes: p.stats.totalBoxes || 0,
                    bestScore: p.stats.bestScore || 0,
                    averageScore: Math.round(p.stats.averageScore || 0)
                } : null
            }))
        };
        
        io.to(roomId).emit('stats-update', cleanStatsData);
    }
}

module.exports = new DotsLinesSocketManager();