// public/js/dotslines-game.js - Dots and Lines Client-Side Game Logic

class DotsLinesGame extends BaseGameManager {
    constructor() {
        super('dotslines', window.currentRoomId);
        this.gridSize = window.currentGridSize || 'medium';
        this.dotCount = { small: 3, medium: 4, large: 5, huge: 6 }[this.gridSize];
        this.isMyTurn = false;
        this.myPlayerIndex = -1;
        this.gameBoard = null;
        this.hoveredLine = null;
        this.scores = {};
        
        this.initializeDotsLines();
    }

    initializeDotsLines() {
        console.log(`Initializing Dots and Lines game with ${this.gridSize} grid (${this.dotCount}×${this.dotCount} dots)`);
        
        // Create the game board
        this.createGameBoard();
        
        // Setup event listeners
        this.setupBoardEventListeners();
        
        // Setup UI controls
        this.setupGameControls();
        
        // Update grid size display
        this.updateGridSizeDisplay();
        
        console.log('Dots and Lines game initialized');
    }

    createGameBoard() {
        const boardContainer = document.getElementById('dotslines-board');
        if (!boardContainer) {
            console.error('Board container not found');
            return;
        }

        boardContainer.innerHTML = '';
        boardContainer.className = `dotslines-board dotslines-grid-${this.gridSize}`;
        
        // Calculate board dimensions
        const cellSize = this.getCellSize();
        const dotSize = 8;
        const lineThickness = 4;
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', (this.dotCount - 1) * cellSize + dotSize * 2);
        svg.setAttribute('height', (this.dotCount - 1) * cellSize + dotSize * 2);
        svg.classList.add('game-svg');
        
        // Create dots
        for (let row = 0; row < this.dotCount; row++) {
            for (let col = 0; col < this.dotCount; col++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', col * cellSize + dotSize);
                dot.setAttribute('cy', row * cellSize + dotSize);
                dot.setAttribute('r', dotSize / 2);
                dot.classList.add('dot');
                svg.appendChild(dot);
            }
        }
        
        // Create horizontal line slots
        for (let row = 0; row < this.dotCount; row++) {
            for (let col = 0; col < this.dotCount - 1; col++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x1 = col * cellSize + dotSize + dotSize/2;
                const x2 = (col + 1) * cellSize + dotSize - dotSize/2;
                const y = row * cellSize + dotSize;
                
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y);
                line.setAttribute('stroke-width', lineThickness);
                line.classList.add('line-slot', 'horizontal-line');
                line.dataset.lineType = 'horizontal';
                line.dataset.row = row;
                line.dataset.col = col;
                
                svg.appendChild(line);
            }
        }
        
        // Create vertical line slots
        for (let row = 0; row < this.dotCount - 1; row++) {
            for (let col = 0; col < this.dotCount; col++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x = col * cellSize + dotSize;
                const y1 = row * cellSize + dotSize + dotSize/2;
                const y2 = (row + 1) * cellSize + dotSize - dotSize/2;
                
                line.setAttribute('x1', x);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke-width', lineThickness);
                line.classList.add('line-slot', 'vertical-line');
                line.dataset.lineType = 'vertical';
                line.dataset.row = row;
                line.dataset.col = col;
                
                svg.appendChild(line);
            }
        }
        
        // Create box areas (for score display)
        for (let row = 0; row < this.dotCount - 1; row++) {
            for (let col = 0; col < this.dotCount - 1; col++) {
                const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                box.setAttribute('x', col * cellSize + dotSize + 2);
                box.setAttribute('y', row * cellSize + dotSize + 2);
                box.setAttribute('width', cellSize - 4);
                box.setAttribute('height', cellSize - 4);
                box.classList.add('box-area');
                box.dataset.row = row;
                box.dataset.col = col;
                
                svg.appendChild(box);
                
                // Add text element for player initial
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', col * cellSize + dotSize + cellSize/2);
                text.setAttribute('y', row * cellSize + dotSize + cellSize/2);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.classList.add('box-text');
                text.dataset.row = row;
                text.dataset.col = col;
                
                svg.appendChild(text);
            }
        }
        
        boardContainer.appendChild(svg);
        this.gameBoard = svg;
    }

    getCellSize() {
        const sizes = { small: 80, medium: 70, large: 60, huge: 50 };
        return sizes[this.gridSize] || 70;
    }

    setupBoardEventListeners() {
        if (!this.gameBoard) return;
        
        // Add click listeners to line slots
        const lineSlots = this.gameBoard.querySelectorAll('.line-slot');
        lineSlots.forEach(line => {
            line.addEventListener('click', (e) => {
                this.handleLineClick(e);
            });
            
            line.addEventListener('mouseenter', (e) => {
                this.handleLineHover(e, true);
            });
            
            line.addEventListener('mouseleave', (e) => {
                this.handleLineHover(e, false);
            });
        });
    }

    handleLineClick(event) {
        if (!this.isMyTurn || !this.gameState || this.gameState.gameStatus !== 'playing') {
            this.showNotification("It's not your turn!", 'warning');
            return;
        }

        const lineType = event.target.dataset.lineType;
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);

        // Check if line is already drawn
        if (event.target.classList.contains('drawn')) {
            this.showNotification("Line already drawn!", 'warning');
            return;
        }

        console.log(`Drawing ${lineType} line at ${row},${col}`);
        
        // Send move to server
        this.socket.emit('draw-line', this.roomId, { lineType, row, col });
        this.playSound('move');
    }

    handleLineHover(event, isEntering) {
        if (!this.isMyTurn || !this.gameState || this.gameState.gameStatus !== 'playing') {
            return;
        }

        if (event.target.classList.contains('drawn')) {
            return;
        }

        if (isEntering) {
            event.target.classList.add('hover');
            this.hoveredLine = event.target;
        } else {
            event.target.classList.remove('hover');
            this.hoveredLine = null;
        }
    }

    setupGameControls() {
        // Reset game button
        const resetBtn = document.getElementById('reset-dots-game');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Start a new game? Current progress will be lost.')) {
                    this.socket.emit('reset-game', this.roomId);
                }
            });
        }

        // Hint button
        const hintBtn = document.getElementById('request-hint');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                if (this.isMyTurn) {
                    this.socket.emit('request-hint', this.roomId);
                } else {
                    this.showNotification("Hints only available on your turn!", 'info');
                }
            });
        }

        // Spectator toggle
        const spectatorBtn = document.getElementById('toggle-spectator');
        if (spectatorBtn) {
            spectatorBtn.addEventListener('click', () => {
                this.socket.emit('toggle-spectator', this.roomId);
            });
        }
    }

    updateGridSizeDisplay() {
        const gridSizeElement = document.getElementById('grid-size-display');
        if (gridSizeElement) {
            const sizeNames = { 
                small: '3×3 dots (2×2 boxes)', 
                medium: '4×4 dots (3×3 boxes)', 
                large: '5×5 dots (4×4 boxes)',
                huge: '6×6 dots (5×5 boxes)'
            };
            gridSizeElement.textContent = `Grid: ${sizeNames[this.gridSize]}`;
        }
    }

    onGameStateUpdate(gameState) {
        console.log('DotsLines - updating game state:', gameState);
        this.updatePlayersDisplay();
        this.updateGameStatus();
        this.updateGameBoard();
        this.updateScores();
    }

    updatePlayersDisplay() {
        if (!this.gameState || !this.gameState.players) return;

        console.log('DotsLines - Updating players display:', this.gameState.players);

        // Update players list
        const playersList = document.getElementById('players-list');
        if (playersList) {
            playersList.innerHTML = '';
            
            this.gameState.players.forEach((player, index) => {
                const isCurrentPlayer = index === this.gameState.currentPlayer;
                const isMe = player.id === this.socket.id;
                
                if (isMe) {
                    this.playerData = player;
                    this.myPlayerIndex = index;
                    this.isMyTurn = isCurrentPlayer;
                }
                
                const playerCard = document.createElement('div');
                playerCard.className = 'dots-player-card';
                if (isCurrentPlayer) playerCard.classList.add('current-turn');
                if (isMe) playerCard.classList.add('current-player');
                
                const score = this.gameState.scores[player.id] || 0;
                
                playerCard.innerHTML = `
                    <div class="player-header">
                        <div class="player-color" style="background-color: ${player.color}"></div>
                        <span class="player-name">${player.name}</span>
                        ${isCurrentPlayer ? '<span class="turn-indicator">🎯</span>' : ''}
                    </div>
                    <div class="player-score">
                        <span class="score-value">${score}</span>
                        <small>boxes</small>
                    </div>
                    <div class="player-stats">
                        <small>Wins: ${player.stats?.wins || 0}</small>
                    </div>
                `;
                
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

        const statusElement = document.getElementById('status-text');
        let statusText = '';
        
        switch (this.gameState.gameStatus) {
            case 'waiting':
                statusText = `Waiting for players... (${this.gameState.players?.length || 0}/${this.gameState.maxPlayers})`;
                break;
            case 'playing':
                const currentPlayer = this.gameState.players[this.gameState.currentPlayer];
                const currentPlayerName = currentPlayer?.name || 'Unknown';
                statusText = this.isMyTurn ? "Your turn! Draw a line." : `${currentPlayerName}'s turn`;
                break;
            case 'finished':
                if (this.gameState.gameResults?.isDraw) {
                    statusText = "Game finished! It's a draw!";
                } else {
                    const winner = this.gameState.gameResults?.winners[0];
                    statusText = winner ? `${winner.playerName} wins!` : 'Game finished!';
                }
                break;
            default:
                statusText = 'Game Status Unknown';
        }
        
        if (statusElement) {
            statusElement.textContent = statusText;
        }

        // Update turn indicator
        this.updateTurnIndicator();
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            if (this.isMyTurn && this.gameState.gameStatus === 'playing') {
                turnIndicator.textContent = 'Your Turn - Draw a Line!';
                turnIndicator.className = 'turn-indicator my-turn';
            } else if (this.gameState.gameStatus === 'playing') {
                const currentPlayer = this.gameState.players[this.gameState.currentPlayer];
                turnIndicator.textContent = `${currentPlayer?.name}'s Turn`;
                turnIndicator.className = 'turn-indicator other-turn';
            } else {
                turnIndicator.textContent = '';
                turnIndicator.className = 'turn-indicator';
            }
        }
    }

    updateGameBoard() {
        if (!this.gameState || !this.gameBoard) return;

        // Update horizontal lines
        this.gameState.horizontalLines.forEach((row, rowIndex) => {
            row.forEach((line, colIndex) => {
                const lineElement = this.gameBoard.querySelector(
                    `.horizontal-line[data-row="${rowIndex}"][data-col="${colIndex}"]`
                );
                if (lineElement && line.drawn) {
                    lineElement.classList.add('drawn');
                    lineElement.style.stroke = line.color || '#333';
                    lineElement.style.strokeWidth = '6';
                }
            });
        });

        // Update vertical lines
        this.gameState.verticalLines.forEach((row, rowIndex) => {
            row.forEach((line, colIndex) => {
                const lineElement = this.gameBoard.querySelector(
                    `.vertical-line[data-row="${rowIndex}"][data-col="${colIndex}"]`
                );
                if (lineElement && line.drawn) {
                    lineElement.classList.add('drawn');
                    lineElement.style.stroke = line.color || '#333';
                    lineElement.style.strokeWidth = '6';
                }
            });
        });

        // Update boxes
        this.gameState.boxes.forEach((row, rowIndex) => {
            row.forEach((box, colIndex) => {
                const boxElement = this.gameBoard.querySelector(
                    `.box-area[data-row="${rowIndex}"][data-col="${colIndex}"]`
                );
                const textElement = this.gameBoard.querySelector(
                    `.box-text[data-row="${rowIndex}"][data-col="${colIndex}"]`
                );
                
                if (boxElement && textElement && box.completed) {
                    boxElement.style.fill = box.color || '#f0f0f0';
                    boxElement.style.fillOpacity = '0.3';
                    boxElement.classList.add('completed');
                    
                    // Show player initial or name
                    textElement.textContent = box.playerName ? box.playerName.charAt(0).toUpperCase() : '?';
                    textElement.style.fill = box.color || '#333';
                    textElement.style.fontSize = '16px';
                    textElement.style.fontWeight = 'bold';
                }
            });
        });
    }

    updateScores() {
        if (!this.gameState) return;

        this.scores = this.gameState.scores || {};
        
        // Update score display in players list (handled in updatePlayersDisplay)
        
        // Update total scores
        const scoresElement = document.getElementById('current-scores');
        if (scoresElement) {
            scoresElement.innerHTML = '';
            
            Object.entries(this.scores).forEach(([playerId, score]) => {
                const player = this.gameState.players.find(p => p.id === playerId);
                if (player) {
                    const scoreItem = document.createElement('div');
                    scoreItem.className = 'score-item';
                    scoreItem.innerHTML = `
                        <div class="score-player" style="color: ${player.color}">
                            ${player.name}
                        </div>
                        <div class="score-value">${score}</div>
                    `;
                    scoresElement.appendChild(scoreItem);
                }
            });
        }
    }

    // Handle socket events specific to Dots and Lines
    initializeSocket() {
        super.initializeSocket();
        
        // Dots and Lines specific socket events
        this.socket.on('line-drawn', (data) => {
            console.log('Line drawn:', data);
            this.onLineDrawn(data);
        });
        
        this.socket.on('move-error', (data) => {
            console.log('Move error:', data);
            this.showNotification(data.message, 'error');
        });
        
        this.socket.on('hint-suggestion', (data) => {
            console.log('Hint received:', data);
            this.showHint(data);
        });
        
        this.socket.on('turn-skipped', (data) => {
            console.log('Turn skipped:', data);
            this.showNotification(`${data.playerName} skipped their turn`, 'info');
        });
        
        this.socket.on('player-spectator-toggle', (data) => {
            console.log('Spectator toggle:', data);
            this.showNotification(
                `${data.playerName} is now ${data.isSpectator ? 'spectating' : 'playing'}`, 
                'info'
            );
        });
        
        this.socket.on('game-stats', (stats) => {
            console.log('Game stats:', stats);
            this.displayGameStats(stats);
        });
    }

    onLineDrawn(data) {
        const message = data.completedBoxes > 0 ? 
            `${data.playerName} drew a line and completed ${data.completedBoxes} box${data.completedBoxes > 1 ? 'es' : ''}!` :
            `${data.playerName} drew a line`;
        
        this.showNotification(message, data.completedBoxes > 0 ? 'success' : 'info');
        
        // Play appropriate sound
        if (data.completedBoxes > 0) {
            this.playSound('win');
        } else {
            this.playSound('move');
        }
        
        // Show consecutive turn notification
        if (data.consecutiveTurn) {
            setTimeout(() => {
                this.showNotification(`${data.playerName} gets another turn!`, 'info');
            }, 1000);
        }
    }

    showHint(hintData) {
        const { lineType, row, col, reason } = hintData;
        
        // Find the suggested line element
        const lineElement = this.gameBoard.querySelector(
            `.${lineType}-line[data-row="${row}"][data-col="${col}"]`
        );
        
        if (lineElement) {
            // Highlight the suggested line
            lineElement.classList.add('hint-highlight');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
                lineElement.classList.remove('hint-highlight');
            }, 3000);
            
            this.showNotification(`Hint: Try the ${lineType} line at position ${row+1},${col+1}`, 'info');
        }
    }

    displayGameStats(stats) {
        const statsElement = document.getElementById('game-stats');
        if (statsElement) {
            const progressPercent = Math.round((stats.completedBoxes / stats.totalBoxes) * 100);
            
            statsElement.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Grid:</span>
                    <span class="stat-value">${stats.gridSize}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Boxes:</span>
                    <span class="stat-value">${stats.completedBoxes}/${stats.totalBoxes}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Progress:</span>
                    <span class="stat-value">${progressPercent}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Lines:</span>
                    <span class="stat-value">${stats.drawnLines}/${stats.totalLines}</span>
                </div>
            `;
        }
        
        // Update progress bar if exists
        const progressBar = document.getElementById('game-progress-bar');
        if (progressBar) {
            const progressPercent = Math.round((stats.completedBoxes / stats.totalBoxes) * 100);
            progressBar.style.width = `${progressPercent}%`;
        }
    }

    onGameOver(data) {
        console.log('Game over:', data);
        
        this.playSound('gameOver');
        this.updateRoundHistory(data.results?.rankings);
        
        setTimeout(() => {
            if (data.results?.isDraw) {
                this.showNotification("Game ended in a draw! 🤝", 'info');
            } else {
                const winner = data.results?.winners[0];
                if (winner) {
                    const isWinner = winner.playerId === this.socket.id;
                    
                    if (isWinner) {
                        this.showNotification("🎉 You won! Great job!", 'success');
                    } else {
                        this.showNotification(`${winner.playerName} won with ${winner.score} boxes!`, 'info');
                    }
                }
            }
        }, 1000);
        
        // Show detailed results
        this.showGameResults(data.results);
    }

    showGameResults(results) {
        if (!results) return;
        
        const popup = document.createElement('div');
        popup.className = 'game-results-popup';
        popup.innerHTML = `
            <div class="results-content">
                <h2>🎯 Game Results</h2>
                <div class="results-list">
                    ${results.rankings.map((player, index) => `
                        <div class="result-item ${index === 0 ? 'winner' : ''}">
                            <span class="rank">#${index + 1}</span>
                            <span class="player-name">${player.playerName}</span>
                            <span class="player-score">${player.score} boxes (${player.percentage}%)</span>
                        </div>
                    `).join('')}
                </div>
                <div class="results-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.parentElement.removeChild(popup);
            }
        }, 15000);
    }

    // Implementation of abstract methods from BaseGameManager
    isCurrentPlayerWinner(winner) {
        return winner && winner.playerId === this.socket.id;
    }

    getWinnerName(winner) {
        return winner?.playerName || 'Unknown';
    }

    getWinnerColor(winner) {
        return this.gameState?.players?.find(p => p.id === winner?.playerId)?.color || '#4CAF50';
    }

    joinGame(playerName) {
        if (!playerName || playerName.trim().length === 0) {
            this.showNotification('Please enter a valid name', 'error');
            return;
        }

        console.log(`[DotsLines] Attempting to join room ${this.roomId} with name: ${playerName} and grid size: ${this.gridSize}`);
        
        // Send grid size along with join request
        this.socket.emit('join-room', this.roomId, playerName.trim(), 'dotslines', this.gridSize);
        
        this.savePlayerNameToSession(playerName.trim());
        this.showNotification(`Joining Dots and Lines game as ${playerName}...`, 'info');
    }

    // Helper methods
    animateLine(lineElement) {
        if (!lineElement) return;
        
        lineElement.style.strokeDasharray = '10';
        lineElement.style.strokeDashoffset = '10';
        
        // Animate the line drawing
        lineElement.animate([
            { strokeDashoffset: '10' },
            { strokeDashoffset: '0' }
        ], {
            duration: 300,
            easing: 'ease-out',
            fill: 'forwards'
        }).finished.then(() => {
            lineElement.style.strokeDasharray = 'none';
        });
    }

    highlightCompletedBoxes(boxes) {
        boxes.forEach(box => {
            const boxElement = this.gameBoard.querySelector(
                `.box-area[data-row="${box.row}"][data-col="${box.col}"]`
            );
            
            if (boxElement) {
                boxElement.animate([
                    { transform: 'scale(1)', opacity: '0.3' },
                    { transform: 'scale(1.1)', opacity: '0.8' },
                    { transform: 'scale(1)', opacity: '0.3' }
                ], {
                    duration: 600,
                    easing: 'ease-in-out'
                });
            }
        });
    }

    updateRoundHistory(rankings) {
        const historyElement = document.getElementById('history-list');
        if (!historyElement || !rankings) return;

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const winner = rankings[0];
        historyItem.innerHTML = `
            <div class="history-game">Game ${this.gameState?.gameCount || 1}</div>
            <div class="history-winner">${winner?.playerName || 'Unknown'} (${winner?.score || 0} boxes)</div>
        `;
        
        historyElement.insertBefore(historyItem, historyElement.firstChild);
        
        // Keep only last 5 games
        while (historyElement.children.length > 5) {
            historyElement.removeChild(historyElement.lastChild);
        }
        
        // Show history section
        const roundHistorySection = document.getElementById('round-history');
        if (roundHistorySection) {
            roundHistorySection.style.display = 'block';
        }
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.currentGameType === 'dotslines') {
        window.dotsLinesGame = new DotsLinesGame();
    }
});