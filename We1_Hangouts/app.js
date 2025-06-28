const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import modular components
const socketRegistry = require('./modules/common/socketRegistry');
const chatSocketManager = require('./modules/chat/socketManager');
const ticTacToeSocketManager = require('./modules/games/tictactoe/socket');
const connect4SocketManager = require('./modules/games/connect4/socket');

// Import routes
const ticTacToeRoutes = require('./modules/games/tictactoe/routes');
const connect4Routes = require('./modules/games/connect4/routes');
const chatRoutes = require('./modules/chat/routes');
const userRoutes = require('./modules/user/routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.render('home', { title: 'We1 Hangouts' });
});
app.use('/games/tictactoe', ticTacToeRoutes);
app.use('/games/connect4', connect4Routes);
app.use('/chat', chatRoutes);
app.use('/user', userRoutes);

// Backward compatibility routes
app.get('/games/:gameType/:roomId', (req, res) => {
    const { gameType, roomId } = req.params;
    
    const validGames = ['tictactoe', 'connect4'];
    if (!validGames.includes(gameType)) {
        return res.status(404).send('Game type not supported');
    }
    
    res.render('game', { 
        title: `${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Game`,
        gameType: gameType,
        roomId: roomId 
    });
});

// Initialize socket managers
socketRegistry.initialize(io);
chatSocketManager.initialize(io);
ticTacToeSocketManager.initialize(io);
connect4SocketManager.initialize(io);

console.log('Socket managers initialized:');
console.log('- Registry:', socketRegistry ? 'OK' : 'FAILED');
console.log('- Chat:', chatSocketManager ? 'OK' : 'FAILED');
console.log('- TicTacToe:', ticTacToeSocketManager ? 'OK' : 'FAILED');
console.log('- Connect4:', connect4SocketManager ? 'OK' : 'FAILED');

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socketRegistry.registerSocket(socket);

    // Handle game-specific events based on room ID pattern or explicit game type
    socket.on('join-room', (roomId, playerName, gameType) => {
        console.log(`Join request - Room: ${roomId}, Player: ${playerName}, Game: ${gameType}`);
        
        // Determine game type from room or explicit parameter
        const detectedGameType = gameType || 'tictactoe'; // default to tictactoe for backwards compatibility
        
        if (detectedGameType === 'connect4') {
            connect4SocketManager.handleJoinRoom(socket, io, roomId, playerName);
        } else {
            ticTacToeSocketManager.handleJoinRoom(socket, io, roomId, playerName);
        }
    });

    // Initialize chat for this socket - it will handle all game types
    chatSocketManager.handleConnection(socket, io, {
        getRoom: (roomId) => {
            // Check both game managers for the room
            return ticTacToeSocketManager.gameRooms.get(roomId) || 
                   connect4SocketManager.gameRooms.get(roomId);
        },
        getAllRooms: () => {
            // Combine rooms from both managers
            const allRooms = new Map();
            ticTacToeSocketManager.gameRooms.forEach((room, id) => allRooms.set(id, room));
            connect4SocketManager.gameRooms.forEach((room, id) => allRooms.set(id, room));
            return allRooms;
        }
    });
    
    // Let each game manager handle their specific events
    ticTacToeSocketManager.handleGameEvents(socket, io, socketRegistry);
    connect4SocketManager.handleGameEvents(socket, io, socketRegistry);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socketRegistry.unregisterSocket(socket);
        chatSocketManager.handleDisconnection(socket);
        ticTacToeSocketManager.handleDisconnection(socket, io);
        connect4SocketManager.handleDisconnection(socket, io);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
});