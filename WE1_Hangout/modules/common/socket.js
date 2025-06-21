const ticTacToeHandler = require('../games/tic-tac-toe/socketHandler');

module.exports = {
    initialize(io) {
        io.on('connection', (socket) => {
            console.log(`👤 User connected: ${socket.id}`);

            // Handle tic-tac-toe game events
            ticTacToeHandler.handleConnection(socket, io);

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`👋 User disconnected: ${socket.id}`);
                ticTacToeHandler.handleDisconnection(socket, io);
            });
        });
    }
};