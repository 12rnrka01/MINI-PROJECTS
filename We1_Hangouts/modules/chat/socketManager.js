// modules/chat/socketManager.js - FIXED VERSION
class ChatSocketManager {
    constructor() {
        this.io = null;
        this.roomProviders = {
            getRoom: null,
            getAllRooms: null
        };
    }

    initialize(io) {
        this.io = io;
        console.log('💬 Chat Socket Manager initialized');
    }

    handleConnection(socket, io, roomProviders) {
        // Store room providers for getting room data
        this.roomProviders = roomProviders;

        socket.on('send-message', (roomId, message) => {
            console.log('💬 Chat message received:', { roomId, message, socketId: socket.id });
            
            // Get room from game managers
            const room = this.roomProviders.getRoom(roomId);
            if (!room) {
                console.log('Room not found:', roomId);
                return;
            }
            
            // Find player in room
            const player = room.players.find(p => p.id === socket.id);
            if (!player) {
                console.log('Player not found in room:', socket.id);
                return;
            }
            
            const chatMessage = {
                id: Date.now() + Math.random(), // Ensure unique ID
                playerName: player.name,
                message: message.trim(),
                timestamp: new Date().toLocaleTimeString(),
                gameType: room.gameType || 'unknown'
            };
            
            // Initialize messages array if not exists
            if (!room.messages) {
                room.messages = [];
            }
            
            room.messages.push(chatMessage);
            
            // Keep only last 50 messages
            if (room.messages.length > 50) {
                room.messages = room.messages.slice(-50);
            }
            
            console.log(`💬 Broadcasting message to room ${roomId}:`, chatMessage);
            io.to(roomId).emit('new-message', chatMessage);
        });

        socket.on('typing-start', (roomId) => {
            const room = this.roomProviders.getRoom(roomId);
            if (!room) return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                socket.to(roomId).emit('player-typing', { 
                    playerName: player.name, 
                    typing: true 
                });
            }
        });
        
        socket.on('typing-stop', (roomId) => {
            const room = this.roomProviders.getRoom(roomId);
            if (!room) return;
            
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                socket.to(roomId).emit('player-typing', { 
                    playerName: player.name, 
                    typing: false 
                });
            }
        });

        socket.on('message-reaction', (roomId, reactionData) => {
            const room = this.roomProviders.getRoom(roomId);
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

    handleDisconnection(socket) {
        console.log('💬 Chat user disconnected:', socket.id);
    }
}

module.exports = new ChatSocketManager();