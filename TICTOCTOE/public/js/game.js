// Game-specific JavaScript (Chat functionality moved to chat.js)
let socket;
let roomId;
let playerData = null;
let gameState = null;
let sessionStats = { playerX: 0, playerO: 0, ties: 0 };
let autoPlayEnabled = true;
let chatManager; // Chat manager instance

document.addEventListener('DOMContentLoaded', function() {
    roomId = window.location.pathname.split('/').pop();
    
    // Show name modal
    showNameModal();
    
    // Initialize socket connection
    initializeSocket();
    
    // Set up event listeners
    setupEventListeners();
});

function showNameModal() {
    const modal = document.getElementById('name-modal');
    modal.style.display = 'flex';
    
    const nameInput = document.getElementById('player-name-input');
    nameInput.focus();
    
    // Generate random name suggestion
    const randomNames = ['Player1', 'Gamer', 'Winner', 'Champion', 'Star', 'Pro'];
    nameInput.placeholder = randomNames[Math.floor(Math.random() * randomNames.length)];
    
    nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
}

function joinGame() {
    const nameInput = document.getElementById('player-name-input');
    const playerName = nameInput.value.trim() || nameInput.placeholder;
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    // Hide modal
    document.getElementById('name-modal').style.display = 'none';
    
    // Join the room
    socket.emit('join-room', roomId, playerName);
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
        showNotification('Connected to game server', 'success');
        
        // Initialize chat manager after socket connection
        if (!chatManager) {
            chatManager = new ChatManager(socket, roomId);
        }
    });
    
    socket.on('game-state', function(state) {
        gameState = state;
        updateGameDisplay();
        
        // Update chat manager with player data
        if (chatManager && playerData) {
            chatManager.setPlayerData(playerData);
        }
        
        // Load existing chat messages via chat manager
        if (state.messages && state.messages.length > 0 && chatManager) {
            chatManager.loadExistingMessages(state.messages);
        }
    });
    
    socket.on('player-joined', function(data) {
        showNotification(`${data.playerName} joined the game`, 'success');
        updatePlayersCount(data.playersCount);
    });
    
    socket.on('player-left', function(data) {
        showNotification(`${data.playerName} left the game`, 'warning');
        updatePlayersCount(data.playersCount);
    });
    
    socket.on('game-over', function(data) {
        handleGameOver(data);
    });
    
    socket.on('game-reset', function() {
        showNotification('New game started', 'info');
        clearGameBoard();
    });
    
    socket.on('stats-update', function(data) {
        updatePlayerStats(data.players);
    });
    
    socket.on('auto-next-game', function(data) {
        if (autoPlayEnabled) {
            showNotification(data.message, 'info');
            updateGameCounter(data.gameCount);
        }
    });
    
    socket.on('game-stopped', function() {
        autoPlayEnabled = false;
        showNotification('Game session ended', 'info');
    });
    
    socket.on('disconnect', function() {
        showNotification('Disconnected from server', 'error');
    });
    
    socket.on('reconnect', function() {
        showNotification('Reconnected to server', 'success');
        // Rejoin the room if we have player data
        if (playerData && playerData.name) {
            socket.emit('join-room', roomId, playerData.name);
        }
    });
}

function setupEventListeners() {
    // Game board clicks
    const gameBoard = document.getElementById('game-board');
    if (gameBoard) {
        gameBoard.addEventListener('click', function(e) {
            if (e.target.classList.contains('cell')) {
                const cellIndex = parseInt(e.target.dataset.index);
                makeMove(cellIndex);
            }
        });
    }
    
    // Next game button
    const nextGameBtn = document.getElementById('next-game');
    if (nextGameBtn) {
        nextGameBtn.addEventListener('click', function() {
            socket.emit('next-game', roomId);
            autoPlayEnabled = true;
        });
    }
    
    // Stop playing button
    const stopBtn = document.getElementById('stop-playing');
    if (stopBtn) {
        stopBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to stop the current session?')) {
                socket.emit('stop-playing', roomId);
                autoPlayEnabled = false;
            }
        });
    }
    
    // Reset game button (backup)
    const resetBtn = document.getElementById('reset-game');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset the game?')) {
                socket.emit('reset-game', roomId);
            }
        });
    }
    
    // Leave game button
    const leaveBtn = document.getElementById('leave-game');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to leave the game?')) {
                // Disconnect chat manager
                if (chatManager) {
                    chatManager.disconnect();
                }
                socket.disconnect();
                window.location.href = '/';
            }
        });
    }
    
    // Join game button in modal
    const joinBtn = document.getElementById('join-game-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinGame);
    }
    
    // Copy room ID button
    const copyBtn = document.getElementById('copy-room-id');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            copyToClipboard(roomId);
        });
    }
    
    // NOTE: Chat event listeners are now handled by ChatManager
}

function makeMove(cellIndex) {
    if (!gameState || gameState.gameStatus !== 'playing') {
        showNotification('Game is not active', 'warning');
        return;
    }
    
    if (gameState.board[cellIndex] !== null) {
        showNotification('Cell already taken', 'warning');
        return;
    }
    
    // Check if it's the player's turn
    const currentPlayer = gameState.players.find(p => p.id === socket.id);
    if (!currentPlayer || currentPlayer.symbol !== gameState.currentPlayer) {
        showNotification('Not your turn', 'warning');
        return;
    }
    
    socket.emit('make-move', roomId, cellIndex);
}

function updateGameDisplay() {
    if (!gameState) return;
    
    // Update board
    updateGameBoard();
    
    // Update players
    updatePlayersDisplay();
    
    // Update status
    updateGameStatus();
    
    // Update players count
    updatePlayersCount(gameState.players.length);
    
    // Update game counter
    if (gameState.gameCount) {
        updateGameCounter(gameState.gameCount);
    }
    
    // Update round history
    if (gameState.roundHistory && gameState.roundHistory.length > 0) {
        updateRoundHistory(gameState.roundHistory);
    }
    
    // Store current player data
    playerData = gameState.players.find(p => p.id === socket.id);
    
    // Update chat manager with new player data
    if (chatManager && playerData) {
        chatManager.setPlayerData(playerData);
    }
}

function updateGameBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        const value = gameState.board[index];
        cell.textContent = value || '';
        
        // Remove all classes first
        cell.classList.remove('x', 'o', 'clickable', 'winning-cell');
        
        // Add appropriate classes
        if (value) {
            cell.classList.add(value.toLowerCase());
        } else if (gameState.gameStatus === 'playing') {
            cell.classList.add('clickable');
        }
    });
    
    // Highlight winning combination if game is over
    if (gameState.gameStatus === 'finished' && gameState.winner !== 'tie') {
        highlightWinningCells();
    }
}

function highlightWinningCells() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    const board = gameState.board;
    
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            pattern.forEach(index => {
                document.querySelector(`[data-index="${index}"]`).classList.add('winning-cell');
            });
            break;
        }
    }
}

function updatePlayersDisplay() {
    const playerX = document.getElementById('player-x');
    const playerO = document.getElementById('player-o');
    
    // Reset player cards
    playerX.classList.remove('current-turn', 'connected');
    playerO.classList.remove('current-turn', 'connected');
    
    playerX.querySelector('.player-name').textContent = 'Waiting...';
    playerO.querySelector('.player-name').textContent = 'Waiting...';
    
    // Update with actual player data
    if (gameState.players.length > 0) {
        const xPlayer = gameState.players.find(p => p.symbol === 'X');
        if (xPlayer) {
            playerX.querySelector('.player-name').textContent = xPlayer.name;
            playerX.classList.add('connected');
        }
    }
    
    if (gameState.players.length > 1) {
        const oPlayer = gameState.players.find(p => p.symbol === 'O');
        if (oPlayer) {
            playerO.querySelector('.player-name').textContent = oPlayer.name;
            playerO.classList.add('connected');
        }
    }
    
    // Highlight current player's turn
    if (gameState.gameStatus === 'playing') {
        if (gameState.currentPlayer === 'X') {
            playerX.classList.add('current-turn');
        } else {
            playerO.classList.add('current-turn');
        }
    }
}

function updateGameStatus() {
    const statusText = document.getElementById('status-text');
    const nextGameBtn = document.getElementById('next-game');
    const stopBtn = document.getElementById('stop-playing');
    const resetBtn = document.getElementById('reset-game');
    
    // Hide buttons by default
    if (nextGameBtn) nextGameBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
    
    if (!statusText) {
        console.error('Status text element not found');
        return;
    }
    
    switch (gameState.gameStatus) {
        case 'waiting':
            if (gameState.players.length === 0) {
                statusText.textContent = 'Waiting for players to join...';
            } else if (gameState.players.length === 1) {
                statusText.textContent = 'Waiting for second player...';
            }
            break;
            
        case 'playing':
            const currentPlayer = gameState.players.find(p => p.symbol === gameState.currentPlayer);
            const isMyTurn = currentPlayer && currentPlayer.id === socket.id;
            
            if (isMyTurn) {
                statusText.textContent = `Your turn (${gameState.currentPlayer})`;
            } else {
                statusText.textContent = `${currentPlayer ? currentPlayer.name : 'Player'}'s turn (${gameState.currentPlayer})`;
            }
            break;
            
        case 'finished':
            if (gameState.winner === 'tie') {
                statusText.textContent = "It's a tie! 🤝";
            } else {
                const winnerPlayer = gameState.players.find(p => p.name === gameState.winner);
                const isWinner = winnerPlayer && winnerPlayer.id === socket.id;
                
                if (isWinner) {
                    statusText.textContent = `You win! 🎉`;
                } else {
                    statusText.textContent = `${gameState.winner} wins! 👑`;
                }
            }
            
            // Show game control buttons
            if (autoPlayEnabled) {
                statusText.textContent += ' Next game starting in 3 seconds...';
            } else {
                if (nextGameBtn) nextGameBtn.style.display = 'inline-block';
            }
            if (stopBtn) stopBtn.style.display = 'inline-block';
            break;
            
        case 'stopped':
            statusText.textContent = 'Game session ended. Thanks for playing!';
            if (nextGameBtn) {
                nextGameBtn.style.display = 'inline-block';
                nextGameBtn.textContent = 'Start New Session';
            }
            break;
    }
}

function updatePlayersCount(count) {
    const playersCountElement = document.getElementById('players-count');
    if (playersCountElement) {
        playersCountElement.textContent = `${count}/2 players`;
    }
}

function handleGameOver(data) {
    // Update session stats
    updateSessionStats(data.winner);
    
    setTimeout(() => {
        if (data.winner === 'tie') {
            showNotification("Game over - It's a tie! 🤝", 'info');
        } else {
            const winnerPlayer = gameState.players.find(p => p.name === data.winner);
            const isWinner = winnerPlayer && winnerPlayer.id === socket.id;
            
            if (isWinner) {
                showNotification(`Congratulations! You won! 🎉`, 'success');
            } else {
                showNotification(`Game over - ${data.winner} wins! 👑`, 'info');
            }
        }
    }, 500);
}

function updatePlayerStats(playersData) {
    playersData.forEach(player => {
        const statsElement = document.getElementById(`stats-${player.symbol.toLowerCase()}`);
        if (statsElement && player.stats) {
            statsElement.querySelector('.wins').textContent = player.stats.wins;
            statsElement.querySelector('.losses').textContent = player.stats.losses;
            statsElement.querySelector('.ties').textContent = player.stats.ties;
            statsElement.querySelector('.current-streak').textContent = player.stats.currentStreak;
            
            // Highlight streak if > 0
            const streakElement = statsElement.querySelector('.streak');
            if (player.stats.currentStreak > 0) {
                streakElement.classList.add('active-streak');
            } else {
                streakElement.classList.remove('active-streak');
            }
        }
    });
}

function updateSessionStats(winner) {
    if (winner === 'tie') {
        sessionStats.ties++;
    } else {
        const winnerPlayer = gameState.players.find(p => p.name === winner);
        if (winnerPlayer) {
            if (winnerPlayer.symbol === 'X') {
                sessionStats.playerX++;
            } else {
                sessionStats.playerO++;
            }
        }
    }
    
    // Update session score display
    const sessionScore = document.getElementById('session-score');
    sessionScore.textContent = `${sessionStats.playerX} - ${sessionStats.playerO}`;
    
    if (sessionStats.ties > 0) {
        sessionScore.textContent += ` (${sessionStats.ties} ties)`;
    }
}

function updateGameCounter(gameCount) {
    const currentGameElement = document.getElementById('current-game');
    if (currentGameElement) {
        currentGameElement.textContent = gameCount || 1;
    }
}

function updateRoundHistory(roundHistory) {
    const historyContainer = document.getElementById('round-history');
    const historyList = document.getElementById('history-list');
    
    if (roundHistory.length === 0) {
        historyContainer.style.display = 'none';
        return;
    }
    
    historyContainer.style.display = 'block';
    historyList.innerHTML = '';
    
    // Show last 5 games
    const recentGames = roundHistory.slice(-5).reverse();
    
    recentGames.forEach(game => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const winnerText = game.winner === 'tie' ? 'Tie' : `${game.winner} won`;
        const gameTime = new Date(game.timestamp).toLocaleTimeString();
        
        historyItem.innerHTML = `
            <div class="history-game">
                <span class="game-number">Game ${game.gameNumber}</span>
                <span class="game-result">${winnerText}</span>
                <span class="game-time">${gameTime}</span>
            </div>
        `;
        
        historyList.appendChild(historyItem);
    });
}

function clearGameBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'winning-cell');
        if (gameState && gameState.gameStatus === 'playing') {
            cell.classList.add('clickable');
        }
    });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden - could pause some features
    } else {
        // Page is visible - could resume features
        if (socket && !socket.connected) {
            socket.connect();
        }
    }
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (chatManager) {
        chatManager.disconnect();
    }
    if (socket) {
        socket.disconnect();
    }
});