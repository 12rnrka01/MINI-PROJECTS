// public/js/base-game.js - FIXED VERSION - Complete with proper chat integration

class BaseGameManager {
    constructor(gameType, roomId) {
        this.socket = null;
        this.gameType = gameType;
        this.roomId = roomId;
        this.gameState = null;
        this.playerData = null;
        this.soundEnabled = true;
        this.gameStartTime = null;
        this.gameTimer = null;
        
        console.log(`Initializing BaseGameManager for ${gameType} in room ${roomId}`);
        
        this.initializeSocket();
        this.bindCommonEvents();
        this.handlePlayerNameModal();
        
        // Setup chat handlers - delay to ensure socket is ready
        setTimeout(() => {
            this.setupChatHandlers();
        }, 500);
    }

    setupChatHandlers() {
        console.log('Setting up chat handlers...');
        
        // Initialize chat manager if it doesn't exist and we have a socket
        if (!window.chatManager && this.socket) {
            console.log('Creating new chat manager...');
            window.chatManager = new ChatManager(this.socket, this.roomId);
            console.log('Chat manager created successfully');
        } else if (window.chatManager) {
            console.log('Chat manager already exists');
        } else {
            console.warn('Cannot create chat manager - no socket available');
        }
        
        // Set player data for chat when available
        if (this.playerData && window.chatManager) {
            window.chatManager.setPlayerData(this.playerData);
            console.log('Player data set in chat manager');
        }
        
        console.log('Chat handlers setup complete');
    }

    handlePlayerNameModal() {
        const nameModal = document.getElementById('name-modal');
        const playerNameInput = document.getElementById('player-name-input');
        const joinGameBtn = document.getElementById('join-game-btn');

        // Check if player name is stored in your existing user session system
        let storedPlayerName = null;
        
        // Try to get from your existing gameHub_user_session
        try {
            const userSession = localStorage.getItem('gameHub_user_session');
            if (userSession) {
                const sessionData = JSON.parse(userSession);
                storedPlayerName = sessionData.username || sessionData.name || sessionData.playerName;
            }
        } catch (e) {
            console.log('No existing user session found');
        }
        
        // Fallback to simple playerName storage if no session exists
        if (!storedPlayerName) {
            storedPlayerName = localStorage.getItem('playerName');
        }
        
        if (storedPlayerName && storedPlayerName.trim().length > 0) {
            // Auto-join with stored name
            if (playerNameInput) {
                playerNameInput.value = storedPlayerName;
            }
            if (nameModal) {
                nameModal.style.display = 'none';
            }
            // Auto-join the game
            setTimeout(() => {
                this.joinGame(storedPlayerName);
            }, 500);
        } else {
            // Show modal for new player
            if (nameModal) {
                nameModal.style.display = 'flex';
                if (playerNameInput) {
                    playerNameInput.focus();
                }
            }
        }

        // Handle manual join button click
        if (joinGameBtn && playerNameInput) {
            joinGameBtn.addEventListener('click', () => {
                const playerName = playerNameInput.value.trim();
                if (playerName) {
                    // Store name in your existing user session system
                    this.savePlayerNameToSession(playerName);
                    
                    this.joinGame(playerName);
                    if (nameModal) {
                        nameModal.style.display = 'none';
                    }
                } else {
                    this.showNotification('Please enter a valid name', 'error');
                }
            });

            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    joinGameBtn.click();
                }
            });
        }

        // Add "Change Name" functionality
        this.addChangeNameButton();
    }

    savePlayerNameToSession(playerName) {
        try {
            // Try to update existing gameHub_user_session
            let userSession = localStorage.getItem('gameHub_user_session');
            if (userSession) {
                const sessionData = JSON.parse(userSession);
                sessionData.username = playerName;
                localStorage.setItem('gameHub_user_session', JSON.stringify(sessionData));
            } else {
                // Create new session if none exists
                const newSession = {
                    username: playerName,
                    userId: 'user_' + Math.random().toString(36).substr(2, 9),
                    createdAt: new Date().toISOString()
                };
                localStorage.setItem('gameHub_user_session', JSON.stringify(newSession));
            }
            
            // Also store as simple fallback
            localStorage.setItem('playerName', playerName);
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
            // Fallback to simple storage
            localStorage.setItem('playerName', playerName);
        }
    }

    addChangeNameButton() {
        // Add a change name button to the header or somewhere accessible
        const navLinks = document.querySelector('.nav-links');
        if (navLinks && !document.getElementById('change-name-btn')) {
            const changeNameBtn = document.createElement('li');
            changeNameBtn.innerHTML = '<a href="#" id="change-name-btn">Change Name</a>';
            navLinks.appendChild(changeNameBtn);

            document.getElementById('change-name-btn').addEventListener('click', (e) => {
                e.preventDefault();
                this.showChangeNameModal();
            });
        }
    }

    showChangeNameModal() {
        const nameModal = document.getElementById('name-modal');
        const playerNameInput = document.getElementById('player-name-input');
        
        if (nameModal && playerNameInput) {
            // Get current name from user session
            let currentName = '';
            try {
                const userSession = localStorage.getItem('gameHub_user_session');
                if (userSession) {
                    const sessionData = JSON.parse(userSession);
                    currentName = sessionData.username || sessionData.name || sessionData.playerName || '';
                }
            } catch (e) {
                currentName = localStorage.getItem('playerName') || '';
            }
            
            playerNameInput.value = currentName;
            nameModal.style.display = 'flex';
            playerNameInput.focus();
            playerNameInput.select();
        }
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });
        
        this.socket.on('game-state', (gameState) => {
            console.log('Received game state:', gameState);
            this.gameState = gameState;
            this.onGameStateUpdate(gameState);
            
            // Update chat with current player data after game state update
            if (this.playerData && window.chatManager) {
                window.chatManager.setPlayerData(this.playerData);
            }
        });

        this.socket.on('game-over', (data) => {
            console.log('Game over:', data);
            this.onGameOver(data);
        });

        this.socket.on('game-reset', (data) => {
            console.log('Game reset:', data);
            this.onGameReset(data);
        });

        this.socket.on('auto-next-game', (data) => {
            this.showNotification(`${data.message}`, 'info');
        });

        this.socket.on('turn-timeout', (data) => {
            this.showNotification(data.message, 'warning');
        });

        this.socket.on('player-joined', (data) => {
            console.log('Player joined:', data);
            this.showNotification(`${data.playerName} joined the game`, 'success');
        });

        this.socket.on('player-left', (data) => {
            console.log('Player left:', data);
            this.showNotification(`${data.playerName} left the game`, 'warning');
        });

        this.socket.on('room-activity', (data) => {
            console.log('Room activity:', data);
            this.showRoomActivity(data.icon, data.message);
        });

        this.socket.on('stats-update', (data) => {
            console.log('Stats update:', data);
            this.updatePlayerStats(data.players);
        });

        this.socket.on('show-reaction', (reactionData) => {
            console.log('Show reaction:', reactionData);
            this.displayReaction(reactionData);
        });

        this.socket.on('room-full', (data) => {
            console.log('Room is full:', data);
            this.showNotification('Room is full!', 'error');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    bindCommonEvents() {
        // Copy room ID button
        const copyRoomBtn = document.getElementById('copy-room-id');
        if (copyRoomBtn) {
            copyRoomBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(this.roomId).then(() => {
                    this.showNotification('Room ID copied to clipboard!', 'success');
                });
            });
        }

        // Reset game button
        const resetBtn = document.getElementById('reset-game');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetGame();
            });
        }

        // Leave game button
        const leaveBtn = document.getElementById('leave-game');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => {
                this.leaveGame();
            });
        }

        // Reaction buttons
        document.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reaction = e.target.getAttribute('data-reaction');
                this.sendReaction(reaction);
            });
        });
    }

    // Methods to be overridden by specific game classes
    onGameStateUpdate(gameState) {
        // Override in child classes
    }

    onGameOver(data) {
        this.playSound('gameOver');
        this.updateRoundHistory(data.roundHistory);
        
        setTimeout(() => {
            if (data.winner === 'draw' || data.winner === 'tie') {
                this.showNotification("Game ended in a draw!", 'info');
            } else {
                const isWinner = this.isCurrentPlayerWinner(data.winner);
                
                if (isWinner) {
                    this.showNotification("🎉 You won!", 'success');
                } else {
                    const winnerName = this.getWinnerName(data.winner);
                    this.showNotification(`${winnerName} won this round`, 'info');
                }
            }
        }, 1000);
    }

    onGameReset(data) {
        this.gameStartTime = null;
        this.stopGameTimer();
        this.showNotification("New game started!", 'info');
        this.playSound('newGame');
    }

    // Common utility methods
    joinGame(playerName) {
        if (!playerName || playerName.trim().length === 0) {
            this.showNotification('Please enter a valid name', 'error');
            return;
        }

        console.log(`[${this.gameType}] Attempting to join room ${this.roomId} with name: ${playerName}`);
        console.log('Socket connected:', this.socket.connected);
        console.log('Socket ID:', this.socket.id);
        
        // Send game type along with join request
        this.socket.emit('join-room', this.roomId, playerName.trim(), this.gameType);
        
        // Store the player name using your existing session system
        this.savePlayerNameToSession(playerName.trim());
        
        // Show a joining message
        this.showNotification(`Joining ${this.gameType} game as ${playerName}...`, 'info');
        
        // Add a timeout to check if join was successful
        setTimeout(() => {
            if (!this.gameState || !this.gameState.players || this.gameState.players.length === 0) {
                console.warn('Join may have failed - no game state received');
                this.showNotification('Connection issue. Please try refreshing the page.', 'warning');
            }
        }, 5000);
    }

    resetGame() {
        if (confirm('Are you sure you want to start a new game?')) {
            this.socket.emit('reset-game', this.roomId);
        }
    }

    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            window.location.href = '/';
        }
    }

    sendReaction(reaction) {
        if (this.socket && this.playerData) {
            console.log(`Sending reaction: ${reaction} in room: ${this.roomId}`);
            this.socket.emit('send-reaction', this.roomId, {
                reaction: reaction,
                playerName: this.playerData.name,
                playerColor: this.playerData.color || this.playerData.symbol,
                timestamp: Date.now()
            });
        }
    }

    updatePlayerStats(players) {
        // To be implemented by child classes with their specific player IDs
    }

    updateRoundHistory(history) {
        const historyElement = document.getElementById('history-list');
        if (!historyElement || !history) return;

        historyElement.innerHTML = '';
        
        // Show last 5 games
        const recentGames = history.slice(-5).reverse();
        
        recentGames.forEach(game => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const gameNumber = document.createElement('span');
            gameNumber.className = 'game-number';
            gameNumber.textContent = `Game ${game.gameNumber}`;
            
            const winner = document.createElement('span');
            winner.className = 'game-winner';
            if (game.winner === 'draw' || game.winner === 'tie') {
                winner.textContent = 'Draw';
                winner.style.color = '#666';
            } else {
                const winnerName = this.getWinnerName(game.winner);
                winner.textContent = winnerName;
                winner.style.color = this.getWinnerColor(game.winner);
            }
            
            historyItem.appendChild(gameNumber);
            historyItem.appendChild(winner);
            historyElement.appendChild(historyItem);
        });

        // Show history section if there are games
        const roundHistorySection = document.getElementById('round-history');
        if (roundHistorySection && history.length > 0) {
            roundHistorySection.style.display = 'block';
        }
    }

    startGameTimer() {
        if (this.gameTimer) return;
        
        this.gameTimer = setInterval(() => {
            if (this.gameStartTime) {
                const elapsed = Date.now() - this.gameStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                const gameTimeElement = document.getElementById('game-time');
                if (gameTimeElement) {
                    gameTimeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    stopGameTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }

    playSound(type) {
        if (!this.soundEnabled) return;

        try {
            // Use the common sound utility if available
            if (window.GameUtils && window.GameUtils.playSound) {
                window.GameUtils.playSound(type, this.volume || 0.3);
                return;
            }

            // Fallback basic sound implementation
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            gainNode.gain.value = this.volume || 0.3;
            
            switch (type) {
                case 'move':
                    oscillator.frequency.value = 800;
                    oscillator.type = 'square';
                    break;
                case 'win':
                    oscillator.frequency.value = 1200;
                    oscillator.type = 'sine';
                    break;
                case 'gameOver':
                    oscillator.frequency.value = 600;
                    oscillator.type = 'triangle';
                    break;
                case 'newGame':
                    oscillator.frequency.value = 1000;
                    oscillator.type = 'sine';
                    break;
                case 'error':
                    oscillator.frequency.value = 300;
                    oscillator.type = 'sawtooth';
                    break;
                default:
                    oscillator.frequency.value = 600;
                    oscillator.type = 'sine';
            }
            
            oscillator.start();
            oscillator.stop(context.currentTime + 0.1);
        } catch (e) {
            // Silent fail for audio
            console.warn('Audio not supported:', e);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '5px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '1000',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    showRoomActivity(icon, message) {
        const activityElement = document.getElementById('room-activity');
        if (!activityElement) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <span class="activity-icon">${icon}</span>
            <span class="activity-message">${message}</span>
            <span class="activity-time">${new Date().toLocaleTimeString()}</span>
        `;

        activityElement.appendChild(activityItem);

        while (activityElement.children.length > 5) {
            activityElement.removeChild(activityElement.firstChild);
        }

        setTimeout(() => {
            if (activityItem.parentNode) {
                activityItem.parentNode.removeChild(activityItem);
            }
        }, 10000);
    }

    displayReaction(reactionData) {
        // Create floating reaction animation
        const reaction = document.createElement('div');
        reaction.textContent = reactionData.reaction;
        reaction.style.cssText = `
            position: fixed;
            font-size: 2rem;
            z-index: 1000;
            pointer-events: none;
            animation: reactionFloat 2s ease-out forwards;
            left: ${Math.random() * 80 + 10}%;
            top: 60%;
        `;
        
        // Add CSS animation if not exists
        if (!document.getElementById('reaction-styles')) {
            const style = document.createElement('style');
            style.id = 'reaction-styles';
            style.textContent = `
                @keyframes reactionFloat {
                    0% {
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-100px) scale(1.5);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(reaction);
        
        // Remove after animation
        setTimeout(() => {
            if (reaction.parentNode) {
                reaction.parentNode.removeChild(reaction);
            }
        }, 2000);
        
        // Show notification
        this.showNotification(`${reactionData.playerName} reacted with ${reactionData.reaction}`, 'info');
    }

    // Abstract methods to be implemented by child classes
    isCurrentPlayerWinner(winner) {
        throw new Error('isCurrentPlayerWinner must be implemented by child class');
    }

    getWinnerName(winner) {
        throw new Error('getWinnerName must be implemented by child class');
    }

    getWinnerColor(winner) {
        throw new Error('getWinnerColor must be implemented by child class');
    }
}