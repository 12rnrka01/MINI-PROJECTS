class TicTacToeGameLogic {
    // Create a new game room
    createGameRoom(roomId) {
    return {
            id: roomId,
            players: [],
            board: Array(9).fill(null),
            currentPlayer: 'X',
            gameStatus: 'waiting', // waiting, playing, finished
            winner: null,
            messages: [],
            gameCount: 0,
            roundHistory: []
        };
    }

    // Check for winner
    checkWinner(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];
        
        for (let pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        
        if (!board.includes(null)) {
            return 'tie';
        }
        
        return null;
    }

}

module.exports = new TicTacToeGameLogic();
