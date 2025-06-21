// Store active games in memory
const activeGames = new Map();

class TicTacToeGame {
    constructor(roomId) {
        this.roomId = roomId;
        this.board = Array(9).fill(null); // 3x3 board
        this.players = [];
        this.currentPlayer = 0; // 0 for X, 1 for O
        this.gameStatus = 'waiting'; // waiting, playing, finished
        this.winner = null;
        this.gameCount = 0;
        this.statistics = {}; // Will store stats per player
        this.chatMessages = []; // Store chat messages
        this.createdAt = new Date();
        this.lastActivity = new Date();
    }

    addPlayer(playerId, playerName) {
        if (this.players.length < 2) {
            const symbol = this.players.length === 0 ? 'X' : 'O';
            const player = { id: playerId, name: playerName, symbol };
            this.players.push(player);
            
            // Initialize statistics for new player
            if (!this.statistics[playerId]) {
                this.statistics[playerId] = {
                    name: playerName,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    totalGames: 0
                };
            }
            
            if (this.players.length === 2) {
                this.gameStatus = 'playing';
            }
            
            this.lastActivity = new Date();
            return player;
        }
        return null;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.players.length < 2 && this.gameStatus === 'playing') {
            this.gameStatus = 'waiting';
        }
    }

    makeMove(playerId, position) {
        // Check if it's valid move
        if (this.gameStatus !== 'playing') return { success: false, message: 'Game not active' };
        if (this.board[position] !== null) return { success: false, message: 'Position taken' };
        if (this.players[this.currentPlayer].id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        // Make the move
        const currentPlayerObj = this.players[this.currentPlayer];
        this.board[position] = currentPlayerObj.symbol;

        // Check for winner
        const winner = this.checkWinner();
        if (winner) {
            this.gameStatus = 'finished';
            this.winner = currentPlayerObj;
            this.gameCount++;
            this.updateStatistics('win', currentPlayerObj.id);
            this.lastActivity = new Date();
            return { success: true, winner: currentPlayerObj, board: this.board };
        }

        // Check for draw
        if (this.board.every(cell => cell !== null)) {
            this.gameStatus = 'finished';
            this.gameCount++;
            this.updateStatistics('draw');
            this.lastActivity = new Date();
            return { success: true, draw: true, board: this.board };
        }

        // Switch player
        this.currentPlayer = this.currentPlayer === 0 ? 1 : 0;
        
        return { 
            success: true, 
            board: this.board, 
            nextPlayer: this.players[this.currentPlayer] 
        };
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (let pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a];
            }
        }
        return null;
    }

    updateStatistics(result, winnerId = null) {
        this.players.forEach(player => {
            const stats = this.statistics[player.id];
            stats.totalGames++;
            
            if (result === 'win') {
                if (player.id === winnerId) {
                    stats.wins++;
                } else {
                    stats.losses++;
                }
            } else if (result === 'draw') {
                stats.draws++;
            }
        });
    }

    addChatMessage(playerId, playerName, message) {
        const chatMessage = {
            id: Date.now() + Math.random(), // Simple unique ID
            playerId,
            playerName,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.chatMessages.push(chatMessage);
        this.lastActivity = new Date();
        
        // Keep only last 50 messages
        if (this.chatMessages.length > 50) {
            this.chatMessages = this.chatMessages.slice(-50);
        }
        
        return chatMessage;
    }

    getChatMessages() {
        return this.chatMessages;
    }

    terminateRoom() {
        this.gameStatus = 'terminated';
        this.lastActivity = new Date();
    }

    resetGame() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 0;
        this.gameStatus = this.players.length === 2 ? 'playing' : 'waiting';
        this.winner = null;
        this.lastActivity = new Date();
    }

    getGameState() {
        return {
            roomId: this.roomId,
            board: this.board,
            players: this.players,
            currentPlayer: this.players[this.currentPlayer],
            gameStatus: this.gameStatus,
            winner: this.winner,
            statistics: this.statistics,
            gameCount: this.gameCount,
            chatMessages: this.chatMessages,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity
        };
    }
}

module.exports = {
    createGame(roomId) {
        const game = new TicTacToeGame(roomId);
        activeGames.set(roomId, game);
        return game;
    },

    getGame(roomId) {
        return activeGames.get(roomId);
    },

    removeGame(roomId) {
        activeGames.delete(roomId);
    },

    getOrCreateGame(roomId) {
        let game = activeGames.get(roomId);
        if (!game) {
            game = this.createGame(roomId);
        }
        return game;
    },

    getAllGames() {
        return activeGames;
    }
};