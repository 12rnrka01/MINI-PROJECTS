const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
const gameRooms = new Map();
const playerStats = new Map(); // Store player statistics

// Create a new game room
function createGameRoom(roomId) {
    return {
        id: roomId,
        players: [],
        board: Array(9).fill(null),
        currentPlayer: 'X',
        gameStatus: 'waiting', // waiting, playing, finished
        winner: null,
        messages: [],
        gameCount: 0,
        roundHistory: []
    };
}

// Get or create player stats
function getPlayerStats(playerId, playerName) {
    if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
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

// Auto start next game function
function autoStartNextGame(roomId) {
    const room = gameRooms.get(roomId);
    if (!room || room.players.length !== 2) return;
    
    startNewRound(room, roomId);
    
    io.to(roomId).emit('auto-next-game', {
        message: 'Starting next game...',
        gameCount: room.gameCount + 1
    });
}

// Start new round function
function startNewRound(room, roomId) {
    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
    room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
    room.winner = null;
    
    // Alternate who goes first based on game count
    if (room.gameCount % 2 === 1) {
        // Swap players for fairness
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
    }
    return playerStats.get(playerId);
}

// Update player stats after game
function updatePlayerStats(playerId, result) {
    const stats = playerStats.get(playerId);
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

// Check for winner
function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    
    if (!board.includes(null)) {
        return 'tie';
    }
    
    return null;
}

// Auto start next game function
function autoStartNextGame(roomId) {
    const room = gameRooms.get(roomId);
    if (!room || room.players.length !== 2) return;
    
    startNewRound(room, roomId);
    
    io.to(roomId).emit('auto-next-game', {
        message: 'Starting next game...',
        gameCount: room.gameCount + 1
    });
}

// Start new round function
function startNewRound(room, roomId) {
    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
    room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
    room.winner = null;
    
    // Alternate who goes first based on game count
    if (room.gameCount % 2 === 1) {
        // Swap players for fairness
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

// Routes
app.get('/', (req, res) => {
    res.render('index', { title: 'Tic-Tac-Toe with Chat' });
});

app.get('/game/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, createGameRoom(roomId));
    }
    res.render('game', { title: 'Game Room', roomId: roomId });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join-room', (roomId, playerName) => {
        socket.join(roomId);
        
        if (!gameRooms.has(roomId)) {
            gameRooms.set(roomId, createGameRoom(roomId));
        }
        
        const room = gameRooms.get(roomId);
        
        // Get or create player stats
        const stats = getPlayerStats(socket.id, playerName);
        stats.name = playerName; // Update name in case it changed
        
        // Add player if room has space
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
        
        // Send game state to all players in room
        io.to(roomId).emit('game-state', room);
        io.to(roomId).emit('player-joined', {
            playerName: socket.playerData?.name,
            playersCount: room.players.length
        });
        
        // Send updated stats to all players
        io.to(roomId).emit('stats-update', {
            players: room.players.map(p => ({
                name: p.name,
                symbol: p.symbol,
                stats: p.stats
            }))
        });
    });
    
    socket.on('make-move', (roomId, cellIndex) => {
        const room = gameRooms.get(roomId);
        if (!room || room.gameStatus !== 'playing') return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.symbol !== room.currentPlayer) return;
        
        if (room.board[cellIndex] !== null) return;
        
        // Make the move
        room.board[cellIndex] = player.symbol;
        
        // Check for winner
        const winner = checkWinner(room.board);
        if (winner) {
            room.gameStatus = 'finished';
            room.gameCount++;
            
            // Update player statistics
            if (winner === 'tie') {
                room.winner = 'tie';
                // Update both players with tie
                room.players.forEach(p => {
                    updatePlayerStats(p.id, 'tie');
                });
            } else {
                const winnerPlayer = room.players.find(p => p.symbol === winner);
                const loserPlayer = room.players.find(p => p.symbol !== winner);
                
                room.winner = winnerPlayer.name;
                
                // Update winner and loser stats
                updatePlayerStats(winnerPlayer.id, 'win');
                updatePlayerStats(loserPlayer.id, 'loss');
            }
            
            // Add to round history
            room.roundHistory.push({
                gameNumber: room.gameCount,
                winner: room.winner,
                board: [...room.board],
                timestamp: new Date()
            });
            
            // Update player objects with new stats
            room.players.forEach(p => {
                p.stats = playerStats.get(p.id);
            });
        } else {
            // Switch player
            room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
        }
        
        // Send updated game state
        io.to(roomId).emit('game-state', room);
        
        if (winner) {
            io.to(roomId).emit('game-over', {
                winner: room.winner,
                board: room.board,
                gameCount: room.gameCount,
                roundHistory: room.roundHistory
            });
            
            // Send updated stats
            io.to(roomId).emit('stats-update', {
                players: room.players.map(p => ({
                    name: p.name,
                    symbol: p.symbol,
                    stats: p.stats
                }))
            });
            
            // Auto start next game after 3 seconds
            setTimeout(() => {
                if (room.players.length === 2 && room.gameStatus === 'finished') {
                    autoStartNextGame(roomId);
                }
            }, 3000);
        }
    });
    
    socket.on('reset-game', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        startNewRound(room, roomId);
    });
    
    socket.on('next-game', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        startNewRound(room, roomId);
    });
    
    socket.on('stop-playing', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        room.gameStatus = 'stopped';
        io.to(roomId).emit('game-stopped');
    });
    
    socket.on('send-message', (roomId, message) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        const chatMessage = {
            id: Date.now(),
            playerName: player?.name || 'Anonymous',
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };
        
        room.messages.push(chatMessage);
        
        // Keep only last 50 messages
        if (room.messages.length > 50) {
            room.messages = room.messages.slice(-50);
        }
        
        io.to(roomId).emit('new-message', chatMessage);
    });

    socket.on('typing-start', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            socket.to(roomId).emit('player-typing', { playerName: player.name, typing: true });
        }
    });
    
    socket.on('typing-stop', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            socket.to(roomId).emit('player-typing', { playerName: player.name, typing: false });
        }
    });
    
    socket.on('send-reaction', (roomId, reactionData) => {
        io.to(roomId).emit('show-reaction', reactionData);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.playerData) {
            const { roomId } = socket.playerData;
            const room = gameRooms.get(roomId);
            
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                if (room.players.length === 0) {
                    gameRooms.delete(roomId);
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
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});