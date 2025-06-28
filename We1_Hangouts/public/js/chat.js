// public/js/chat.js - FIXED VERSION
class ChatManager {
    constructor(socket, roomId) {
        this.socket = socket;
        this.roomId = roomId;
        this.playerData = null;
        this.maxMessages = 50;
        this.maxMessageLength = 200;

        this.typingTimeout = null;
        this.isTyping = false;

        this.isMinimized = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        this.chatHistory = [];
        
        console.log('ChatManager initialized with:', { socket: !!socket, roomId });
        
        this.initializeChatEvents();
        this.setupChatListeners();
        this.setupChatControls();
    }
    
    // Initialize socket events for chat
    initializeChatEvents() {
        if (!this.socket) {
            console.error('Socket not provided to ChatManager');
            return;
        }
        
        console.log('Setting up chat socket events...');
        
        // Listen for new messages from server
        this.socket.on('new-message', (message) => {
            console.log('Chat: Received new message:', message);
            this.addChatMessage(message);
        });
        
        // Handle connection status for chat
        this.socket.on('connect', () => {
            console.log('Chat: Socket connected');
            this.updateChatStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Chat: Socket disconnected');
            this.updateChatStatus('disconnected');
        });

        this.socket.on('player-typing', (data) => {
            console.log('Chat: Player typing:', data);
            this.showTypingIndicator(data);
        });

        this.socket.on('message-reaction-update', (data) => {
            console.log('Chat: Message reaction update:', data);
            this.updateMessageReaction(data);
        });
        
        console.log('Chat socket events setup complete');
    }

    showTypingIndicator(data) {
        const typingIndicator = document.getElementById('typing-indicator');
        if (!typingIndicator) return;
        
        if (data.typing) {
            typingIndicator.textContent = `${data.playerName} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }

    updateMessageReaction(data) {
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (!messageElement) return;
        
        let reactionsSummary = messageElement.querySelector('.reactions-summary');
        if (!reactionsSummary) {
            reactionsSummary = document.createElement('div');
            reactionsSummary.className = 'reactions-summary';
            messageElement.appendChild(reactionsSummary);
        }
        
        // Check if this emoji reaction already exists
        let existingReaction = reactionsSummary.querySelector(`[data-emoji="${data.emoji}"]`);
        
        if (existingReaction) {
            // Increase count
            let countElement = existingReaction.querySelector('.count');
            let currentCount = parseInt(countElement.textContent) || 1;
            countElement.textContent = currentCount + 1;
        } else {
            // Create new reaction
            const reactionSpan = document.createElement('span');
            reactionSpan.className = 'reaction-count';
            reactionSpan.dataset.emoji = data.emoji;
            reactionSpan.title = `Reacted by: ${data.users.join(', ')}`;
            reactionSpan.innerHTML = `${data.emoji} <span class="count">1</span>`;
            reactionsSummary.appendChild(reactionSpan);
        }
    }

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('typing-start', this.roomId);
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.socket.emit('typing-stop', this.roomId);
        }, 1000);
    }
    
    // Set up DOM event listeners
    setupChatListeners() {
        // Chat input and send button
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        console.log('Setting up chat listeners...', { chatInput: !!chatInput, sendButton: !!sendButton });
        
        if (sendButton) {
            sendButton.addEventListener('click', () => {
                console.log('Send button clicked');
                this.sendChatMessage();
            });
        }
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('Enter key pressed in chat input');
                    this.sendChatMessage();
                }
            });
            
            // Show typing indicator
            chatInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }
        
        console.log('Chat listeners setup complete');
    }
    
    // Send chat message
    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput ? chatInput.value.trim() : '';
        
        console.log('Attempting to send chat message:', { message, socket: !!this.socket, roomId: this.roomId });
        
        if (!message) {
            console.log('Empty message, not sending');
            return;
        }
        
        if (message.length > this.maxMessageLength) {
            this.showChatNotification(`Message too long (max ${this.maxMessageLength} characters)`, 'warning');
            return;
        }
        
        if (!this.socket || !this.socket.connected) {
            this.showChatNotification('Not connected to server', 'error');
            console.error('Socket not connected:', { socket: !!this.socket, connected: this.socket?.connected });
            return;
        }
        
        console.log('Emitting send-message event:', { roomId: this.roomId, message });
        this.socket.emit('send-message', this.roomId, message);
        
        if (chatInput) {
            chatInput.value = '';
            chatInput.focus();
        }
    }

    addMessageReactions(messageElement, messageData) {
        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        
        const quickReactions = ['👍', '❤️', '😄', '😮'];
        quickReactions.forEach(emoji => {
            const reactionBtn = document.createElement('button');
            reactionBtn.className = 'reaction-btn';
            reactionBtn.textContent = emoji;
            reactionBtn.onclick = () => this.reactToMessage(messageData.id, emoji);
            reactionsContainer.appendChild(reactionBtn);
        });
        
        messageElement.appendChild(reactionsContainer);
    }
    
    reactToMessage(messageId, emoji) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('message-reaction', this.roomId, {
                messageId: messageId,
                emoji: emoji,
                playerName: this.playerData?.name
            });
        }
    }
    
    // Add message to chat display
    addChatMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        
        if (!chatMessages) {
            console.error('Chat messages container not found');
            return;
        }
        
        console.log('Adding chat message to UI:', message);
        
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.dataset.messageId = message.id;
        
        const isOwnMessage = this.playerData && message.playerName === this.playerData.name;
        if (isOwnMessage) {
            messageElement.classList.add('own-message');
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-author">${this.escapeHtml(message.playerName)}</span>
                <span class="message-time">${message.timestamp}</span>
                <div class="message-actions">
                    <button class="msg-action-btn reply-btn" onclick="window.chatManager.replyToMessage('${message.id}', '${message.playerName}')">↩️</button>
                    <button class="msg-action-btn copy-btn" onclick="window.chatManager.copyMessage('${this.escapeHtml(message.message)}')">📋</button>
                </div>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;
        
        // Add reaction buttons on hover
        this.addMessageReactions(messageElement, message);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        this.cleanupOldMessages();

        this.chatHistory.push({
            ...message,
            element: messageElement
        });
        
        // Keep last 100 messages in history
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
        
        console.log('Chat message added to UI successfully');
    }

    replyToMessage(messageId, authorName) {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = `@${authorName} `;
            chatInput.focus();
        }
    }

    copyMessage(messageText) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(messageText);
            this.showChatNotification('Message copied!', 'success');
        }
    }
    
    // Load existing chat messages (when joining room)
    loadExistingMessages(messages) {
        if (!messages || messages.length === 0) return;
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = ''; // Clear existing messages
            messages.forEach(message => {
                this.addChatMessage(message);
            });
        }
    }
    
    // Clean up old messages to prevent memory issues
    cleanupOldMessages() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const messages = chatMessages.querySelectorAll('.chat-message');
        if (messages.length > this.maxMessages) {
            // Remove oldest messages
            const messagesToRemove = messages.length - this.maxMessages;
            for (let i = 0; i < messagesToRemove; i++) {
                messages[i].remove();
            }
        }
    }
    
    // Update player data (call this when player data changes)
    setPlayerData(playerData) {
        this.playerData = playerData;
        console.log('Chat: Player data updated:', playerData);
    }
    
    // Update chat connection status
    updateChatStatus(status) {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        if (status === 'connected') {
            if (chatInput) chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
        } else {
            if (chatInput) chatInput.disabled = true;
            if (sendButton) sendButton.disabled = true;
        }
    }
    
    // Show chat-specific notifications
    showChatNotification(message, type = 'info') {
        // Use global notification function if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback to console if no notification system
            console.log(`Chat ${type}: ${message}`);
        }
    }
    
    // Escape HTML to prevent XSS attacks
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Clear all chat messages
    clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }
    
    // Get chat statistics
    getChatStats() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return { messageCount: 0 };
        
        const messages = chatMessages.querySelectorAll('.chat-message');
        const ownMessages = chatMessages.querySelectorAll('.chat-message.own-message');
        
        return {
            totalMessages: messages.length,
            ownMessages: ownMessages.length,
            otherMessages: messages.length - ownMessages.length
        };
    }
    
    // Disconnect chat (cleanup when leaving)
    disconnect() {
        // Remove socket listeners specific to chat
        if (this.socket) {
            this.socket.off('new-message');
            this.socket.off('player-typing');
            this.socket.off('message-reaction-update');
        }
        
        // Clear any intervals or timeouts
        this.clearChat();
        
        console.log('Chat disconnected');
    }

    setupChatControls() {
        // Minimize/maximize functionality
        const minimizeBtn = document.getElementById('chat-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        }
        
        // Drag functionality
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.addEventListener('mousedown', (e) => this.startDrag(e));
        }
        
        // Emoji picker
        const emojiBtn = document.getElementById('emoji-btn');
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        }
        
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
    }
    
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        const chatSection = document.querySelector('.chat-section');
        const minimizeBtn = document.getElementById('chat-minimize');
        
        if (this.isMinimized) {
            chatSection.classList.add('minimized');
            minimizeBtn.textContent = '🔼';
        } else {
            chatSection.classList.remove('minimized');
            minimizeBtn.textContent = '🔽';
        }
    }
    
    startDrag(e) {
        this.isDragging = true;
        const chatSection = document.querySelector('.chat-section');
        const rect = chatSection.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        chatSection.style.position = 'fixed';
        chatSection.style.zIndex = '1000';
    }
    
    drag(e) {
        if (!this.isDragging) return;
        
        const chatSection = document.querySelector('.chat-section');
        chatSection.style.left = `${e.clientX - this.dragOffset.x}px`;
        chatSection.style.top = `${e.clientY - this.dragOffset.y}px`;
    }
    
    stopDrag() {
        this.isDragging = false;
    }
    
    toggleEmojiPicker() {
        let picker = document.getElementById('emoji-picker');
        
        if (!picker) {
            picker = this.createEmojiPicker();
            const emojiBtn = document.querySelector('#emoji-btn');
            if (emojiBtn && emojiBtn.parentNode) {
                emojiBtn.parentNode.insertBefore(picker, emojiBtn);
            }
            picker.style.display ='block';
            
        }else{
            
            picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
        }
        
    }
    
    createEmojiPicker() {
        const emojis = ['😀','😃','😄','😁','😊','😍','🤔','😮','😢','😡','👍','👎','❤️','🔥','💯','🎉','🎮','🏆'];
        
        const picker = document.createElement('div');
        picker.id = 'emoji-picker';
        picker.className = 'emoji-picker';
        picker.innerHTML = `
            <div class="emoji-grid">
                ${emojis.map(emoji => `<button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`).join('')}
            </div>
        `;
        
        // Add emoji click handler
        picker.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-btn')) {
                const emoji = e.target.dataset.emoji;
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value += emoji;
                    chatInput.focus();
                }
                picker.style.display = 'none';
            }
        });
        
        return picker;
    }
}

// Make it globally available
window.ChatManager = ChatManager;

// Auto-initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking for chat initialization...');
    
    // Wait a bit for game managers to initialize
    setTimeout(() => {
        if (window.currentRoomId && typeof io !== 'undefined') {
            console.log('Auto-initializing chat manager...');
            
            // Check if a game manager already created the socket
            let socket;
            if (window.ticTacToeGame && window.ticTacToeGame.socket) {
                socket = window.ticTacToeGame.socket;
            } else if (window.connect4Game && window.connect4Game.socket) {
                socket = window.connect4Game.socket;
            } else {
                // Create socket if not exists
                socket = io();
            }
            
            if (!window.chatManager) {
                window.chatManager = new ChatManager(socket, window.currentRoomId);
                console.log('Chat manager auto-initialized');
            }
        }
    }, 1000);
});