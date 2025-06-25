// modules/games/connect4/gameLogic.js

class Connect4GameLogic {
    constructor() {
        this.ROWS = 6;
        this.COLS = 7;
        this.EMPTY = null;
        this.PLAYER1 = 'red';
        this.PLAYER2 = 'yellow';
    }

    // Create empty board
    createBoard() {
        return Array(this.ROWS * this.COLS).fill(this.EMPTY);
    }

    // Convert row, col to board index
    getIndex(row, col) {
        return row * this.COLS + col;
    }

    // Convert board index to row, col
    getRowCol(index) {
        return {
            row: Math.floor(index / this.COLS),
            col: index % this.COLS
        };
    }

    // Check if column is valid and not full
    isValidMove(board, col) {
        if (col < 0 || col >= this.COLS) {
            return false;
        }
        
        // Check if top row of column is empty
        return board[this.getIndex(0, col)] === this.EMPTY;
    }

    // Drop disc in column and return the row it landed in
    makeMove(board, col, player) {
        if (!this.isValidMove(board, col)) {
            return null;
        }

        // Find the lowest empty row in the column
        for (let row = this.ROWS - 1; row >= 0; row--) {
            const index = this.getIndex(row, col);
            if (board[index] === this.EMPTY) {
                board[index] = player;
                return { row, col, index };
            }
        }
        return null;
    }

    // Check for winner
    checkWinner(board) {
        // Check all possible winning combinations
        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const player = board[this.getIndex(row, col)];
                if (player === this.EMPTY) continue;

                // Check horizontal (right)
                if (this.checkDirection(board, row, col, 0, 1, player)) {
                    return { winner: player, type: 'horizontal', positions: this.getWinPositions(row, col, 0, 1) };
                }

                // Check vertical (down)
                if (this.checkDirection(board, row, col, 1, 0, player)) {
                    return { winner: player, type: 'vertical', positions: this.getWinPositions(row, col, 1, 0) };
                }

                // Check diagonal (down-right)
                if (this.checkDirection(board, row, col, 1, 1, player)) {
                    return { winner: player, type: 'diagonal', positions: this.getWinPositions(row, col, 1, 1) };
                }

                // Check diagonal (down-left)
                if (this.checkDirection(board, row, col, 1, -1, player)) {
                    return { winner: player, type: 'diagonal', positions: this.getWinPositions(row, col, 1, -1) };
                }
            }
        }

        // Check for draw
        if (this.isBoardFull(board)) {
            return { winner: 'draw', type: 'draw', positions: [] };
        }

        return null;
    }

    // Check direction for 4 in a row
    checkDirection(board, startRow, startCol, deltaRow, deltaCol, player) {
        let count = 0;
        
        for (let i = 0; i < 4; i++) {
            const row = startRow + i * deltaRow;
            const col = startCol + i * deltaCol;
            
            if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) {
                return false;
            }
            
            if (board[this.getIndex(row, col)] === player) {
                count++;
            } else {
                break;
            }
        }
        
        return count === 4;
    }

    // Get winning positions for highlighting
    getWinPositions(startRow, startCol, deltaRow, deltaCol) {
        const positions = [];
        for (let i = 0; i < 4; i++) {
            const row = startRow + i * deltaRow;
            const col = startCol + i * deltaCol;
            positions.push(this.getIndex(row, col));
        }
        return positions;
    }

    // Check if board is full (draw)
    isBoardFull(board) {
        for (let col = 0; col < this.COLS; col++) {
            if (board[this.getIndex(0, col)] === this.EMPTY) {
                return false;
            }
        }
        return true;
    }

    // Get available columns for AI or move validation
    getAvailableColumns(board) {
        const columns = [];
        for (let col = 0; col < this.COLS; col++) {
            if (this.isValidMove(board, col)) {
                columns.push(col);
            }
        }
        return columns;
    }

    // Get the next empty row in a column (for animation purposes)
    getNextEmptyRow(board, col) {
        if (!this.isValidMove(board, col)) {
            return -1;
        }
        
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (board[this.getIndex(row, col)] === this.EMPTY) {
                return row;
            }
        }
        return -1;
    }

    // Switch player
    switchPlayer(currentPlayer) {
        return currentPlayer === this.PLAYER1 ? this.PLAYER2 : this.PLAYER1;
    }

    // Get board state as 2D array (for easier debugging/display)
    getBoardAs2D(board) {
        const board2D = [];
        for (let row = 0; row < this.ROWS; row++) {
            const rowArray = [];
            for (let col = 0; col < this.COLS; col++) {
                rowArray.push(board[this.getIndex(row, col)]);
            }
            board2D.push(rowArray);
        }
        return board2D;
    }

    // Validate game state
    validateGameState(board, currentPlayer) {
        // Check if board is valid size
        if (board.length !== this.ROWS * this.COLS) {
            return { valid: false, error: 'Invalid board size' };
        }

        // Check if current player is valid
        if (currentPlayer !== this.PLAYER1 && currentPlayer !== this.PLAYER2) {
            return { valid: false, error: 'Invalid current player' };
        }

        // Check if board contains only valid values
        for (let i = 0; i < board.length; i++) {
            const cell = board[i];
            if (cell !== this.EMPTY && cell !== this.PLAYER1 && cell !== this.PLAYER2) {
                return { valid: false, error: 'Invalid board value' };
            }
        }

        return { valid: true };
    }

    // Get game statistics
    getGameStats(board) {
        let redCount = 0;
        let yellowCount = 0;
        let emptyCount = 0;

        board.forEach(cell => {
            if (cell === this.PLAYER1) redCount++;
            else if (cell === this.PLAYER2) yellowCount++;
            else emptyCount++;
        });

        return {
            red: redCount,
            yellow: yellowCount,
            empty: emptyCount,
            total: board.length,
            movesMade: redCount + yellowCount
        };
    }
}

module.exports = new Connect4GameLogic();