// Tic Tac Toe Game Frontend JavaScript

let socket;
let gameState = null;
let currentPlayer = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in a game room
    if (window.gameData && window.gameData.roomId) {
        initializeGame();
    }
});

function initializeGame() {
    // Connect to socket
    socket = io();
    
    const { roomId, playerName } = window.gameData;
    
    console.log(`🎮 Initializing game: ${playerName} joining ${roomId}`);
    
    // Set up event listeners
    setupSocketListeners();
    setupGameBoard();
    setupChat();
    
    // Join the room
    socket.emit('join-room', { roomId, playerName });
}

function setupSocketListeners() {
    // Successfully joined room
    socket.on('joined-successfully', (data) => {
        console.log('✅ Joined successfully:', data);
        currentPlayer = data.player;
        showNotification(data.message, 'success');
    });
    
    // Join error
    socket.on('join-error', (data) => {
        console.log('❌ Join error:', data);
        showNotification(data.message, 'error');
    });
    
    // Game state updates
    socket.on('game-state', (data) => {
        console.log('🎯 Game state update:', data);
        gameState = data;
        updateGameDisplay();
    });
    
    // Player joined
    socket.on('player-joined', (data) => {
        console.log('👤 Player joined:', data);
        showNotification(`${data.playerName} joined as ${data.symbol}`, 'info');
    });
    
    // Turn change
    socket.on('turn-change', (data) => {
        console.log('🔄 Turn change:', data);
        updateStatusMessage(data.message);
    });
    
    // Game over
    socket.on('game-over', (data) => {
        console.log('🏁 Game over:', data);
        handleGameOver(data);
    });
    
    // Game restarted
    socket.on('game-restarted', (data) => {
        console.log('🔄 Game restarted');
        showNotification(data.message, 'success');
        document.getElementById('restart-btn').style.display = 'none';
    });
    
    // Move error
    socket.on('move-error', (data) => {
        console.log('❌ Move error:', data);
        showNotification(data.message, 'error');
    });
    
    // Room terminated
    socket.on('room-terminated', (data) => {
        console.log('🗑️ Room terminated:', data);
        
        // Close any open modals
        closeWinnerModal();
        
        // Show termination notification
        showNotification(`Session ended by ${data.terminatedBy}`, 'warning');
        
        // Show goodbye modal
        showGoodbyeModal(data.terminatedBy);
    });
    
    // Chat message received (fixed to work properly)
    socket.on('chat-message', (data) => {
        addChatMessage(data.playerName, data.message, data.timestamp, false);
    });
    
    // Chat history received
    socket.on('chat-history', (data) => {
        const chatContainer = document.getElementById('chat-messages');
        if (chatContainer) {
            chatContainer.innerHTML = '';
            
            if (data.messages.length === 0) {
                chatContainer.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation! 👋</div>';
            } else {
                data.messages.forEach(msg => {
                    addChatMessage(msg.playerName, msg.message, msg.timestamp, msg.isOwn, false);
                });
            }
        }
    });
    
    // Chat error
    socket.on('chat-error', (data) => {
        showNotification(data.message, 'error');
    });
}

function setupGameBoard() {
    const cells = document.querySelectorAll('.cell');
    
    cells.forEach((cell, index) => {
        cell.addEventListener('click', () => {
            makeMove(index);
        });
    });
    
    // Restart button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            socket.emit('restart-game', { roomId: window.gameData.roomId });
        });
    }
    
    // Terminate button
    const terminateBtn = document.getElementById('terminate-btn');
    if (terminateBtn) {
        terminateBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to terminate this room? This will end the session for all players.')) {
                socket.emit('terminate-room', { roomId: window.gameData.roomId });
            }
        });
    }
}

function setupChat() {
    const chatInput = document.getElementById('chat-input');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Clear chat button
    const clearChatBtn = document.getElementById('clear-chat');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer && confirm('Clear chat history? (This only clears it for you)')) {
                chatContainer.innerHTML = '<div class="chat-empty">Chat cleared. Messages from others will still appear.</div>';
            }
        });
    }
    
    // Load chat history after connection is established
    setTimeout(() => {
        if (socket && socket.connected) {
            socket.emit('get-chat-history', { roomId: window.gameData.roomId });
        }
    }, 1000);
}

function makeMove(position) {
    if (!gameState || gameState.gameStatus !== 'playing') {
        showNotification('Game is not active', 'warning');
        return;
    }
    
    if (gameState.board[position] !== null) {
        showNotification('Cell is already taken', 'warning');
        return;
    }
    
    if (!currentPlayer || gameState.currentPlayer.id !== socket.id) {
        showNotification('Not your turn', 'warning');
        return;
    }
    
    console.log(`🎯 Making move at position ${position}`);
    
    socket.emit('make-move', {
        roomId: window.gameData.roomId,
        position: position
    });
}

function updateGameDisplay() {
    if (!gameState) return;
    
    // Update board
    updateBoard();
    
    // Update players list
    updatePlayersList();
    
    // Update status
    updateGameStatus();
    
    // Update statistics
    updateStatistics();
}

function updateBoard() {
    const cells = document.querySelectorAll('.cell');
    const board = document.querySelector('.board');
    
    cells.forEach((cell, index) => {
        const value = gameState.board[index];
        cell.textContent = value || '';
        cell.classList.remove('winning-cell');
        
        // Disable cells if game is not playing or cell is taken
        if (gameState.gameStatus !== 'playing' || value) {
            cell.classList.add('disabled');
        } else {
            cell.classList.remove('disabled');
        }
    });
    
    // Update board styling based on game state
    board.classList.remove('my-turn', 'opponent-turn', 'game-finished');
    
    if (gameState.gameStatus === 'playing' && gameState.currentPlayer) {
        const isMyTurn = currentPlayer && gameState.currentPlayer.id === currentPlayer.id;
        if (isMyTurn) {
            board.classList.add('my-turn');
        } else {
            board.classList.add('opponent-turn');
        }
    } else if (gameState.gameStatus === 'finished') {
        board.classList.add('game-finished');
        highlightWinningCells();
    }
}

function highlightWinningCells() {
    if (!gameState.winner) return;
    
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    const cells = document.querySelectorAll('.cell');
    const board = gameState.board;
    
    winPatterns.forEach(pattern => {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            cells[a].classList.add('winning-cell');
            cells[b].classList.add('winning-cell');
            cells[c].classList.add('winning-cell');
        }
    });
}

function updatePlayersList() {
    const playersListElement = document.getElementById('players-list');
    if (!playersListElement) return;
    
    let playersHtml = '<div class="players">';
    
    gameState.players.forEach(player => {
        const isCurrentTurn = gameState.currentPlayer && gameState.currentPlayer.id === player.id;
        const isMe = currentPlayer && currentPlayer.id === player.id;
        
        playersHtml += `
            <div class="player ${isCurrentTurn ? 'current-turn' : ''} ${isMe ? 'me' : ''}">
                <strong>${player.name}</strong> (${player.symbol})
                ${isCurrentTurn ? '← Current Turn' : ''}
                ${isMe ? ' (You)' : ''}
            </div>
        `;
    });
    
    playersHtml += '</div>';
    playersListElement.innerHTML = playersHtml;
}

function updateGameStatus() {
    let statusMessage = '';
    
    switch (gameState.gameStatus) {
        case 'waiting':
            statusMessage = 'Waiting for another player...';
            break;
        case 'playing':
            if (gameState.currentPlayer) {
                const isMyTurn = currentPlayer && gameState.currentPlayer.id === currentPlayer.id;
                statusMessage = isMyTurn 
                    ? 'Your turn!' 
                    : `${gameState.currentPlayer.name}'s turn (${gameState.currentPlayer.symbol})`;
            }
            break;
        case 'finished':
            if (gameState.winner) {
                const isWinner = currentPlayer && gameState.winner.id === currentPlayer.id;
                statusMessage = isWinner ? 'You won! 🎉' : `${gameState.winner.name} won!`;
            } else {
                statusMessage = "It's a draw!";
            }
            break;
        default:
            statusMessage = 'Game status unknown';
    }
    
    updateStatusMessage(statusMessage);
}

function updateStatusMessage(message) {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateStatistics() {
    const statsDisplay = document.getElementById('stats-display');
    if (!statsDisplay || !gameState.statistics) return;
    
    let statsHtml = '<div class="stats-grid">';
    
    Object.entries(gameState.statistics).forEach(([playerId, stats]) => {
        const isCurrentUser = currentPlayer && currentPlayer.id === playerId;
        const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
        
        statsHtml += `
            <div class="player-stats ${isCurrentUser ? 'current-user' : ''}">
                <h4>${stats.name} ${isCurrentUser ? '(You)' : ''}</h4>
                <div class="stats-row">
                    <span>🏆 Wins:</span>
                    <span>${stats.wins}</span>
                </div>
                <div class="stats-row">
                    <span>❌ Losses:</span>
                    <span>${stats.losses}</span>
                </div>
                <div class="stats-row">
                    <span>🤝 Draws:</span>
                    <span>${stats.draws}</span>
                </div>
                <div class="stats-row">
                    <span>📊 Win Rate:</span>
                    <span>${winRate}%</span>
                </div>
                <div class="stats-row">
                    <span>🎮 Total Games:</span>
                    <span>${stats.totalGames}</span>
                </div>
            </div>
        `;
    });
    
    statsHtml += '</div>';
    
    if (gameState.gameCount > 0) {
        statsHtml += `<p style="text-align: center; margin-top: 10px; color: #666;">
            <strong>Games played this session: ${gameState.gameCount}</strong>
        </p>`;
    }
    
    statsDisplay.innerHTML = statsHtml;
}

function handleGameOver(data) {
    // Add delay to allow board animation to complete
    setTimeout(() => {
        showWinnerModal(data);
    }, 1000);
}

function showWinnerModal(data) {
    // Remove any existing modal
    const existingModal = document.querySelector('.winner-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    let title, message, modalClass;
    
    if (data.winner) {
        const isWinner = currentPlayer && data.winner.id === currentPlayer.id;
        
        if (isWinner) {
            title = '🎉 VICTORY!';
            message = `Congratulations ${data.winner.name}! You won this round!`;
            modalClass = 'win';
        } else {
            title = '😢 GAME OVER';
            message = `${data.winner.name} won this round. Better luck next time!`;
            modalClass = 'lose';
        }
    } else if (data.draw) {
        title = '🤝 DRAW!';
        message = "It's a tie! Great game both players!";
        modalClass = 'draw';
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'winner-modal';
    modal.innerHTML = `
        <div class="winner-content ${modalClass}">
            ${modalClass === 'win' ? createConfetti() : ''}
            <div class="winner-title">${title}</div>
            <div class="winner-message">${message}</div>
            <div class="winner-actions">
                <button class="btn btn-primary" onclick="playAgain()">
                    🔄 Play Again
                </button>
                <button class="btn btn-warning" onclick="viewStats()">
                    📊 View Stats
                </button>
                <button class="btn btn-danger" onclick="endSession()">
                    🏠 End Session
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto close modal after 10 seconds if no action
    setTimeout(() => {
        if (document.querySelector('.winner-modal')) {
            closeWinnerModal();
        }
    }, 10000);
}

function createConfetti() {
    let confettiHtml = '';
    for (let i = 0; i < 9; i++) {
        confettiHtml += `<div class="confetti"></div>`;
    }
    return confettiHtml;
}

function closeWinnerModal() {
    const modal = document.querySelector('.winner-modal');
    if (modal) {
        modal.style.animation = 'modalFadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function playAgain() {
    closeWinnerModal();
    socket.emit('restart-game', { roomId: window.gameData.roomId });
    showNotification('🔄 Starting new game...', 'info');
}

function viewStats() {
    closeWinnerModal();
    // Scroll to statistics section
    const statsSection = document.getElementById('game-statistics');
    if (statsSection) {
        statsSection.scrollIntoView({ behavior: 'smooth' });
        // Highlight stats briefly
        statsSection.style.background = '#fff3cd';
        setTimeout(() => {
            statsSection.style.background = '#f8f9fa';
        }, 2000);
    }
}

function endSession() {
    if (confirm('Are you sure you want to end this session? This will terminate the room for all players.')) {
        closeWinnerModal();
        socket.emit('terminate-room', { roomId: window.gameData.roomId });
    }
}

function showGoodbyeModal(terminatedBy) {
    const modal = document.createElement('div');
    modal.className = 'winner-modal';
    modal.innerHTML = `
        <div class="winner-content lose">
            <div class="winner-title">👋 Session Ended</div>
            <div class="winner-message">
                ${terminatedBy === window.gameData.playerName ? 'You' : terminatedBy} ended this game session.<br>
                Thanks for playing!
            </div>
            <div class="winner-actions">
                <button class="btn btn-primary" onclick="goHome()">
                    🏠 Go Home
                </button>
                <button class="btn btn-success" onclick="createNewRoom()">
                    🎮 New Game
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto redirect after 5 seconds
    setTimeout(() => {
        goHome();
    }, 5000);
}

function goHome() {
    window.location.href = '/';
}

function createNewRoom() {
    window.location.href = '/tic-tac-toe';
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    if (message.length > 200) {
        showNotification('Message too long! Maximum 200 characters.', 'error');
        return;
    }
    
    // Add message to own chat immediately
    addChatMessage(window.gameData.playerName, message, new Date().toLocaleTimeString(), true);
    
    // Send to server
    socket.emit('chat-message', {
        roomId: window.gameData.roomId,
        message: message
    });
    
    // Clear input
    chatInput.value = '';
}

function addChatMessage(playerName, message, timestamp, isOwn = false, animate = true) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;
    
    // Remove empty state if present
    const emptyMessage = chatContainer.querySelector('.chat-empty');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own-message' : 'other-message'}`;
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="player-name">${escapeHtml(playerName)}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-text">${escapeHtml(message)}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Limit messages in DOM (keep last 100)
    const messages = chatContainer.querySelectorAll('.chat-message');
    if (messages.length > 100) {
        messages[0].remove();
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add enhanced styles for the game
const enhancedStyles = `
    .players {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .player {
        padding: 10px;
        border-radius: 5px;
        background: #f0f0f0;
        transition: all 0.3s ease;
    }
    
    .player.current-turn {
        background: #e8f5e8;
        border: 2px solid #4CAF50;
        animation: pulse 2s infinite;
    }
    
    .player.me {
        background: #e3f2fd;
        border: 2px solid #2196F3;
    }
    
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
        100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }
`;

// Add styles to page
if (!document.head.querySelector('style[data-enhanced-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-enhanced-styles', 'true');
    style.textContent = enhancedStyles;
    document.head.appendChild(style);
}