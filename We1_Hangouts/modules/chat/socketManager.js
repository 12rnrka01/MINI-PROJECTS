class ChatSocketManager {
    constructor() {
        this.io = null;
    }

    init(io) {
        this.io = io;
        console.log('💬 Chat Socket Manager initialized');
    }

    handleConnection(socket, io, gameRooms) {
        socket.on('send-message', (roomId, message) => {
            console.log('💬 Chat message received:', message);
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
            console.log(`Chat message from ${chatMessage.playerName}: ${message}`);
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
    
        socket.on('message-reaction', (roomId, reactionData) => {
            const room = gameRooms.get(roomId);
            if (!room) return;
            
            // Initialize reactions tracking if not exists
            if (!room.messageReactions) {
                room.messageReactions = new Map();
            }
            
            const messageKey = `${reactionData.messageId}_${reactionData.emoji}`;
            
            if (!room.messageReactions.has(messageKey)) {
                room.messageReactions.set(messageKey, {
                    messageId: reactionData.messageId,
                    emoji: reactionData.emoji,
                    count: 0,
                    users: []
                });
            }
            
            const reaction = room.messageReactions.get(messageKey);
            
            // Check if user already reacted with this emoji
            if (!reaction.users.includes(reactionData.playerName)) {
                reaction.count++;
                reaction.users.push(reactionData.playerName);
                
                // Send updated reaction to all players
                io.to(roomId).emit('message-reaction-update', {
                    messageId: reactionData.messageId,
                    emoji: reactionData.emoji,
                    count: reaction.count,
                    users: reaction.users
                });
            }
        });

        
    }


    handleDisconnection(socket, io, gameRooms) {
        console.log('User disconnected:', socket.id);
    }
}

module.exports = new ChatSocketManager();