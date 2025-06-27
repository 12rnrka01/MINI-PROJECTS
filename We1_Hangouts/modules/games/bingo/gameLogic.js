// modules/games/bingo/gameLogic.js
class BingoGameLogic {
    constructor() {
        this.BOARD_SIZES = {
            small: 3,    // 3x3 grid
            medium: 5,   // 5x5 grid (classic BINGO)
            large: 7     // 7x7 grid
        };
        
        this.NUMBER_RANGES = {
            small: { min: 1, max: 25 },    // 1-25 for 3x3
            medium: { min: 1, max: 75 },   // 1-75 for 5x5 (classic)
            large: { min: 1, max: 100 }    // 1-100 for 7x7
        };
    }

    // Create a new BINGO room
    createGameRoom(roomId, boardSize = 'medium') {
        const size = this.BOARD_SIZES[boardSize];
        const numberRange = this.NUMBER_RANGES[boardSize];
        
        return {
            id: roomId,
            players: [],
            boardSize: boardSize,
            gridSize: size,
            numberRange: numberRange,
            gameStatus: 'waiting', // waiting, playing, finished
            calledNumbers: [], // Numbers that have been called
            currentCaller: null, // Who is calling numbers
            gameType: 'bingo',
            maxPlayers: 100,
            gameCount: 0,
            roundHistory: [],
            messages: [],
            winners: [], // Can have multiple winners
            autoCallEnabled: false,
            autoCallInterval: null,
            lastCalledNumber: null,
            createdAt: new Date(),
            settings: {
                autoCallDelay: 5000, // 5 seconds between auto calls
                winConditions: ['line', 'fullHouse'], // line, corners, fullHouse
                allowMultipleWinners: true
            }
        };
    }

    // Generate a unique BINGO board for a player
    generatePlayerBoard(boardSize) {
        const size = this.BOARD_SIZES[boardSize];
        const numberRange = this.NUMBER_RANGES[boardSize];
        const totalCells = size * size;
        
        // Generate random numbers for the board
        const availableNumbers = [];
        for (let i = numberRange.min; i <= numberRange.max; i++) {
            availableNumbers.push(i);
        }
        
        // Shuffle and take required numbers
        const shuffled = this.shuffleArray([...availableNumbers]);
        const boardNumbers = shuffled.slice(0, totalCells);
        
        // Create board structure
        const board = [];
        for (let i = 0; i < totalCells; i++) {
            board.push({
                number: boardNumbers[i],
                marked: false,
                markedBy: null, // Who marked this number
                timestamp: null
            });
        }
        
        // Mark center cell as free space for medium and large boards
        if (size >= 5) {
            const centerIndex = Math.floor(totalCells / 2);
            board[centerIndex] = {
                number: 'FREE',
                marked: true,
                markedBy: 'system',
                timestamp: new Date()
            };
        }
        
        return board;
    }

    // Shuffle array utility
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Call a number (mark it on all player boards)
    callNumber(room, calledNumber, callerPlayerId) {
        if (room.calledNumbers.includes(calledNumber)) {
            return { success: false, message: 'Number already called' };
        }

        // Add to called numbers
        room.calledNumbers.push(calledNumber);
        room.lastCalledNumber = {
            number: calledNumber,
            calledBy: callerPlayerId,
            timestamp: new Date()
        };

        // Mark the number on all player boards
        const markedPlayers = [];
        room.players.forEach(player => {
            player.board.forEach((cell, index) => {
                if (cell.number === calledNumber && !cell.marked) {
                    cell.marked = true;
                    cell.markedBy = callerPlayerId;
                    cell.timestamp = new Date();
                    markedPlayers.push(player.name);
                }
            });
        });

        return {
            success: true,
            calledNumber: calledNumber,
            markedPlayers: markedPlayers,
            totalCalled: room.calledNumbers.length
        };
    }

    // Check for winners
    checkWinners(room) {
        const winners = [];
        const size = room.gridSize;
        
        room.players.forEach(player => {
            const winPatterns = this.getWinPatterns(player.board, size);
            
            winPatterns.forEach(pattern => {
                if (pattern.isWin && !player.hasWon) {
                    winners.push({
                        playerId: player.id,
                        playerName: player.name,
                        winType: pattern.type,
                        winPattern: pattern.pattern,
                        timestamp: new Date()
                    });
                    player.hasWon = true;
                    player.winTime = new Date();
                    player.stats.wins++;
                }
            });
        });

        return winners;
    }

    // Get win patterns for a board
    getWinPatterns(board, size) {
        const patterns = [];
        
        // Check rows
        for (let row = 0; row < size; row++) {
            const rowPattern = [];
            let isWin = true;
            
            for (let col = 0; col < size; col++) {
                const index = row * size + col;
                rowPattern.push(index);
                if (!board[index].marked) {
                    isWin = false;
                }
            }
            
            patterns.push({
                type: 'row',
                pattern: rowPattern,
                isWin: isWin
            });
        }
        
        // Check columns
        for (let col = 0; col < size; col++) {
            const colPattern = [];
            let isWin = true;
            
            for (let row = 0; row < size; row++) {
                const index = row * size + col;
                colPattern.push(index);
                if (!board[index].marked) {
                    isWin = false;
                }
            }
            
            patterns.push({
                type: 'column',
                pattern: colPattern,
                isWin: isWin
            });
        }
        
        // Check diagonals
        const diagonal1 = [];
        const diagonal2 = [];
        let diag1Win = true;
        let diag2Win = true;
        
        for (let i = 0; i < size; i++) {
            // Main diagonal (top-left to bottom-right)
            const diag1Index = i * size + i;
            diagonal1.push(diag1Index);
            if (!board[diag1Index].marked) {
                diag1Win = false;
            }
            
            // Anti-diagonal (top-right to bottom-left)
            const diag2Index = i * size + (size - 1 - i);
            diagonal2.push(diag2Index);
            if (!board[diag2Index].marked) {
                diag2Win = false;
            }
        }
        
        patterns.push({
            type: 'diagonal',
            pattern: diagonal1,
            isWin: diag1Win
        });
        
        patterns.push({
            type: 'diagonal',
            pattern: diagonal2,
            isWin: diag2Win
        });
        
        // Check full house (all numbers marked)
        const fullHousePattern = [];
        let fullHouseWin = true;
        
        for (let i = 0; i < board.length; i++) {
            fullHousePattern.push(i);
            if (!board[i].marked) {
                fullHouseWin = false;
            }
        }
        
        patterns.push({
            type: 'fullHouse',
            pattern: fullHousePattern,
            isWin: fullHouseWin
        });
        
        return patterns.filter(p => p.isWin);
    }

    // Get next random number to call
    getNextNumber(room) {
        const numberRange = room.numberRange;
        const availableNumbers = [];
        
        for (let i = numberRange.min; i <= numberRange.max; i++) {
            if (!room.calledNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }
        
        if (availableNumbers.length === 0) {
            return null; // No more numbers
        }
        
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        return availableNumbers[randomIndex];
    }

    // Calculate game statistics
    getGameStats(room) {
        const totalNumbers = room.numberRange.max - room.numberRange.min + 1;
        const calledPercentage = (room.calledNumbers.length / totalNumbers) * 100;
        
        return {
            totalPlayers: room.players.length,
            numbersHadCalled: room.calledNumbers.length,
            totalNumbers: totalNumbers,
            calledPercentage: Math.round(calledPercentage),
            winners: room.winners.length,
            gameStatus: room.gameStatus,
            boardSize: room.boardSize,
            gridSize: room.gridSize
        };
    }

    // Reset game for new round
    resetGame(room) {
        room.calledNumbers = [];
        room.lastCalledNumber = null;
        room.winners = [];
        room.gameCount++;
        room.gameStatus = 'waiting';
        
        // Reset all player boards and stats
        room.players.forEach(player => {
            player.board = this.generatePlayerBoard(room.boardSize);
            player.hasWon = false;
            player.winTime = null;
        });
        
        return room;
    }

    // Validate board size
    isValidBoardSize(size) {
        return Object.keys(this.BOARD_SIZES).includes(size);
    }

    // Get available numbers for a board size
    getAvailableNumbers(boardSize) {
        const range = this.NUMBER_RANGES[boardSize];
        const numbers = [];
        for (let i = range.min; i <= range.max; i++) {
            numbers.push(i);
        }
        return numbers;
    }

    // Check if number is valid for board size
    isValidNumber(number, boardSize) {
        const range = this.NUMBER_RANGES[boardSize];
        return number >= range.min && number <= range.max;
    }
}

module.exports = new BingoGameLogic();