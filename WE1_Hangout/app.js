require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import our modules
const dbConnection = require('./modules/common/dbConnection');
const socketHandler = require('./modules/common/socket');
const ticTacToeRoutes = require('./modules/games/tic-tac-toe/routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Basic setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
dbConnection.connect();

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Game routes
app.use('/tic-tac-toe', ticTacToeRoutes);

// Socket handling
socketHandler.initialize(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down...');
    server.close(() => {
        dbConnection.close();
        process.exit(0);
    });
});