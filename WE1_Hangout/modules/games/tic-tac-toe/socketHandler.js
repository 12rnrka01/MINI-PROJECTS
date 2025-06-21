const gameLogic = require('./gameLogic');

module.exports = {
    handleConnection(socket, io) {
        console.log('🎮 Tic-tac-toe socket handler ready');

        // When player joins a room
        socket.on('join-room', (data) => {
            const { roomId, playerName } = data;
            
            console.log(`🚪 ${playerName} joining room: ${roomId}`);
            
            // Join the socket room
            socket.join(roomId);
            
            // Get or create game
            const game = gameLogic.getOrCreateGame(roomId);
            
            // Add player to game
            const player = game.addPlayer(socket.id, playerName);
            
            if (player) {
                console.log(`✅ ${playerName} added as ${player.symbol}`);
                
                // Send game state to all players in room
                io.to(roomId).emit('game-state', game.getGameState());
                
                // Notify about player joining
                socket.to(roomId).emit('player-joined', {
                    playerName: playerName,
                    symbol: player.symbol
                });
                
                // Send welcome message to the player
                socket.emit('joined-successfully', {
                    player: player,
                    message: `Welcome ${playerName}! You are ${player.symbol}`
                });
                
            } else {
                // Room is full
                socket.emit('join-error', {
                    message: 'Room is full! Only 2 players allowed.'
                });
            }
        });

        // When player makes a move
        socket.on('make-move', (data) => {
            const { roomId, position } = data;
            
            console.log(`🎯 Move attempt: position ${position} in room ${roomId}`);
            
            const game = gameLogic.getGame(roomId);
            
            if (!game) {
                socket.emit('move-error', { message: 'Game not found' });
                return;
            }
            
            // Try to make the move
            const result = game.makeMove(socket.id, position);
            
            if (result.success) {
                console.log('✅ Move successful');
                
                // Send updated game state to all players
                io.to(roomId).emit('game-state', game.getGameState());
                
                if (result.winner) {
                    console.log(`🏆 Winner: ${result.winner.name}`);
                    io.to(roomId).emit('game-over', {
                        winner: result.winner,
                        message: `${result.winner.name} wins!`
                    });
                } else if (result.draw) {
                    console.log('🤝 Game is a draw');
                    io.to(roomId).emit('game-over', {
                        draw: true,
                        message: "It's a draw!"
                    });
                } else {
                    // Game continues, notify whose turn is next
                    io.to(roomId).emit('turn-change', {
                        nextPlayer: result.nextPlayer,
                        message: `${result.nextPlayer.name}'s turn (${result.nextPlayer.symbol})`
                    });
                }
            } else {
                console.log(`❌ Move failed: ${result.message}`);
                socket.emit('move-error', { message: result.message });
            }
        });

        // When player wants to restart game
        socket.on('restart-game', (data) => {
            const { roomId } = data;
            
            console.log(`🔄 Restart request for room: ${roomId}`);
            
            const game = gameLogic.getGame(roomId);
            
            if (game) {
                game.resetGame();
                console.log('✅ Game restarted');
                
                // Send fresh game state to all players
                io.to(roomId).emit('game-state', game.getGameState());
                io.to(roomId).emit('game-restarted', {
                    message: 'Game restarted! Let\'s play again!'
                });
            }
        });

        // When player sends chat message
        socket.on('chat-message', (data) => {
            const { roomId, message } = data;
            
            console.log(`💬 Chat message in room ${roomId}: ${message}`);
            
            const game = gameLogic.getGame(roomId);
            if (!game) {
                socket.emit('chat-error', { message: 'Room not found' });
                return;
            }
            
            // Find player name
            const player = game.players.find(p => p.id === socket.id);
            if (!player) {
                socket.emit('chat-error', { message: 'Player not found in room' });
                return;
            }
            
            // Add message to game
            const chatMessage = game.addChatMessage(socket.id, player.name, message);
            
            // Send to OTHER players in room (not sender)
            socket.to(roomId).emit('chat-message', {
                id: chatMessage.id,
                playerName: chatMessage.playerName,
                message: chatMessage.message,
                timestamp: new Date(chatMessage.timestamp).toLocaleTimeString()
            });
        });

        // When player wants to terminate room
        socket.on('terminate-room', (data) => {
            const { roomId } = data;
            
            console.log(`🗑️ Terminate room request: ${roomId}`);
            
            const game = gameLogic.getGame(roomId);
            if (!game) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            
            // Check if player is in the room
            const player = game.players.find(p => p.id === socket.id);
            if (!player) {
                socket.emit('error', { message: 'You are not in this room' });
                return;
            }
            
            // Terminate the room
            game.terminateRoom();
            
            // Notify all players
            io.to(roomId).emit('room-terminated', {
                message: `Room terminated by ${player.name}`,
                terminatedBy: player.name
            });
            
            // Remove the game after a delay to allow notifications
            setTimeout(() => {
                gameLogic.removeGame(roomId);
                console.log(`🗑️ Room ${roomId} removed from memory`);
            }, 2000);
        });

        // Get chat history
        socket.on('get-chat-history', (data) => {
            const { roomId } = data;
            
            console.log(`📜 Chat history request for room: ${roomId}`);
            
            const game = gameLogic.getGame(roomId);
            if (game) {
                const messages = game.getChatMessages().map(msg => ({
                    id: msg.id,
                    playerName: msg.playerName,
                    message: msg.message,
                    timestamp: new Date(msg.timestamp).toLocaleTimeString(),
                    isOwn: msg.playerId === socket.id
                }));
                
                socket.emit('chat-history', { messages });
                console.log(`📜 Sent ${messages.length} chat messages to ${socket.id}`);
            } else {
                socket.emit('chat-history', { messages: [] });
            }
        });
    },

    handleDisconnection(socket, io) {
        console.log(`🚪 Player ${socket.id} disconnected`);
        
        // Find and remove player from all active games
        const activeGames = gameLogic.getAllGames();
        
        activeGames.forEach((game, roomId) => {
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = game.players[playerIndex];
                console.log(`👋 Removing ${player.name} from room ${roomId}`);
                
                // Remove player from game
                game.removePlayer(socket.id);
                
                // Notify other players
                socket.to(roomId).emit('player-left', {
                    playerName: player.name,
                    message: `${player.name} left the game`
                });
                
                // Send updated game state
                io.to(roomId).emit('game-state', game.getGameState());
                
                // If no players left, remove the game after a delay
                if (game.players.length === 0) {
                    setTimeout(() => {
                        if (gameLogic.getGame(roomId) && gameLogic.getGame(roomId).players.length === 0) {
                            gameLogic.removeGame(roomId);
                            console.log(`🗑️ Empty room ${roomId} removed`);
                        }
                    }, 30000); // 30 seconds delay
                }
            }
        });
    }
};