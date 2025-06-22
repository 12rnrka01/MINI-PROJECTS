// Game-specific JavaScript
let socket;
let roomId;
let playerData = null;
let gameState = null;

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
    });
    
    socket.on('game-state', function(state) {
        gameState = state;
        updateGameDisplay();
        
        // Load existing chat messages
        if (state.messages && state.messages.length > 0) {
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = ''; // Clear existing messages
            state.messages.forEach(message => {
                addChatMessage(message);
            });
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
        showNotification('Game has been reset', 'info');
        clearGameBoard();
    });
    
    socket.on('new-message', function(message) {
        addChatMessage(message);
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
    document.getElementById('game-board').addEventListener('click', function(e) {
        if (e.target.classList.contains('cell')) {
            const cellIndex = parseInt(e.target.dataset.index);
            makeMove(cellIndex);
        }
    });
    
    // Reset game button
    document.getElementById('reset-game').addEventListener('click', function() {
        if (confirm('Are you sure you want to start a new game?')) {
            socket.emit('reset-game', roomId);
        }
    });
    
    // Leave game button
    document.getElementById('leave-game').addEventListener('click', function() {
        if (confirm('Are you sure you want to leave the game?')) {
            socket.disconnect();
            window.location.href = '/';
        }
    });
    
    // Chat functionality
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    
    sendButton.addEventListener('click', sendChatMessage);
    
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // Join game button in modal
    document.getElementById('join-game-btn').addEventListener('click', joinGame);
    
    // Copy room ID button
    document.getElementById('copy-room-id').addEventListener('click', function() {
        copyToClipboard(roomId);
    });
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
    
    // Store current player data
    playerData = gameState.players.find(p => p.id === socket.id);
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
    const resetButton = document.getElementById('reset-game');
    
    switch (gameState.gameStatus) {
        case 'waiting':
            if (gameState.players.length === 0) {
                statusText.textContent = 'Waiting for players to join...';
            } else if (gameState.players.length === 1) {
                statusText.textContent = 'Waiting for second player...';
            }
            resetButton.style.display = 'none';
            break;
            
        case 'playing':
            const currentPlayer = gameState.players.find(p => p.symbol === gameState.currentPlayer);
            const isMyTurn = currentPlayer && currentPlayer.id === socket.id;
            
            if (isMyTurn) {
                statusText.textContent = `Your turn (${gameState.currentPlayer})`;
            } else {
                statusText.textContent = `${currentPlayer ? currentPlayer.name : 'Player'}'s turn (${gameState.currentPlayer})`;
            }
            resetButton.style.display = 'none';
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
            resetButton.style.display = 'inline-block';
            break;
    }
}

function updatePlayersCount(count) {
    document.getElementById('players-count').textContent = `${count}/2 players`;
}

function handleGameOver(data) {
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

function clearGameBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'winning-cell');
        cell.classList.add('clickable');
    });
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (message.length > 200) {
        showNotification('Message too long (max 200 characters)', 'warning');
        return;
    }
    
    socket.emit('send-message', roomId, message);
    chatInput.value = '';
    chatInput.focus();
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    // Check if this message is from current player
    const isOwnMessage = playerData && message.playerName === playerData.name;
    if (isOwnMessage) {
        messageElement.classList.add('own-message');
    }
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-author">${escapeHtml(message.playerName)}</span>
            <span class="message-time">${message.timestamp}</span>
        </div>
        <div class="message-content">${escapeHtml(message.message)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Remove old messages if too many (keep last 50)
    const messages = chatMessages.querySelectorAll('.chat-message');
    if (messages.length > 50) {
        messages[0].remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility functions for better UX
function addTypingIndicator() {
    // Could add typing indicator functionality here
}

function removeTypingIndicator() {
    // Could remove typing indicator functionality here
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
    if (socket) {
        socket.disconnect();
    }
});