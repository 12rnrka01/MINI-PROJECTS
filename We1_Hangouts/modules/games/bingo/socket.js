// modules/games/bingo/socket.js
const gameLogic = require('./gameLogic');

class BingoSocketManager {
    constructor() {
        this.gameRooms = new Map();
        this.playerStats = new Map();
        this.io = null;
    }

    initialize(io) {
        this.io = io;
        console.log('🎯 BINGO Socket Manager initialized');
    }

    createGameRoom(roomId, boardSize = 'medium') {
        return gameLogic.createGameRoom(roomId, boardSize);
    }

    // Clean room data to prevent circular references
    getCleanRoomData(room) {
        return {
            id: room.id,
            players: room.players.map(player => ({
                id: player.id,
                name: player.name,
                board: player.board.map(cell => ({
                    number: cell.number,
                    marked: cell.marked,
                    markedBy: cell.markedBy,
                    timestamp: cell.timestamp
                })),
                hasWon: player.hasWon || false,
                winTime: player.winTime,
                stats: player.stats ? {
                    wins: player.stats.wins || 0,
                    gamesPlayed: player.stats.gamesPlayed || 0
                } : null,
                joinedAt: player.joinedAt
            })),
            boardSize: room.boardSize,
            gridSize: room.gridSize,
            numberRange: room.numberRange,
            gameStatus: room.gameStatus,
            calledNumbers: [...room.calledNumbers],
            lastCalledNumber: room.lastCalledNumber ? {
                number: room.lastCalledNumber.number,
                calledBy: room.lastCalledNumber.calledBy,
                timestamp: room.lastCalledNumber.timestamp
            } : null,
            currentCaller: room.currentCaller,
            gameType: room.gameType,
            maxPlayers: room.maxPlayers,
            gameCount: room.gameCount,
            winners: room.winners ? [...room.winners] : [],
            autoCallEnabled: room.autoCallEnabled,
            settings: room.settings
        };
    }

    getOrCreatePlayerStats(playerId, playerName) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, {
                id: playerId,
                name: playerName,
                wins: 0,
                gamesPlayed: 0,
                totalNumbersMarked: 0,
                fastestWin: null,
                lastActive: new Date()
            });
        }
        return this.playerStats.get(playerId);
    }

    handleJoinRoom(socket, io, roomId, playerName, boardSize = 'medium') {
        console.log(`[BINGO] Player ${playerName} attempting to join room ${roomId} with board size ${boardSize}`);
        
        roomId = roomId.toUpperCase();
        socket.join(roomId);
        
        // Create room if it doesn't exist
        if (!this.gameRooms.has(roomId)) {
            console.log(`[BINGO] Creating new room: ${roomId} with board size: ${boardSize}`);
            if (!gameLogic.isValidBoardSize(boardSize)) {
                boardSize = 'medium'; // Default fallback
            }
            this.gameRooms.set(roomId, this.createGameRoom(roomId, boardSize));
        }
        
        const room = this.gameRooms.get(roomId);
        
        // Check if player is already in the room (reconnection)
        let existingPlayerIndex = room.players.findIndex(p => p.name === playerName);
        
        if (existingPlayerIndex !== -1) {
            // Update existing player's socket ID for reconnection
            room.players[existingPlayerIndex].id = socket.id;
            socket.playerData = { roomId, gameType: 'bingo', ...room.players[existingPlayerIndex] };
            console.log(`[BINGO] Player ${playerName} reconnected to room ${roomId}`);
        } else if (room.players.length < room.maxPlayers) {
            // Get or create player stats
            const stats = this.getOrCreatePlayerStats(socket.id, playerName);
            stats.name = playerName;
            
            // Create new player with generated BINGO board
            const player = {
                id: socket.id,
                name: playerName,
                board: gameLogic.generatePlayerBoard(room.boardSize),
                hasWon: false,
                winTime: null,
                stats: stats,
                joinedAt: new Date()
            };
            
            room.players.push(player);
            socket.playerData = { roomId, gameType: 'bingo', ...player };
            
            console.log(`[BINGO] Player ${playerName} joined room ${roomId}. Players now: ${room.players.length}/${room.maxPlayers}`);
            
            // Set first player as caller if no caller exists
            if (!room.currentCaller && room.players.length === 1) {
                room.currentCaller = socket.id;
                console.log(`[BINGO] ${playerName} is now the caller`);
            }
            
            // Start game if minimum players (2) are present
            if (room.players.length >= 2 && room.gameStatus === 'waiting') {
                room.gameStatus = 'playing';
                console.log(`[BINGO] Room ${roomId} game started with ${room.players.length} players`);
            }
        } else {
            // Room is full
            console.log(`[BINGO] Room ${roomId} is full, rejecting ${playerName}`);
            socket.emit('room-full', { message: 'Room is full! Maximum 100 players allowed.' });
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
            icon: '👋',
            message: `${playerName} joined the BINGO game`
        });
        
        // Send game stats
        this.sendGameStats(roomId, room, io);
        
        console.log(`[BINGO] Successfully processed join for ${playerName} in room ${roomId}`);
    }

    handleGameEvents(socket, io, socketRegistry) {
        // Handle number calling
        socket.on('call-number', (roomId, number) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            // Only the current caller can call numbers
            if (room.currentCaller !== socket.id) {
                socket.emit('error', { message: 'Only the current caller can call numbers!' });
                return;
            }
            
            // Validate number
            if (!gameLogic.isValidNumber(number, room.boardSize)) {
                socket.emit('error', { message: 'Invalid number for this board size!' });
                return;
            }
            
            // Call the number
            const result = gameLogic.callNumber(room, number, socket.id);
            
            if (!result.success) {
                socket.emit('error', { message: result.message });
                return;
            }
            
            console.log(`[BINGO] Number ${number} called by ${socket.playerData.name} in room ${roomId}`);
            
            // Check for winners after number call
            const winners = gameLogic.checkWinners(room);
            if (winners.length > 0) {
                room.winners = [...room.winners, ...winners];
                
                // Update winner stats
                winners.forEach(winner => {
                    const player = room.players.find(p => p.id === winner.playerId);
                    if (player) {
                        this.updatePlayerStats(player.id, 'win');
                        player.stats = this.playerStats.get(player.id);
                    }
                });
                
                console.log(`[BINGO] Winners found in room ${roomId}:`, winners.map(w => w.playerName));
                
                // Announce winners
                io.to(roomId).emit('bingo-winners', {
                    winners: winners,
                    totalWinners: room.winners.length
                });
                
                // Check if game should end (full house winner or multiple winners)
                if (winners.some(w => w.winType === 'fullHouse') || room.winners.length >= 3) {
                    room.gameStatus = 'finished';
                    console.log(`[BINGO] Game finished in room ${roomId}`);
                }
            }
            
            // Send updated game state
            io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            
            // Send number called event
            io.to(roomId).emit('number-called', {
                number: number,
                calledBy: socket.playerData.name,
                markedPlayers: result.markedPlayers,
                totalCalled: result.totalCalled,
                timestamp: new Date()
            });
            
            // Send room activity
            io.to(roomId).emit('room-activity', {
                icon: '🎯',
                message: `${socket.playerData.name} called number ${number}`
            });
            
            // Send updated stats
            this.sendGameStats(roomId, room, io);
        });

        // Handle auto-call toggle
        socket.on('toggle-auto-call', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            // Only caller can toggle auto-call
            if (room.currentCaller !== socket.id) return;
            
            room.autoCallEnabled = !room.autoCallEnabled;
            
            if (room.autoCallEnabled) {
                this.startAutoCall(room, io);
            } else {
                this.stopAutoCall(room);
            }
            
            io.to(roomId).emit('auto-call-toggled', {
                enabled: room.autoCallEnabled,
                toggledBy: socket.playerData.name
            });
        });

        // Handle manual number selection
        socket.on('select-number', (roomId, number) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            // Only caller can select numbers
            if (room.currentCaller !== socket.id) return;
            
            // Use the call-number logic
            socket.emit('call-number', roomId, number);
        });

        // Handle caller change
        socket.on('request-caller', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            // Change caller if current caller allows or is disconnected
            const currentCaller = room.players.find(p => p.id === room.currentCaller);
            if (!currentCaller) {
                room.currentCaller = socket.id;
                
                io.to(roomId).emit('caller-changed', {
                    newCaller: socket.playerData.name,
                    callerId: socket.id
                });
                
                io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            }
        });

        // Handle game reset
        socket.on('reset-game', (roomId) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            
            roomId = roomId.toUpperCase();
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            
            // Only caller can reset
            if (room.currentCaller !== socket.id) return;
            
            gameLogic.resetGame(room);
            room.gameStatus = room.players.length >= 2 ? 'playing' : 'waiting';
            
            // Update all players with new boards
            room.players.forEach(player => {
                player.stats = this.playerStats.get(player.id);
            });
            
            io.to(roomId).emit('game-reset', {
                resetBy: socket.playerData.name,
                gameCount: room.gameCount
            });
            
            io.to(roomId).emit('game-state', this.getCleanRoomData(room));
            this.sendGameStats(roomId, room, io);
        });

        // Handle reactions
        socket.on('send-reaction', (roomId, reactionData) => {
            if (!socket.playerData || socket.playerData.gameType !== 'bingo') return;
            io.to(roomId).emit('show-reaction', reactionData);
        });
    }

    startAutoCall(room, io) {
        if (room.autoCallInterval) {
            clearInterval(room.autoCallInterval);
        }
        
        room.autoCallInterval = setInterval(() => {
            if (!room.autoCallEnabled || room.gameStatus !== 'playing') {
                this.stopAutoCall(room);
                return;
            }
            
            const nextNumber = gameLogic.getNextNumber(room);
            if (nextNumber) {
                // Simulate caller calling the number
                const result = gameLogic.callNumber(room, nextNumber, room.currentCaller);
                
                if (result.success) {
                    // Check for winners
                    const winners = gameLogic.checkWinners(room);
                    if (winners.length > 0) {
                        room.winners = [...room.winners, ...winners];
                        
                        io.to(room.id).emit('bingo-winners', {
                            winners: winners,
                            totalWinners: room.winners.length
                        });
                        
                        if (winners.some(w => w.winType === 'fullHouse')) {
                            room.gameStatus = 'finished';
                            this.stopAutoCall(room);
                        }
                    }
                    
                    // Broadcast the auto-called number
                    io.to(room.id).emit('number-called', {
                        number: nextNumber,
                        calledBy: 'Auto-Caller',
                        markedPlayers: result.markedPlayers,
                        totalCalled: result.totalCalled,
                        timestamp: new Date(),
                        isAuto: true
                    });
                    
                    io.to(room.id).emit('game-state', this.getCleanRoomData(room));
                }
            } else {
                // No more numbers to call
                room.gameStatus = 'finished';
                this.stopAutoCall(room);
                io.to(room.id).emit('game-finished', { reason: 'All numbers called' });
            }
        }, room.settings.autoCallDelay);
    }

    stopAutoCall(room) {
        if (room.autoCallInterval) {
            clearInterval(room.autoCallInterval);
            room.autoCallInterval = null;
        }
        room.autoCallEnabled = false;
    }

    handleDisconnection(socket, io) {
        if (socket.playerData && socket.playerData.gameType === 'bingo') {
            const { roomId } = socket.playerData;
            const room = this.gameRooms.get(roomId);
            
            if (room) {
                // Stop auto-call if disconnecting player was the caller
                if (room.currentCaller === socket.id) {
                    this.stopAutoCall(room);
                    
                    // Assign new caller if players remain
                    if (room.players.length > 1) {
                        const remainingPlayers = room.players.filter(p => p.id !== socket.id);
                        if (remainingPlayers.length > 0) {
                            room.currentCaller = remainingPlayers[0].id;
                            
                            io.to(roomId).emit('caller-changed', {
                                newCaller: remainingPlayers[0].name,
                                callerId: remainingPlayers[0].id,
                                reason: 'Previous caller disconnected'
                            });
                        }
                    }
                }
                
                // Remove player from room
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    this.gameRooms.delete(roomId);
                    console.log(`[BINGO] Deleted empty room: ${roomId}`);
                } else {
                    // Update game status if too few players
                    if (room.players.length < 2) {
                        room.gameStatus = 'waiting';
                    }
                    
                    io.to(roomId).emit('player-left', {
                        playerName: socket.playerData.name,
                        playersCount: room.players.length
                    });
                    
                    io.to(roomId).emit('game-state', this.getCleanRoomData(room));
                    console.log(`[BINGO] Player left room ${roomId}, now ${room.players.length} players`);
                }
            }
        }
    }

    updatePlayerStats(playerId, result) {
        const stats = this.playerStats.get(playerId);
        if (!stats) return;
        
        stats.gamesPlayed++;
        stats.lastActive = new Date();
        
        if (result === 'win') {
            stats.wins++;
        }
    }

    sendGameStats(roomId, room, io) {
        const stats = gameLogic.getGameStats(room);
        io.to(roomId).emit('game-stats', stats);
    }
}

module.exports = new BingoSocketManager();