// Reusable Chat Module
class ChatManager {
    constructor(socket, roomId) {
        this.socket = socket;
        this.roomId = roomId;
        this.playerData = null;
        this.maxMessages = 50;
        this.maxMessageLength = 200;
        
        this.initializeChatEvents();
        this.setupChatListeners();
    }
    
    // Initialize socket events for chat
    initializeChatEvents() {
        if (!this.socket) {
            console.error('Socket not provided to ChatManager');
            return;
        }
        
        // Listen for new messages from server
        this.socket.on('new-message', (message) => {
            this.addChatMessage(message);
        });
        
        // Handle connection status for chat
        this.socket.on('connect', () => {
            this.updateChatStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            this.updateChatStatus('disconnected');
        });
    }
    
    // Set up DOM event listeners
    setupChatListeners() {
        // Chat input and send button
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
            
            // Optional: Show typing indicator
            chatInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }
    }
    
    // Send chat message
    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        console.log('Sending chat message:', message);
        
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
            return;
        }
        
        console.log('Emitting send-message event');
        this.socket.emit('send-message', this.roomId, message);
        chatInput.value = '';
        chatInput.focus();
    }
    
    // Add message to chat display
    addChatMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        
        if (!chatMessages) {
            console.error('Chat messages container not found');
            return;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        // Check if this message is from current player
        const isOwnMessage = this.playerData && message.playerName === this.playerData.name;
        if (isOwnMessage) {
            messageElement.classList.add('own-message');
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-author">${this.escapeHtml(message.playerName)}</span>
                <span class="message-time">${message.timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove old messages if too many
        this.cleanupOldMessages();
        
        console.log('Chat message added:', message);
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
    }
    
    // Handle typing indicator (optional feature)
    handleTyping() {
        // You can implement typing indicators here
        // For example, emit 'typing' event to server
        if (this.socket && this.socket.connected) {
            // this.socket.emit('typing', this.roomId);
        }
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
        }
        
        // Clear any intervals or timeouts
        this.clearChat();
        
        console.log('Chat disconnected');
    }
}

// Export for use in other files (if using modules)
// export default ChatManager;

// Alternative: Make it globally available
window.ChatManager = ChatManager;