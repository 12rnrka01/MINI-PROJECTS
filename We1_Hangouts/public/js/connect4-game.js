// public/js/connect4-game.js - Connect4 specific game logic

class Connect4Game extends BaseGameManager {
    constructor() {
        super('connect4', window.currentRoomId);
        this.initializeConnect4();
    }

    initializeConnect4() {
        // Column click events for dropping discs
        document.querySelectorAll('.connect4-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = parseInt(e.currentTarget.getAttribute('data-column'));
                this.makeMove(column);
            });
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '7') {
                const column = parseInt(e.key) - 1;
                this.makeMove(column);
            }
        });
    }

    onGameStateUpdate(gameState) {
        console.log('Connect4 - updating game state:', gameState);
        this.updateGameBoard();
        this.updatePlayersDisplay();
        this.updateGameStatus();
    }

    makeMove(column) {
        if (!this.gameState || this.gameState.gameStatus !== 'playing') {
            return;
        }

        if (!this.playerData || this.playerData.color !== this.gameState.currentPlayer) {
            this.showNotification("It's not your turn!", 'warning');
            return;
        }

        // Check if column is valid
        if (!this.isValidColumn(column)) {
            this.showNotification("Column is full!", 'error');
            return;
        }

        this.socket.emit('make-move', this.roomId, column);
        this.playSound('move');
    }

    isValidColumn(column) {
        if (!this.gameState || column < 0 || column >= 7) {
            return false;
        }
        
        // Check if top cell of column is empty
        const topCellIndex = column;
        return this.gameState.board[topCellIndex] === null;
    }

    updateGameBoard() {
        if (!this.gameState) return;

        const cells = document.querySelectorAll('.connect4-cell');
        
        cells.forEach((cell, index) => {
            const value = this.gameState.board[index];
            
            // Clear previous classes
            cell.classList.remove('red', 'yellow', 'winning', 'falling');
            
            if (value === 'red') {
                cell.classList.add('red');
            } else if (value === 'yellow') {
                cell.classList.add('yellow');
            }
        });

        // Highlight winning positions
        if (this.gameState.winningPositions && this.gameState.winningPositions.length > 0) {
            this.gameState.winningPositions.forEach(index => {
                cells[index].classList.add('winning');
            });
        }

        // Add falling animation to last move
        if (this.gameState.lastMove) {
            const lastMoveIndex = this.gameState.lastMove.row * 7 + this.gameState.lastMove.column;
            if (cells[lastMoveIndex]) {
                cells[lastMoveIndex].classList.add('falling');
            }
        }

        this.updateColumnStates();
    }

    updateColumnStates() {
        const columnBtns = document.querySelectorAll('.connect4-column-btn');
        
        columnBtns.forEach((btn, index) => {
            btn.classList.remove('disabled', 'red-turn', 'yellow-turn');
            
            if (this.gameState && this.gameState.gameStatus === 'playing') {
                if (!this.isValidColumn(index)) {
                    btn.classList.add('disabled');
                } else {
                    btn.classList.add(`${this.gameState.currentPlayer}-turn`);
                }
            } else {
                btn.classList.add('disabled');
            }
        });
    }

    updatePlayersDisplay() {
        if (!this.gameState || !this.gameState.players) {
            console.log('Connect4 - No game state or players yet');
            return;
        }

        console.log('Connect4 - Updating players display:', this.gameState.players);

        // Update player names and colors
        this.gameState.players.forEach((player, index) => {
            console.log(`Connect4 - Processing player: ${player.name} (${player.color})`);
            
            const playerCard = document.getElementById(`player-${player.color}`);
            if (playerCard) {
                const nameElement = playerCard.querySelector('.player-name');
                if (nameElement) {
                    nameElement.textContent = player.name;
                    console.log(`Connect4 - Updated ${player.color} player name to: ${player.name}`);
                } else {
                    console.warn(`Connect4 - Name element not found for player-${player.color}`);
                }
                
                // Highlight current player
                if (player.color === this.gameState.currentPlayer) {
                    playerCard.classList.add('current-player');
                } else {
                    playerCard.classList.remove('current-player');
                }

                // Store player data if this is the current user
                if (player.id === this.socket.id) {
                    this.playerData = player;
                    console.log('Connect4 - Set current player data:', this.playerData);
                }
            } else {
                console.warn(`Connect4 - Player card not found: player-${player.color}`);
            }
        });

        // Update players count
        const playersCountElement = document.getElementById('players-count');
        if (playersCountElement) {
            playersCountElement.textContent = ` ${this.gameState.players.length}/2 players`;
        }
    }

    updateGameStatus() {
        if (!this.gameState) {
            console.log('Connect4 - No game state in updateGameStatus');
            return;
        }

        console.log('Connect4 - Updating game status:', {
            gameStatus: this.gameState.gameStatus,
            currentPlayer: this.gameState.currentPlayer,
            playersCount: this.gameState.players?.length || 0
        });

        const statusElement = document.getElementById('connect4-current-player');
        const gameStatusElement = document.getElementById('status-text');
        
        let statusText = '';
        
        switch (this.gameState.gameStatus) {
            case 'waiting':
                statusText = `Waiting for players... (${this.gameState.players?.length || 0}/2)`;
                break;
            case 'playing':
                const currentPlayerObj = this.gameState.players.find(p => p.color === this.gameState.currentPlayer);
                const currentPlayerName = currentPlayerObj?.name || 'Unknown';
                const isMyTurn = this.playerData && this.playerData.color === this.gameState.currentPlayer;
                statusText = isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`;
                break;
            case 'finished':
                if (this.gameState.winner === 'draw') {
                    statusText = "It's a draw!";
                } else {
                    const winnerObj = this.gameState.players.find(p => p.color === this.gameState.winner);
                    const winnerName = winnerObj?.name || 'Unknown';
                    statusText = `${winnerName} wins!`;
                }
                break;
            default:
                statusText = 'Game Status Unknown';
        }
        
        console.log('Connect4 - Setting status text to:', statusText);
        
        if (statusElement) {
            statusElement.textContent = statusText;
        }

        if (gameStatusElement) {
            gameStatusElement.textContent = statusText;
        }

        // Start/stop game timer
        if (this.gameState.gameStatus === 'playing' && !this.gameStartTime) {
            this.gameStartTime = Date.now();
            this.startGameTimer();
        } else if (this.gameState.gameStatus !== 'playing') {
            this.stopGameTimer();
        }
    }

    updatePlayerStats(players) {
        players.forEach(player => {
            const statsElement = document.getElementById(`stats-${player.color}`);
            if (statsElement && player.stats) {
                const stats = player.stats;
                
                statsElement.querySelector('.wins').textContent = stats.wins;
                statsElement.querySelector('.losses').textContent = stats.losses;
                statsElement.querySelector('.ties').textContent = stats.ties;
                statsElement.querySelector('.current-streak').textContent = stats.currentStreak;

                // Show/hide streak display
                const streakDisplay = document.getElementById(`streak-display-${player.color}`);
                if (streakDisplay) {
                    if (stats.currentStreak >= 2) {
                        streakDisplay.style.display = 'block';
                        streakDisplay.querySelector('.streak-count').textContent = stats.currentStreak;
                    } else {
                        streakDisplay.style.display = 'none';
                    }
                }
            }
        });

        // Update session score
        this.updateSessionScore(players);
    }

    updateSessionScore(players) {
        if (players.length === 2) {
            const sessionScoreElement = document.getElementById('session-score');
            if (sessionScoreElement) {
                const player1Wins = players[0].stats.wins;
                const player2Wins = players[1].stats.wins;
                sessionScoreElement.textContent = `${player1Wins} - ${player2Wins}`;
            }
        }
    }

    // Implementation of abstract methods from BaseGameManager
    isCurrentPlayerWinner(winner) {
        return this.playerData && this.playerData.color === winner;
    }

    getWinnerName(winner) {
        if (!this.gameState || !this.gameState.players) return 'Unknown';
        return this.gameState.players.find(p => p.color === winner)?.name || 'Unknown';
    }

    getWinnerColor(winner) {
        return winner === 'red' ? '#f44336' : '#ffeb3b';
    }

    // Connect4-specific sound method
    playSound(type) {
        if (!this.soundEnabled) return;

        try {
            // Use the common sound utility if available
            if (window.GameUtils && window.GameUtils.playSound) {
                window.GameUtils.playSound(type, this.volume || 0.3);
                return;
            }

            // Fallback Connect4-specific sounds
            const audio = new Audio();
            switch (type) {
                case 'move':
                    // Connect4 disc drop sound
                    this.createTone(800, 0.1, 'square');
                    break;
                case 'win':
                    // Victory sound
                    this.createTone(1200, 0.3, 'sine');
                    break;
                case 'gameOver':
                    // Game over sound
                    this.createTone(600, 0.5, 'triangle');
                    break;
                case 'newGame':
                    // New game sound
                    this.createTone(1000, 0.2, 'sine');
                    break;
                case 'error':
                    // Error sound (column full)
                    this.createTone(300, 0.2, 'sawtooth');
                    break;
                default:
                    this.createTone(600, 0.1, 'sine');
            }
        } catch (e) {
            // Silent fail for audio
            console.warn('Audio not supported:', e);
        }
    }

    createTone(frequency, duration, type = 'sine') {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            gainNode.gain.value = this.volume || 0.3;
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            oscillator.start();
            oscillator.stop(context.currentTime + duration);
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentGameType === 'connect4') {
        window.connect4Game = new Connect4Game();
    }
});