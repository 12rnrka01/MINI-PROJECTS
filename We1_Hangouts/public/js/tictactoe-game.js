// public/js/tictactoe-game.js - Tic-Tac-Toe specific game logic

class TicTacToeGame extends BaseGameManager {
    constructor() {
        super('tictactoe', window.currentRoomId);
        this.initializeTicTacToe();
    }

    initializeTicTacToe() {
        // Bind cell click events
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.makeMove(index);
            });
        });
    }

    onGameStateUpdate(gameState) {
        this.updatePlayersDisplay();
        this.updateGameStatus();
        this.updateGameBoard();
    }

    makeMove(cellIndex) {
        if (!this.gameState || this.gameState.gameStatus !== 'playing') {
            return;
        }

        if (!this.playerData || this.playerData.symbol !== this.gameState.currentPlayer) {
            this.showNotification("It's not your turn!", 'warning');
            return;
        }

        if (this.gameState.board[cellIndex] !== null) {
            this.showNotification("Cell is already taken!", 'error');
            return;
        }

        this.socket.emit('make-move', this.roomId, cellIndex);
        this.playSound('move');
    }

    updatePlayersDisplay() {
        if (!this.gameState || !this.gameState.players) return;

        this.gameState.players.forEach(player => {
            const playerCard = document.getElementById(`player-${player.symbol.toLowerCase()}`);
            
            if (playerCard) {
                const nameElement = playerCard.querySelector('.player-name');
                if (nameElement) {
                    nameElement.textContent = player.name;
                }
                
                // Highlight current player
                if (player.symbol === this.gameState.currentPlayer) {
                    playerCard.classList.add('current-player');
                } else {
                    playerCard.classList.remove('current-player');
                }

                // Store player data if this is the current user
                if (player.id === this.socket.id) {
                    this.playerData = player;
                }
            }
        });

        // Update players count
        const playersCountElement = document.getElementById('players-count');
        if (playersCountElement) {
            playersCountElement.textContent = ` ${this.gameState.players.length}/2 players`;
        }
    }

    updateGameStatus() {
        if (!this.gameState) return;

        const statusElement = document.getElementById('status-text');
        
        if (statusElement) {
            switch (this.gameState.gameStatus) {
                case 'waiting':
                    statusElement.textContent = 'Waiting for players...';
                    break;
                case 'playing':
                    const currentPlayerName = this.gameState.players.find(p => p.symbol === this.gameState.currentPlayer)?.name || 'Unknown';
                    const isMyTurn = this.playerData && this.playerData.symbol === this.gameState.currentPlayer;
                    statusElement.textContent = isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`;
                    break;
                case 'finished':
                    if (this.gameState.winner === 'tie') {
                        statusElement.textContent = "It's a tie!";
                    } else {
                        const winnerName = this.gameState.players.find(p => p.symbol === this.gameState.winner)?.name || 'Unknown';
                        statusElement.textContent = `${winnerName} wins!`;
                    }
                    break;
            }
        }

        // Start/stop game timer
        if (this.gameState.gameStatus === 'playing' && !this.gameStartTime) {
            this.gameStartTime = Date.now();
            this.startGameTimer();
        } else if (this.gameState.gameStatus !== 'playing') {
            this.stopGameTimer();
        }
    }

    updateGameBoard() {
        if (!this.gameState) return;

        const cells = document.querySelectorAll('.cell');
        
        cells.forEach((cell, index) => {
            const value = this.gameState.board[index];
            
            // Clear previous classes
            cell.classList.remove('x', 'o', 'winning');
            cell.textContent = '';
            
            if (value === 'X') {
                cell.classList.add('x');
                cell.textContent = 'X';
            } else if (value === 'O') {
                cell.classList.add('o');
                cell.textContent = 'O';
            }
        });

        // Highlight winning line if game is over
        if (this.gameState.gameStatus === 'finished' && this.gameState.winningLine) {
            this.gameState.winningLine.forEach(index => {
                cells[index].classList.add('winning');
            });
        }
    }

    updatePlayerStats(players) {
        players.forEach(player => {
            const statsElement = document.getElementById(`stats-${player.symbol.toLowerCase()}`);
            if (statsElement && player.stats) {
                const stats = player.stats;
                
                statsElement.querySelector('.wins').textContent = stats.wins;
                statsElement.querySelector('.losses').textContent = stats.losses;
                statsElement.querySelector('.ties').textContent = stats.ties;
                statsElement.querySelector('.current-streak').textContent = stats.currentStreak;

                // Show/hide streak display
                const streakDisplay = document.getElementById(`streak-display-${player.symbol.toLowerCase()}`);
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
        return this.playerData && this.playerData.symbol === winner;
    }

    getWinnerName(winner) {
        if (!this.gameState || !this.gameState.players) return 'Unknown';
        return this.gameState.players.find(p => p.symbol === winner)?.name || 'Unknown';
    }

    getWinnerColor(winner) {
        return winner === 'X' ? '#4CAF50' : '#2196F3';
    }

    // Tic-Tac-Toe specific sound method
    playSound(type) {
        if (!this.soundEnabled) return;

        try {
            // Use the common sound utility if available
            if (window.GameUtils && window.GameUtils.playSound) {
                window.GameUtils.playSound(type, this.volume || 0.3);
                return;
            }

            // Fallback Tic-Tac-Toe specific sounds
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            gainNode.gain.value = this.volume || 0.3;
            
            switch (type) {
                case 'move':
                    // Tic-Tac-Toe click sound
                    oscillator.frequency.value = 600;
                    oscillator.type = 'square';
                    break;
                case 'win':
                    // Victory sound
                    oscillator.frequency.value = 1000;
                    oscillator.type = 'sine';
                    break;
                case 'gameOver':
                    // Game over sound
                    oscillator.frequency.value = 500;
                    oscillator.type = 'triangle';
                    break;
                case 'newGame':
                    // New game sound
                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
                    break;
                case 'error':
                    // Error sound (cell taken)
                    oscillator.frequency.value = 250;
                    oscillator.type = 'sawtooth';
                    break;
                default:
                    oscillator.frequency.value = 500;
                    oscillator.type = 'sine';
            }
            
            oscillator.start();
            oscillator.stop(context.currentTime + 0.15);
        } catch (e) {
            // Silent fail for audio
            console.warn('Audio not supported:', e);
        }
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentGameType === 'tictactoe') {
        window.ticTacToeGame = new TicTacToeGame();
    }
});