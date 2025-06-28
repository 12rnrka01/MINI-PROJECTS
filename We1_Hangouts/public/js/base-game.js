// public/js/base-game.js - Enhanced Base Game Manager with Room Locking and Advanced Features

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
        this.roomLocked = false;
        this.notificationQueue = [];
        this.maxNotifications = 3;
        
        console.log(`Initializing BaseGameManager for ${gameType} in room ${roomId}`);
        
        this.initializeSocket();
        this.bindCommonEvents();
        this.handlePlayerNameModal();
        this.loadUserPreferences();
        
        // Setup chat handlers - delay to ensure socket is ready
        setTimeout(() => {
            this.setupChatHandlers();
        }, 500);
    }

    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('gamePreferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                this.soundEnabled = prefs.soundEnabled !== false;
                this.volume = prefs.volume || 0.3;
                this.maxNotifications = prefs.maxNotifications || 3;
            }
        } catch (e) {
            console.warn('Could not load user preferences:', e);
        }
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

        // Check if player name is stored in existing user session system
        let storedPlayerName = null;
        
        try {
            const userSession = localStorage.getItem('playerName');
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
                    // Store name in existing user session system
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

    }

    savePlayerNameToSession(playerName) {
        debugger
        try {
            let userSession = localStorage.getItem('playerName');
            if (userSession) {
                // Existed data should not be update
            } else {
                // Create new session if none exists
                const newSession = {
                    name: playerName,
                    avatar: "🎮",
                    userId: 'user_' + Math.random().toString(36).substr(2, 9)
                };
                localStorage.setItem('playerName', JSON.stringify(newSession));
                window.location.reload();
            }
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    showChangeNameModal() {
        const nameModal = document.getElementById('name-modal');
        const playerNameInput = document.getElementById('player-name-input');
        
        if (nameModal && playerNameInput) {
            // Get current name from user session
            let currentName = '';
            try {
                const userSession = localStorage.getItem('playerName');
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
            this.roomLocked = gameState.isLocked || false;
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
            if (window.notificationManager) {
                window.notificationManager.playerJoined(data.playerName);
            } else {
                this.showNotification(`${data.playerName} joined the game`, 'success');
            }
        });

        this.socket.on('player-left', (data) => {
            console.log('Player left:', data);
            if (window.notificationManager) {
                window.notificationManager.playerLeft(data.playerName);
            } else {
                this.showNotification(`${data.playerName} left the game`, 'warning');
            }
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

        this.socket.on('room-locked', (data) => {
            console.log('Room locked:', data);
            this.roomLocked = true;
            if (window.notificationManager) {
                window.notificationManager.roomLocked(data.lockedBy);
            } else {
                this.showNotification(`Room locked by ${data.lockedBy}`, 'warning');
            }
        });

        this.socket.on('room-unlocked', (data) => {
            console.log('Room unlocked:', data);
            this.roomLocked = false;
            if (window.notificationManager) {
                window.notificationManager.roomUnlocked(data.unlockedBy);
            } else {
                this.showNotification(`Room unlocked by ${data.unlockedBy}`, 'success');
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showNotification('Disconnected from server', 'error');
        });

        this.socket.on('reconnect', () => {
            console.log('Reconnected to server');
            this.showNotification('Reconnected to server', 'success');
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
        
        // Store the player name using existing session system
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
            // Clean up
            if (window.chatManager) {
                window.chatManager.disconnect();
            }
            if (this.gameTimer) {
                clearInterval(this.gameTimer);
            }
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
                case 'gameStart':
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

    showNotification(message, type = 'info', options = {}) {
        // Use advanced notification manager if available
        if (window.notificationManager) {
            const notificationOptions = {
                category: this.gameType,
                ...options
            };
            
            switch (type) {
                case 'success':
                    return window.notificationManager.success(message, notificationOptions);
                case 'error':
                    return window.notificationManager.error(message, notificationOptions);
                case 'warning':
                    return window.notificationManager.warning(message, notificationOptions);
                case 'info':
                default:
                    return window.notificationManager.info(message, notificationOptions);
            }
        }

        // Fallback notification system
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
        console.log(reactionData);
    
        // Create floating reaction animation container
        const reaction = document.createElement('div');
        reaction.innerHTML = `
            <div>${reactionData.reaction}</div>
            <div style="font-size: 1rem; opacity: 0.8;">${reactionData.playerName}</div>
        `;
    
        // Apply enhanced inline styles
        reaction.style.cssText = `
            position: fixed;
            font-size: 1.8rem;
            color: #667eea;
            border-radius: 1.5rem;
            padding: 0.5rem 1rem;
            z-index: 1000;
            pointer-events: none;
            text-align: center;
            line-height: 1.4;
            animation: reactionFloat 2s ease-out forwards;
            left: ${Math.random() * 80 + 10}%;
            top: 60%;
            transform: translateX(-50%);
        `;
    
        // Add animation CSS if not already present
        if (!document.getElementById('reaction-styles')) {
            const style = document.createElement('style');
            style.id = 'reaction-styles';
            style.textContent = `
                @keyframes reactionFloat {
                    0% {
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: translateY(-60px) scale(1.2);
                        opacity: 0.9;
                    }
                    100% {
                        transform: translateY(-120px) scale(1.4);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    
        document.body.appendChild(reaction);
    
        // Remove element after animation
        setTimeout(() => {
            if (reaction.parentNode) {
                reaction.parentNode.removeChild(reaction);
            }
        }, 2000);
    
        // Show notification
        this.showNotification(`${reactionData.playerName} reacted with ${reactionData.reaction}`, 'info');
    }
    

    // Room locking functionality
    isRoomLocked() {
        return this.roomLocked;
    }

    requestRoomLock() {
        if (this.socket) {
            this.socket.emit('lock-room', this.roomId);
        }
    }

    requestRoomUnlock() {
        if (this.socket) {
            this.socket.emit('unlock-room', this.roomId);
        }
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts if not typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'r':
                case 'R':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.resetGame();
                    }
                    break;
                case 'l':
                case 'L':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.leaveGame();
                    }
                    break;
                case 'm':
                case 'M':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleGameNotifications();
                    }
                    break;
                case 's':
                case 'S':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.showSettingsModal();
                    }
                    break;
                case 'Escape':
                    // Close any open modals
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.style.display = 'none';
                    });
                    break;
            }
        });
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        this.performanceStats = {
            frameCount: 0,
            lastFrameTime: performance.now(),
            fps: 0,
            memoryUsage: 0
        };

        const updateStats = () => {
            const now = performance.now();
            this.performanceStats.frameCount++;
            
            if (now - this.performanceStats.lastFrameTime >= 1000) {
                this.performanceStats.fps = this.performanceStats.frameCount;
                this.performanceStats.frameCount = 0;
                this.performanceStats.lastFrameTime = now;
                
                // Update memory usage if available
                if (performance.memory) {
                    this.performanceStats.memoryUsage = Math.round(
                        performance.memory.usedJSHeapSize / 1024 / 1024
                    );
                }
                
                this.updatePerformanceDisplay();
            }
            
            requestAnimationFrame(updateStats);
        };
        
        requestAnimationFrame(updateStats);
    }

    updatePerformanceDisplay() {
        const perfDisplay = document.getElementById('performance-display');
        if (perfDisplay) {
            perfDisplay.innerHTML = `
                FPS: ${this.performanceStats.fps} | 
                Memory: ${this.performanceStats.memoryUsage}MB
            `;
        }
    }

    createPerformanceDisplay() {
        if (document.getElementById('performance-display')) return;
        
        const perfDisplay = document.createElement('div');
        perfDisplay.id = 'performance-display';
        perfDisplay.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-family: monospace;
            z-index: 9999;
            display: none;
        `;
        document.body.appendChild(perfDisplay);
    }

    togglePerformanceDisplay() {
        const perfDisplay = document.getElementById('performance-display');
        if (perfDisplay) {
            perfDisplay.style.display = perfDisplay.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Connection quality monitoring
    monitorConnection() {
        if (!this.socket) return;
        
        this.connectionStats = {
            ping: 0,
            quality: 'good'
        };
        
        const pingInterval = setInterval(() => {
            if (!this.socket.connected) {
                clearInterval(pingInterval);
                return;
            }
            
            const start = Date.now();
            this.socket.emit('ping', start);
            
            this.socket.once('pong', (timestamp) => {
                this.connectionStats.ping = Date.now() - timestamp;
                
                if (this.connectionStats.ping < 100) {
                    this.connectionStats.quality = 'excellent';
                } else if (this.connectionStats.ping < 250) {
                    this.connectionStats.quality = 'good';
                } else if (this.connectionStats.ping < 500) {
                    this.connectionStats.quality = 'fair';
                } else {
                    this.connectionStats.quality = 'poor';
                }
                
                this.updateConnectionDisplay();
            });
        }, 5000);
    }

    updateConnectionDisplay() {
        const connDisplay = document.getElementById('connection-display');
        if (connDisplay) {
            const color = {
                excellent: '#4CAF50',
                good: '#8BC34A',
                fair: '#FF9800',
                poor: '#F44336'
            }[this.connectionStats.quality];
            
            connDisplay.innerHTML = `
                <span style="color: ${color}">
                    ${this.connectionStats.ping}ms (${this.connectionStats.quality})
                </span>
            `;
        }
    }

    // Cleanup method
    destroy() {
        // Stop timers
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Clean up chat
        if (window.chatManager) {
            window.chatManager.disconnect();
        }
        
        console.log('BaseGameManager destroyed');
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

// Initialize keyboard shortcuts and performance monitoring when ready
document.addEventListener('DOMContentLoaded', () => {
    // Add global styles for enhanced features
    const style = document.createElement('style');
    style.textContent = `
        .notification-controls {
            margin: 10px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }

        .notification-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn-mute, .btn-clear {
            padding: 6px 12px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }

        .btn-mute:hover, .btn-clear:hover {
            background: #f5f5f5;
        }

        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }

        .modal-content {
            background: white;
            border-radius: 8px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
        }

        .modal-footer {
            border-top: 1px solid #eee;
            text-align: right;
        }

        .setting-group {
            margin-bottom: 15px;
        }

        .setting-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .setting-group input[type="range"] {
            width: 100%;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #999;
        }

        .modal-close:hover {
            color: #333;
        }

        @media (max-width: 768px) {
            .notification-buttons {
                flex-direction: column;
            }
            
            .modal-content {
                margin: 10px;
                max-width: calc(100% - 20px);
            }
        }
    `;
    document.head.appendChild(style);
});

// Global cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.gameManager && typeof window.gameManager.destroy === 'function') {
        window.gameManager.destroy();
    }
});