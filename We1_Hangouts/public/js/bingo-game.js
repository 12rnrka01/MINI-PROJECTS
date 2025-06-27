// public/js/bingo-game.js - BINGO Client-Side Game Logic

class BingoGame extends BaseGameManager {
    constructor() {
        super('bingo', window.currentRoomId);
        this.boardSize = window.currentBoardSize || 'medium';
        this.gridSize = { small: 3, medium: 5, large: 7 }[this.boardSize];
        this.numberRange = { 
            small: { min: 1, max: 25 },
            medium: { min: 1, max: 75 },
            large: { min: 1, max: 100 }
        }[this.boardSize];
        this.isCaller = false;
        this.calledNumbers = [];
        this.myBoard = [];
        this.winners = [];
        this.autoCallEnabled = false;
        
        this.initializeBingo();
    }

    initializeBingo() {
        console.log(`Initializing BINGO game with ${this.boardSize} board (${this.gridSize}x${this.gridSize})`);
        
        // Initialize number caller if user is caller
        this.setupNumberCaller();
        
        // Setup auto-call controls
        this.setupAutoCallControls();
        
        // Setup board size display
        this.updateBoardSizeDisplay();
        
        console.log('BINGO game initialized');
    }

    onGameStateUpdate(gameState) {
        console.log('BINGO - updating game state:', gameState);
        
        this.updatePlayersDisplay();
        this.updateGameStatus();
        this.updateBingoBoard();
        this.updateCalledNumbers();
        this.updateCallerDisplay();
        this.updateGameStats();
    }

    setupNumberCaller() {
        const numberGrid = document.getElementById('number-caller-grid');
        const callNumberBtn = document.getElementById('call-random-number');
        const autoCallToggle = document.getElementById('auto-call-toggle');
        
        if (numberGrid) {
            // Create number buttons for manual calling
            numberGrid.innerHTML = '';
            
            for (let i = this.numberRange.min; i <= this.numberRange.max; i++) {
                const numberBtn = document.createElement('button');
                numberBtn.className = 'number-btn';
                numberBtn.textContent = i;
                numberBtn.dataset.number = i;
                numberBtn.addEventListener('click', () => this.callNumber(i));
                numberGrid.appendChild(numberBtn);
            }
        }
        
        if (callNumberBtn) {
            callNumberBtn.addEventListener('click', () => this.callRandomNumber());
        }
        
        if (autoCallToggle) {
            autoCallToggle.addEventListener('click', () => this.toggleAutoCall());
        }
    }

    setupAutoCallControls() {
        const autoCallSection = document.getElementById('auto-call-section');
        const autoCallStatus = document.getElementById('auto-call-status');
        
        // Initially hide auto-call controls (shown only for caller)
        if (autoCallSection) {
            autoCallSection.style.display = 'none';
        }
    }

    updateBoardSizeDisplay() {
        const boardSizeElement = document.getElementById('board-size-display');
        if (boardSizeElement) {
            const sizeNames = { small: '3×3', medium: '5×5', large: '7×7' };
            boardSizeElement.textContent = `Board Size: ${sizeNames[this.boardSize]}`;
        }
    }

    callNumber(number) {
        if (!this.gameState || this.gameState.gameStatus !== 'playing') {
            this.showNotification("Game is not active!", 'warning');
            return;
        }

        if (!this.isCaller) {
            this.showNotification("Only the caller can call numbers!", 'warning');
            return;
        }

        if (this.calledNumbers.includes(number)) {
            this.showNotification("Number already called!", 'warning');
            return;
        }

        console.log(`Calling number: ${number}`);
        this.socket.emit('call-number', this.roomId, number);
        this.playSound('move');
    }

    callRandomNumber() {
        if (!this.gameState || this.gameState.gameStatus !== 'playing') {
            this.showNotification("Game is not active!", 'warning');
            return;
        }

        if (!this.isCaller) {
            this.showNotification("Only the caller can call numbers!", 'warning');
            return;
        }

        // Get available numbers
        const availableNumbers = [];
        for (let i = this.numberRange.min; i <= this.numberRange.max; i++) {
            if (!this.calledNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }

        if (availableNumbers.length === 0) {
            this.showNotification("No more numbers to call!", 'info');
            return;
        }

        const randomNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
        this.callNumber(randomNumber);
    }

    toggleAutoCall() {
        if (!this.isCaller) {
            this.showNotification("Only the caller can toggle auto-call!", 'warning');
            return;
        }

        this.socket.emit('toggle-auto-call', this.roomId);
    }

    updatePlayersDisplay() {
        if (!this.gameState || !this.gameState.players) return;

        console.log('BINGO - Updating players display:', this.gameState.players);

        // Update players list
        const playersList = document.getElementById('players-list');
        if (playersList) {
            playersList.innerHTML = '';
            
            this.gameState.players.forEach((player, index) => {
                const playerCard = document.createElement('div');
                playerCard.className = 'bingo-player-card';
                playerCard.innerHTML = `
                    <div class="player-header">
                        <span class="player-name">${player.name}</span>
                        ${player.hasWon ? '<span class="winner-badge">🏆 WINNER</span>' : ''}
                        ${player.id === this.gameState.currentCaller ? '<span class="caller-badge">📢 CALLER</span>' : ''}
                    </div>
                    <div class="player-stats">
                        <small>Wins: ${player.stats?.wins || 0}</small>
                    </div>
                `;
                
                // Highlight current player
                if (player.id === this.socket.id) {
                    playerCard.classList.add('current-player');
                    this.playerData = player;
                    this.myBoard = player.board;
                    this.isCaller = (player.id === this.gameState.currentCaller);
                }
                
                playersList.appendChild(playerCard);
            });
        }

        // Update players count
        const playersCountElement = document.getElementById('players-count');
        if (playersCountElement) {
            playersCountElement.textContent = ` ${this.gameState.players.length}/${this.gameState.maxPlayers} players`;
        }
    }

    updateGameStatus() {
        if (!this.gameState) return;

        console.log('BINGO - Updating game status:', {
            gameStatus: this.gameState.gameStatus,
            playersCount: this.gameState.players?.length || 0,
            isCaller: this.isCaller
        });

        const statusElement = document.getElementById('status-text');
        let statusText = '';
        
        switch (this.gameState.gameStatus) {
            case 'waiting':
                statusText = `Waiting for players... (${this.gameState.players?.length || 0}/${this.gameState.maxPlayers})`;
                break;
            case 'playing':
                const callerName = this.gameState.players.find(p => p.id === this.gameState.currentCaller)?.name || 'Unknown';
                statusText = this.isCaller ? "You are the caller! Call numbers for others." : `${callerName} is calling numbers`;
                break;
            case 'finished':
                statusText = `Game finished! ${this.gameState.winners?.length || 0} winner(s)`;
                break;
            default:
                statusText = 'Game Status Unknown';
        }
        
        if (statusElement) {
            statusElement.textContent = statusText;
        }

        // Show/hide caller controls
        this.updateCallerControls();
    }

    updateCallerControls() {
        const callerSection = document.getElementById('caller-section');
        const autoCallSection = document.getElementById('auto-call-section');
        
        if (callerSection) {
            callerSection.style.display = this.isCaller ? 'block' : 'none';
        }
        
        if (autoCallSection) {
            autoCallSection.style.display = this.isCaller ? 'block' : 'none';
        }
    }

    updateCallerDisplay() {
        if (!this.gameState) return;
        
        const callerDisplay = document.getElementById('current-caller');
        if (callerDisplay) {
            const caller = this.gameState.players.find(p => p.id === this.gameState.currentCaller);
            callerDisplay.textContent = caller ? `Current Caller: ${caller.name}` : 'No caller assigned';
        }
    }

    updateBingoBoard() {
        if (!this.myBoard || this.myBoard.length === 0) return;

        const boardElement = document.getElementById('bingo-board');
        if (!boardElement) return;

        boardElement.innerHTML = '';
        boardElement.className = `bingo-board bingo-board-${this.boardSize}`;
        
        this.myBoard.forEach((cell, index) => {
            const cellElement = document.createElement('div');
            cellElement.className = 'bingo-cell';
            cellElement.dataset.index = index;
            
            if (cell.number === 'FREE') {
                cellElement.classList.add('free-space');
                cellElement.innerHTML = '<span>FREE</span>';
            } else {
                cellElement.textContent = cell.number;
            }
            
            if (cell.marked) {
                cellElement.classList.add('marked');
                if (cell.markedBy && cell.markedBy !== this.socket.id) {
                    cellElement.classList.add('marked-by-other');
                }
            }
            
            // Add click handler for manual marking (visual only)
            cellElement.addEventListener('click', () => {
                if (cell.marked && cell.number !== 'FREE') {
                    this.showCellInfo(cell, index);
                }
            });
            
            boardElement.appendChild(cellElement);
        });
    }

    showCellInfo(cell, index) {
        if (cell.marked) {
            const markerName = this.gameState.players.find(p => p.id === cell.markedBy)?.name || 'Unknown';
            const timestamp = new Date(cell.timestamp).toLocaleTimeString();
            this.showNotification(`Number ${cell.number} marked by ${markerName} at ${timestamp}`, 'info');
        }
    }

    updateCalledNumbers() {
        if (!this.gameState) return;
        
        this.calledNumbers = this.gameState.calledNumbers || [];
        
        const calledNumbersList = document.getElementById('called-numbers-list');
        const calledCount = document.getElementById('called-count');
        const lastCalledElement = document.getElementById('last-called-number');
        
        if (calledNumbersList) {
            calledNumbersList.innerHTML = '';
            
            // Show last 10 called numbers
            const recentNumbers = this.calledNumbers.slice(-10).reverse();
            recentNumbers.forEach(number => {
                const numberElement = document.createElement('span');
                numberElement.className = 'called-number';
                numberElement.textContent = number;
                calledNumbersList.appendChild(numberElement);
            });
        }
        
        if (calledCount) {
            const totalNumbers = this.numberRange.max - this.numberRange.min + 1;
            calledCount.textContent = `${this.calledNumbers.length}/${totalNumbers}`;
        }
        
        if (lastCalledElement && this.gameState.lastCalledNumber) {
            lastCalledElement.textContent = this.gameState.lastCalledNumber.number;
            lastCalledElement.className = 'last-called-number highlight';
            
            // Remove highlight after animation
            setTimeout(() => {
                lastCalledElement.classList.remove('highlight');
            }, 2000);
        }
        
        // Update number caller buttons
        this.updateNumberCallerButtons();
    }

    updateNumberCallerButtons() {
        const numberButtons = document.querySelectorAll('.number-btn');
        numberButtons.forEach(btn => {
            const number = parseInt(btn.dataset.number);
            btn.classList.toggle('called', this.calledNumbers.includes(number));
            btn.disabled = this.calledNumbers.includes(number) || !this.isCaller;
        });
    }

    updateGameStats() {
        // This would be called when 'game-stats' event is received
        // Implementation depends on what stats you want to show
    }

    // Handle socket events specific to BINGO
    initializeSocket() {
        super.initializeSocket();
        
        // BINGO-specific socket events
        this.socket.on('number-called', (data) => {
            console.log('Number called:', data);
            this.onNumberCalled(data);
        });
        
        this.socket.on('bingo-winners', (data) => {
            console.log('BINGO winners:', data);
            this.onBingoWinners(data);
        });
        
        this.socket.on('auto-call-toggled', (data) => {
            console.log('Auto-call toggled:', data);
            this.onAutoCallToggled(data);
        });
        
        this.socket.on('caller-changed', (data) => {
            console.log('Caller changed:', data);
            this.onCallerChanged(data);
        });
        
        this.socket.on('game-stats', (stats) => {
            console.log('Game stats:', stats);
            this.displayGameStats(stats);
        });
    }

    onNumberCalled(data) {
        // Show number called notification
        const message = data.isAuto ? 
            `Auto-caller called ${data.number}` : 
            `${data.calledBy} called ${data.number}`;
        
        this.showNotification(message, 'info');
        
        // Play sound
        this.playSound('move');
        
        // Show marked players if any
        if (data.markedPlayers && data.markedPlayers.length > 0) {
            setTimeout(() => {
                this.showNotification(`Marked by: ${data.markedPlayers.join(', ')}`, 'success');
            }, 1000);
        }
        
        // Highlight the called number briefly
        this.highlightCalledNumber(data.number);
    }

    highlightCalledNumber(number) {
        // Highlight on board
        const boardCells = document.querySelectorAll('.bingo-cell');
        boardCells.forEach(cell => {
            if (cell.textContent == number) {
                cell.classList.add('just-called');
                setTimeout(() => {
                    cell.classList.remove('just-called');
                }, 3000);
            }
        });
        
        // Highlight in caller grid
        const callerBtn = document.querySelector(`[data-number="${number}"]`);
        if (callerBtn) {
            callerBtn.classList.add('just-called');
            setTimeout(() => {
                callerBtn.classList.remove('just-called');
            }, 3000);
        }
    }

    onBingoWinners(data) {
        console.log('BINGO! Winners announced:', data.winners);
        
        this.winners = data.winners;
        
        // Show winners notification
        const winnerNames = data.winners.map(w => w.playerName).join(', ');
        this.showNotification(`🎉 BINGO! Winners: ${winnerNames}`, 'success');
        
        // Play victory sound
        this.playSound('win');
        
        // Show winner popup
        this.showWinnerPopup(data.winners);
        
        // Update display
        this.updatePlayersDisplay();
    }

    showWinnerPopup(winners) {
        const popup = document.createElement('div');
        popup.className = 'winner-popup';
        popup.innerHTML = `
            <div class="winner-content">
                <h2>🎉 BINGO! 🎉</h2>
                <div class="winners-list">
                    ${winners.map(winner => `
                        <div class="winner-item">
                            <strong>${winner.playerName}</strong>
                            <span class="win-type">${winner.winType}</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.parentElement.removeChild(popup);
            }
        }, 10000);
    }

    onAutoCallToggled(data) {
        this.autoCallEnabled = data.enabled;
        
        const autoCallToggle = document.getElementById('auto-call-toggle');
        const autoCallStatus = document.getElementById('auto-call-status');
        
        if (autoCallToggle) {
            autoCallToggle.textContent = data.enabled ? 'Stop Auto-Call' : 'Start Auto-Call';
            autoCallToggle.classList.toggle('active', data.enabled);
        }
        
        if (autoCallStatus) {
            autoCallStatus.textContent = data.enabled ? 'Auto-calling enabled' : 'Manual calling';
            autoCallStatus.classList.toggle('active', data.enabled);
        }
        
        this.showNotification(
            `Auto-call ${data.enabled ? 'started' : 'stopped'} by ${data.toggledBy}`, 
            'info'
        );
    }

    onCallerChanged(data) {
        this.showNotification(`${data.newCaller} is now the caller`, 'info');
        
        if (data.reason) {
            this.showNotification(data.reason, 'warning');
        }
    }

    displayGameStats(stats) {
        const statsElement = document.getElementById('game-stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Players:</span>
                    <span class="stat-value">${stats.totalPlayers}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Numbers Called:</span>
                    <span class="stat-value">${stats.numbersHadCalled}/${stats.totalNumbers}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Progress:</span>
                    <span class="stat-value">${stats.calledPercentage}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Winners:</span>
                    <span class="stat-value">${stats.winners}</span>
                </div>
            `;
        }
    }

    // Implementation of abstract methods from BaseGameManager
    isCurrentPlayerWinner(winner) {
        return this.winners.some(w => w.playerId === this.socket.id);
    }

    getWinnerName(winner) {
        return winner.playerName || 'Unknown';
    }

    getWinnerColor(winner) {
        return '#4CAF50'; // Green for BINGO winners
    }

    joinGame(playerName) {
        if (!playerName || playerName.trim().length === 0) {
            this.showNotification('Please enter a valid name', 'error');
            return;
        }

        console.log(`[BINGO] Attempting to join room ${this.roomId} with name: ${playerName} and board size: ${this.boardSize}`);
        
        // Send board size along with join request
        this.socket.emit('join-room', this.roomId, playerName.trim(), 'bingo', this.boardSize);
        
        this.savePlayerNameToSession(playerName.trim());
        this.showNotification(`Joining BINGO game as ${playerName}...`, 'info');
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentGameType === 'bingo') {
        window.bingoGame = new BingoGame();
    }
});