// User Session Manager - Handles name persistence and user settings
class UserSessionManager {
    constructor() {
        this.storageKey = 'playerName';
        this.currentUser = null;
        this.defaultAvatars = ['🎮', '🎯', '🏆', '⭐', '🎲', '🎪', '🎊', '🎈'];
        
        this.loadUserSession();
        this.setupHeaderInterface();
    }
    
    loadUserSession() {
        try {
            const savedSession = localStorage.getItem(this.storageKey);
            if (savedSession) {
                this.currentUser = JSON.parse(savedSession);
                console.log('Loaded user session:', this.currentUser);
            }
        } catch (error) {
            console.warn('Could not load user session:', error);
            this.currentUser = null;
        }
    }
    
    // Save user session to localStorage
    saveUserSession() {
        debugger
        try {
            if (this.currentUser) {
                localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
                console.log('User session saved');
            }
        } catch (error) {
            console.warn('Could not save user session:', error);
        }
    }
    
    // Set user data
    setUser(name, avatar = null) {
        this.currentUser = {
            name: name.trim(),
            avatar: avatar || this.getRandomAvatar()
        };
        
        this.saveUserSession();
        this.updateHeaderDisplay();
        return this.currentUser;
    }
    
    // Get current user
    getUser() {
        return this.currentUser;
    }
    
    // Get user name
    getUserName() {
        return this.currentUser?.name || null;
    }
    
    // Check if user has saved session
    hasUser() {
        return this.currentUser && this.currentUser.name;
    }
    
    // Update user stats
    updateStats(gameResult) {
        if (!this.currentUser) return;
        
        this.currentUser.gamesPlayed++;
        this.currentUser.lastActive = new Date().toISOString();
        
        if (gameResult === 'win') {
            this.currentUser.totalWins++;
        }
        
        this.saveUserSession();
        this.updateHeaderDisplay();
    }
    
    // Clear user session
    clearUser() {
        this.currentUser = null;
        try {
            localStorage.removeItem(this.storageKey);
            window.location.reload();
        } catch (error) {
            console.warn('Could not clear user session:', error);
        }
        this.updateHeaderDisplay();
    }
    
    // Get random avatar
    getRandomAvatar() {
        return this.defaultAvatars[Math.floor(Math.random() * this.defaultAvatars.length)];
    }
    
    // Setup header interface
    setupHeaderInterface() {
        this.createHeaderElements();
        this.updateHeaderDisplay();
        this.setupEventListeners();
    }
    
    // Create header elements
    createHeaderElements() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // Create user section
        const userSection = document.createElement('li');
        userSection.className = 'user-section';
        userSection.innerHTML = `
            <div class="user-info" id="user-info" style="display: none;">
                <span class="user-avatar" id="user-avatar">🎮</span>
                <span class="user-name" id="user-name">Player</span>
                <button class="user-menu-btn" id="user-menu-btn">⚙️</button>
            </div>
            <button class="login-btn" id="login-btn" style="display: none;">Set Name</button>
        `;
        
        navLinks.appendChild(userSection);
        
        // Create user modal
        this.createUserModal();
    }
    
    // Create user modal
    createUserModal() {
        const modal = document.createElement('div');
        modal.id = 'user-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content user-modal-content">
                <div class="modal-header">
                    <h3 id="user-modal-title">Set Your Name</h3>
                    <button class="modal-close" id="user-modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="user-form">
                        <div class="avatar-selection">
                            <label>Choose Avatar:</label>
                            <div class="avatar-grid" id="avatar-grid">
                                ${this.defaultAvatars.map(avatar => 
                                    `<button class="avatar-option" data-avatar="${avatar}">${avatar}</button>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="name-input-group">
                            <label for="user-name-input">Your Name:</label>
                            <input type="text" id="user-name-input" maxlength="20" placeholder="Enter your name">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="clear-user-btn" style="display: none;">Clear Data</button>
                    <button class="btn-primary" id="save-user-btn">Save</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Update header display
    updateHeaderDisplay() {
        debugger
        const userInfo = document.getElementById('user-info');
        const loginBtn = document.getElementById('login-btn');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        
        if (this.hasUser()) {
            if (userInfo) {
                userInfo.style.display = 'flex';
                if (userAvatar) userAvatar.textContent = this.currentUser.avatar;
                if (userName) userName.textContent = this.currentUser.name;
            }
            if (loginBtn) loginBtn.style.display = 'none';
        } else {
            if (userInfo) userInfo.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'block';
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        debugger
        // Login button
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showUserModal());
        }
        
        // User menu button
        const userMenuBtn = document.getElementById('user-menu-btn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => this.showUserModal(true));
        }
        
        // Modal close
        const modalClose = document.getElementById('user-modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideUserModal());
        }
        
        // Save user button
        const saveBtn = document.getElementById('save-user-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveUser());
        }
        
        // Clear user button
        const clearBtn = document.getElementById('clear-user-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearUser());
        }
        
        // Avatar selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('avatar-option')) {
                this.selectAvatar(e.target.dataset.avatar);
            }
        });
        
        // Modal background click
        const modal = document.getElementById('user-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideUserModal();
                }
            });
        }
        
        // Enter key on name input
        const nameInput = document.getElementById('user-name-input');
        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveUser();
                }
            });
        }
    }
    
    // Show user modal
    showUserModal(isEdit = false) {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const nameInput = document.getElementById('user-name-input');
        const clearBtn = document.getElementById('clear-user-btn');
        
        if (modal) modal.style.display = 'flex';
        
        if (isEdit && this.hasUser()) {
            if (title) title.textContent = 'Edit Profile';
            if (nameInput) nameInput.value = this.currentUser.name;
            if (clearBtn) clearBtn.style.display = 'block';
            this.selectAvatar(this.currentUser.avatar);
        } else {
            if (title) title.textContent = 'Set Your Name';
            if (nameInput) nameInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';
            this.selectAvatar(this.getRandomAvatar());
        }
        
        if (nameInput) nameInput.focus();
    }
    
    // Hide user modal
    hideUserModal() {
        const modal = document.getElementById('user-modal');
        if (modal) modal.style.display = 'none';
    }
    
    // Select avatar
    selectAvatar(avatar) {
        // Remove previous selection
        document.querySelectorAll('.avatar-option').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Add selection to clicked avatar
        const avatarBtn = document.querySelector(`[data-avatar="${avatar}"]`);
        if (avatarBtn) {
            avatarBtn.classList.add('selected');
        }
        
        this.selectedAvatar = avatar;
    }
    
    // Save user
    saveUser() {
        debugger
        const nameInput = document.getElementById('user-name-input');
        const name = nameInput?.value.trim();
        
        if (!name) {
            alert('Please enter your name');
            return;
        }
        
        if (name.length < 2) {
            alert('Name must be at least 2 characters');
            return;
        }
        
        this.setUser(name, this.selectedAvatar);
        this.hideUserModal();
        
        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('Profile saved!', 'success');
        }
    }
    
    // Confirm clear user
    confirmClearUser() {
        if (confirm('Are you sure you want to clear all your data? This cannot be undone.')) {
            this.clearUser();
            this.hideUserModal();
            
            if (typeof showNotification === 'function') {
                showNotification('User data cleared', 'info');
            }
        }
    }
    
    // Update stats display
    updateStatsDisplay() {
        if (!this.currentUser) return;
        
        const totalGames = document.getElementById('total-games');
        const totalWins = document.getElementById('total-wins');
        const winRate = document.getElementById('win-rate');
        
        if (totalGames) totalGames.textContent = this.currentUser.gamesPlayed;
        if (totalWins) totalWins.textContent = this.currentUser.totalWins;
        
        if (winRate) {
            const rate = this.currentUser.gamesPlayed > 0 
                ? Math.round((this.currentUser.totalWins / this.currentUser.gamesPlayed) * 100)
                : 0;
            winRate.textContent = `${rate}%`;
        }
    }
    
    // Auto-fill name in game modal
    autoFillGameModal() {
        if (this.hasUser()) {
            const gameNameInput = document.getElementById('player-name-input');
            if (gameNameInput) {
                gameNameInput.value = this.currentUser.name;
                
                // Auto-join if name is set
                const modal = document.getElementById('name-modal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                return this.currentUser.name;
            }
        }
        return null;
    }
}

// Initialize user session manager
let userSession;
document.addEventListener('DOMContentLoaded', function() {
    userSession = new UserSessionManager();
});

// Make it globally available
window.UserSessionManager = UserSessionManager;