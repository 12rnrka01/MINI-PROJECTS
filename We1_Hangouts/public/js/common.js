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
    const gameType = getURLPathSegment(1);
    window.location.href = `/games/${gameType}/${roomId}`;
}
function getURLPathSegment(index) {
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    return pathSegments[index]; // index 0 = 'games', index 1 = 'chess', etc.
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
            debugger
            const volume = e.target.value;
            localStorage.setItem('gameVolume', volume);
            
            // Update game instances if they exist
            if (window.ticTacToeGame) {
                window.ticTacToeGame.volume = volume / 100;
            }
            if (window.connect4Game) {
                window.connect4Game.volume = volume / 100;
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