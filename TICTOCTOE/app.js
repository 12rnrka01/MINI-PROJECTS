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

// Create a new game room
function createGameRoom(roomId) {
    return {
        id: roomId,
        players: [],
        board: Array(9).fill(null),
        currentPlayer: 'X',
        gameStatus: 'waiting', // waiting, playing, finished
        winner: null,
        messages: []
    };
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
        
        // Add player if room has space
        if (room.players.length < 2) {
            const playerSymbol = room.players.length === 0 ? 'X' : 'O';
            const player = {
                id: socket.id,
                name: playerName || `Player ${room.players.length + 1}`,
                symbol: playerSymbol
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
            room.winner = winner === 'tie' ? 'tie' : player.name;
        } else {
            // Switch player
            room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
        }
        
        // Send updated game state
        io.to(roomId).emit('game-state', room);
        
        if (winner) {
            io.to(roomId).emit('game-over', {
                winner: room.winner,
                board: room.board
            });
        }
    });
    
    socket.on('reset-game', (roomId) => {
        const room = gameRooms.get(roomId);
        if (!room) return;
        
        room.board = Array(9).fill(null);
        room.currentPlayer = 'X';
        room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
        room.winner = null;
        
        io.to(roomId).emit('game-state', room);
        io.to(roomId).emit('game-reset');
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