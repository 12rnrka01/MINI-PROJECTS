// public/js/common.js - Common utilities and functions

// Global utility functions
window.GameUtils = {
    // Generate random room ID
    generateRoomId: function() {
        return 'ROOM_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    },

    // Copy text to clipboard
    copyToClipboard: function(text) {
        return navigator.clipboard.writeText(text);
    },

    // Format time
    formatTime: function(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    // Player name management - integrates with existing gameHub_user_session
    getStoredPlayerName: function() {
        try {
            // Try to get from existing gameHub_user_session first
            const userSession = localStorage.getItem('gameHub_user_session');
            if (userSession) {
                const sessionData = JSON.parse(userSession);
                return sessionData.username || sessionData.name || sessionData.playerName || '';
            }
        } catch (e) {
            console.log('Could not parse user session');
        }
        
        // Fallback to simple playerName storage
        return localStorage.getItem('playerName') || '';
    },

    setStoredPlayerName: function(name) {
        if (name && name.trim().length > 0) {
            const playerName = name.trim();
            
            try {
                // Update existing gameHub_user_session
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
            } catch (e) {
                console.warn('Could not update user session:', e);
            }
            
            // Also store as simple fallback
            localStorage.setItem('playerName', playerName);
        }
    },

    clearStoredPlayerName: function() {
        try {
            // Clear from gameHub_user_session
            const userSession = localStorage.getItem('gameHub_user_session');
            if (userSession) {
                const sessionData = JSON.parse(userSession);
                delete sessionData.username;
                delete sessionData.name;
                delete sessionData.playerName;
                localStorage.setItem('gameHub_user_session', JSON.stringify(sessionData));
            }
        } catch (e) {
            console.warn('Could not clear user session:', e);
        }
        
        // Also clear simple storage
        localStorage.removeItem('playerName');
    },

    // Sound management
    playSound: function(soundType, volume = 0.3) {
        // Basic sound implementation
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            gainNode.gain.value = volume;
            
            switch(soundType) {
                case 'move':
                    oscillator.frequency.value = 800;
                    oscillator.type = 'square';
                    break;
                case 'win':
                    oscillator.frequency.value = 1200;
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
        }
    }
};

// Global quick room creation function
function createQuickRoom() {
    const roomId = window.GameUtils.generateRoomId();
    window.location.href = `/games/tictactoe/${roomId}`;
}

// Sound control functionality
document.addEventListener('DOMContentLoaded', function() {
    // Sound toggle functionality
    const soundToggle = document.getElementById('sound-toggle');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (soundToggle) {
        let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        updateSoundButton(soundEnabled);
        
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('soundEnabled', soundEnabled);
            updateSoundButton(soundEnabled);
            
            // Update game instances if they exist
            if (window.ticTacToeGame) {
                window.ticTacToeGame.soundEnabled = soundEnabled;
            }
            if (window.connect4Game) {
                window.connect4Game.soundEnabled = soundEnabled;
            }
            if (window.bingoGame) {
                window.bingoGame.soundEnabled = soundEnabled;
            }
            if (window.dotsLinesGame) {
                window.dotsLinesGame.soundEnabled = soundEnabled;
            }
        });
        
        function updateSoundButton(enabled) {
            soundToggle.textContent = enabled ? '🔊' : '🔇';
            if (volumeSlider) {
                volumeSlider.style.opacity = enabled ? '1' : '0.5';
            }
        }
    }
    
    if (volumeSlider) {
        const volume = localStorage.getItem('gameVolume') || 30;
        volumeSlider.value = volume;
        
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value;
            localStorage.setItem('gameVolume', volume);
            
            // Update game instances if they exist
            if (window.ticTacToeGame) {
                window.ticTacToeGame.volume = volume / 100;
            }
            if (window.connect4Game) {
                window.connect4Game.volume = volume / 100;
            }
            if (window.bingoGame) {
                window.bingoGame.volume = volume / 100;
            }
            if (window.dotsLinesGame) {
                window.dotsLinesGame.volume = volume / 100;
            }
        });
    }
});

// Error handling for missing elements
window.addEventListener('error', function(e) {
    console.warn('Non-critical error:', e.message);
});

// Prevent common errors from breaking the page
window.addEventListener('unhandledrejection', function(e) {
    console.warn('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});