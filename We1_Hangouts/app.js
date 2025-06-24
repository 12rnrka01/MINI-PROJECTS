const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import modular components
const socketRegistry = require('./modules/common/socketRegistry');
const chatSocketManager = require('./modules/chat/socketManager');
const ticTacToeSocketManager = require('./modules/games/tictactoe/socket');

// Import routes
const ticTacToeRoutes = require('./modules/games/tictactoe/routes');
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
    res.render('index', { title: 'We1 Hangouts' });
});
app.use('/games/tictactoe', ticTacToeRoutes);
app.use('/chat', chatRoutes);
app.use('/user', userRoutes);

// Backward compatibility routes
app.get('/games/:gameType/:roomId', (req, res) => {
    const { gameType, roomId } = req.params;
    
    const validGames = ['tictactoe', 'connect4', 'chess'];
    if (!validGames.includes(gameType)) {
        return res.status(404).send('Game type not supported');
    }
    
    res.render('game', { 
        title: `${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Game`,
        gameType: gameType,
        roomId: roomId 
    });
});
app.get('/game/:roomId', (req, res) => {
    res.redirect(`/games/tictactoe/${req.params.roomId}`);
});

socketRegistry.initialize(io);
ticTacToeSocketManager.initialize(io);


// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socketRegistry.registerSocket(socket);

    chatSocketManager.handleConnection(socket, io, ticTacToeSocketManager.gameRooms);
    ticTacToeSocketManager.handleConnection(socket, io, socketRegistry);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socketRegistry.unregisterSocket(socket);
        chatSocketManager.handleDisconnection(socket);
        ticTacToeSocketManager.handleDisconnection(socket, io);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
});