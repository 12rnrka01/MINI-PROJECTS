class SocketRegistry {
    constructor() {
        this.io = null;
        this.connectedSockets = new Map();
    }

    initialize(io) {
        this.io = io;
        console.log('🔗 Socket Registry initialized');
    }

    registerSocket(socket) {
        this.connectedSockets.set(socket.id, {
            socket: socket,
            connectedAt: new Date(),
            currentGame: 'tictactoe',
            currentRoom: null,
            playerData: null
        });
        
        console.log(`✅ Socket registered: ${socket.id} (Total: ${this.connectedSockets.size})`);
    }
    
    unregisterSocket(socket) {
        this.connectedSockets.delete(socket.id);
        console.log(`❌ Socket unregistered: ${socket.id} (Total: ${this.connectedSockets.size})`);
    }

    updateSocketRoom(socketId, roomId) {
        const socketData = this.connectedSockets.get(socketId);
        if (socketData) {
            socketData.currentRoom = roomId;
        }
    }
    
    updateSocketPlayerData(socketId, playerData) {
        const socketData = this.connectedSockets.get(socketId);
        if (socketData) {
            socketData.playerData = playerData;
        }
    }

    getConnectedCount() {
        return this.connectedSockets.size;
    }
    
    getSocketsByRoom(roomId) {
        const sockets = [];
        this.connectedSockets.forEach((data, socketId) => {
            if (data.currentRoom === roomId) {
                sockets.push(data.socket);
            }
        });
        return sockets;
    }

}

module.exports = new SocketRegistry();