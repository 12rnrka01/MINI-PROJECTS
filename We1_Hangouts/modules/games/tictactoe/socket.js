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
    
    handleConnection(socket, io, socketRegistry) {
        // Handle join-room
        socket.on('join-room', (roomId, playerName) => {
            socket.join(roomId);
            
            if (!this.gameRooms.has(roomId)) {
                this.gameRooms.set(roomId, gameLogic.createGameRoom(roomId));
            }
            
            const room = this.gameRooms.get(roomId);
            const stats = this.getOrCreatePlayerStats(socket.id, playerName);
            stats.name = playerName;
            
            if (room.players.length < 2) {
                const playerSymbol = room.players.length === 0 ? 'X' : 'O';
                const player = {
                    id: socket.id,
                    name: playerName,
                    symbol: playerSymbol,
                    stats: stats
                };
                
                room.players.push(player);
                socket.playerData = { roomId, ...player };
                
                if (room.players.length === 2) {
                    room.gameStatus = 'playing';
                }
            }
            
            // Update socket registry
            socketRegistry.updateSocketRoom(socket.id, roomId);
            socketRegistry.updateSocketPlayerData(socket.id, socket.playerData);
            
            io.to(roomId).emit('game-state', room);
            io.to(roomId).emit('player-joined', {
                playerName: playerName,
                playersCount: room.players.length
            });
            
            this.sendStatsUpdate(roomId, room, io);

            // ADD THIS - Room activity notification for player joining
            io.to(roomId).emit('room-activity', {
                icon: '👋',
                message: `${playerName} joined the room`
            });
        });
        
        // Handle make-move
        socket.on('make-move', (roomId, cellIndex) => {
            const room = this.gameRooms.get(roomId);
            if (!room || room.gameStatus !== 'playing') return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (!player || player.symbol !== room.currentPlayer) return;
            
            if (room.board[cellIndex] !== null) return;
            
            room.board[cellIndex] = player.symbol;

               // ADD THIS - Room activity notification
            io.to(roomId).emit('room-activity', {
                icon: '🎯',
                message: `${player.name} placed ${player.symbol}`
            });
            
            const winner = gameLogic.checkWinner(room.board);
            if (winner) {
                this.handleGameEnd(room, roomId, winner, player, io);
            } else {
                room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            }
            
            io.to(roomId).emit('game-state', room);
            
            if (winner) {
                io.to(roomId).emit('game-over', {
                    winner: room.winner,
                    board: room.board,
                    gameCount: room.gameCount,
                    roundHistory: room.roundHistory
                });
                
                setTimeout(() => {
                    if (room.players.length === 2 && room.gameStatus === 'finished') {
                        this.autoStartNextGame(roomId, io);
                    }
                }, 3000);
            }
        });
        
        // Handle reset-game
        socket.on('reset-game', (roomId) => {
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            this.startNewRound(room, roomId, io);
        });
        
        // Handle next-game
        socket.on('next-game', (roomId) => {
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            this.startNewRound(room, roomId, io);
        });
        
        // Handle stop-playing
        socket.on('stop-playing', (roomId) => {
            const room = this.gameRooms.get(roomId);
            if (!room) return;
            room.gameStatus = 'stopped';
            io.to(roomId).emit('game-stopped');
        });
    }
    
    handleDisconnection(socket, io) {
        if (!socket.playerData) return;
        
        const { roomId } = socket.playerData;
        const room = this.gameRooms.get(roomId);
        
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            
            if (room.players.length === 0) {
                this.gameRooms.delete(roomId);
            } else {
                room.gameStatus = 'waiting';
                io.to(roomId).emit('player-left', {
                    playerName: socket.playerData.name,
                    playersCount: room.players.length
                });
                io.to(roomId).emit('game-state', room);
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
    
    handleGameEnd(room, roomId, winner, lastPlayer, io) {
        room.gameStatus = 'finished';
        room.gameCount++;
        
        if (winner === 'tie') {
            room.winner = 'tie';
            room.players.forEach(p => {
                this.updatePlayerStats(p.id, 'tie');
            });
        } else {
            const winnerPlayer = room.players.find(p => p.symbol === winner);
            const loserPlayer = room.players.find(p => p.symbol !== winner);
            
            room.winner = winnerPlayer.name;
            this.updatePlayerStats(winnerPlayer.id, 'win');
            this.updatePlayerStats(loserPlayer.id, 'loss');
        }
        
        room.roundHistory.push({
            gameNumber: room.gameCount,
            winner: room.winner,
            board: [...room.board],
            timestamp: new Date()
        });
        
        room.players.forEach(p => {
            p.stats = this.playerStats.get(p.id);
        });
        
        this.sendStatsUpdate(roomId, room, io);
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