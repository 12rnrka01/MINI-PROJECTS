// modules/games/dotslines/gameLogic.js
class DotsLinesGameLogic {
    constructor() {
        this.GRID_SIZES = {
            small: 3,    // 3x3 dots (2x2 boxes)
            medium: 4,   // 4x4 dots (3x3 boxes)
            large: 5,    // 5x5 dots (4x4 boxes)
            huge: 6      // 6x6 dots (5x5 boxes)
        };
        
        this.PLAYER_COLORS = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
        ];
    }

    // Create a new Dots and Lines room
    createGameRoom(roomId, gridSize = 'medium') {
        const size = this.GRID_SIZES[gridSize];
        const gameState = {
            id: roomId,
            players: [],
            gridSize: gridSize,
            dotCount: size,
            boxCount: size - 1,
            gameStatus: 'waiting', // waiting, playing, finished
            currentPlayer: 0, // Index of current player
            gameType: 'dotslines',
            maxPlayers: 8,
            gameCount: 0,
            roundHistory: [],
            messages: [],
            createdAt: new Date(),
            
            // Game board state
            horizontalLines: this.createLineArray(size, size - 1), // horizontal lines
            verticalLines: this.createLineArray(size - 1, size),   // vertical lines
            boxes: this.createBoxArray(size - 1),                  // completed boxes
            
            // Game statistics
            scores: {},
            totalBoxes: (size - 1) * (size - 1),
            completedBoxes: 0,
            
            // Turn management
            lastMove: null,
            consecutiveTurns: false, // if player gets another turn for completing box
            
            settings: {
                allowSpectators: true,
                showScores: true,
                animateLines: true
            }
        };
        
        return gameState;
    }

    // Create array for lines (horizontal or vertical)
    createLineArray(rows, cols) {
        const lines = [];
        for (let row = 0; row < rows; row++) {
            lines[row] = [];
            for (let col = 0; col < cols; col++) {
                lines[row][col] = {
                    drawn: false,
                    playerId: null,
                    playerName: null,
                    timestamp: null,
                    color: null
                };
            }
        }
        return lines;
    }

    // Create array for boxes
    createBoxArray(size) {
        const boxes = [];
        for (let row = 0; row < size; row++) {
            boxes[row] = [];
            for (let col = 0; col < size; col++) {
                boxes[row][col] = {
                    completed: false,
                    playerId: null,
                    playerName: null,
                    color: null,
                    timestamp: null,
                    completingLine: null // which line completed this box
                };
            }
        }
        return boxes;
    }

    // Make a move (draw a line)
    makeMove(room, playerId, lineType, row, col) {
        // Validate move
        if (room.gameStatus !== 'playing') {
            return { success: false, message: 'Game is not active' };
        }

        const currentPlayerIndex = room.currentPlayer;
        const currentPlayer = room.players[currentPlayerIndex];
        
        if (!currentPlayer || currentPlayer.id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        // Check if line is already drawn
        const lineArray = lineType === 'horizontal' ? room.horizontalLines : room.verticalLines;
        
        if (!lineArray[row] || !lineArray[row][col]) {
            return { success: false, message: 'Invalid line position' };
        }

        if (lineArray[row][col].drawn) {
            return { success: false, message: 'Line already drawn' };
        }

        // Draw the line
        lineArray[row][col] = {
            drawn: true,
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            timestamp: new Date(),
            color: currentPlayer.color
        };

        // Check for completed boxes
        const completedBoxes = this.checkCompletedBoxes(room, lineType, row, col);
        
        // Update scores
        if (completedBoxes.length > 0) {
            if (!room.scores[currentPlayer.id]) {
                room.scores[currentPlayer.id] = 0;
            }
            room.scores[currentPlayer.id] += completedBoxes.length;
            room.completedBoxes += completedBoxes.length;
            
            // Player gets another turn for completing boxes
            room.consecutiveTurns = true;
        } else {
            // Move to next player
            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
            room.consecutiveTurns = false;
        }

        // Update last move
        room.lastMove = {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            lineType: lineType,
            row: row,
            col: col,
            completedBoxes: completedBoxes.length,
            timestamp: new Date()
        };

        // Check if game is finished
        if (room.completedBoxes >= room.totalBoxes) {
            room.gameStatus = 'finished';
            this.calculateFinalResults(room);
        }

        return {
            success: true,
            completedBoxes: completedBoxes,
            newScore: room.scores[currentPlayer.id] || 0,
            nextPlayer: room.currentPlayer,
            gameFinished: room.gameStatus === 'finished',
            consecutiveTurn: room.consecutiveTurns
        };
    }

    // Check for completed boxes after drawing a line
    checkCompletedBoxes(room, lineType, lineRow, lineCol) {
        const completedBoxes = [];
        const boxSize = room.dotCount - 1;

        if (lineType === 'horizontal') {
            // Check boxes above and below the line
            const boxesToCheck = [];
            
            // Box above the line
            if (lineRow > 0) {
                boxesToCheck.push({ row: lineRow - 1, col: lineCol });
            }
            
            // Box below the line
            if (lineRow < boxSize) {
                boxesToCheck.push({ row: lineRow, col: lineCol });
            }
            
            boxesToCheck.forEach(box => {
                if (this.isBoxCompleted(room, box.row, box.col)) {
                    this.completeBox(room, box.row, box.col, lineType, lineRow, lineCol);
                    completedBoxes.push({ row: box.row, col: box.col });
                }
            });
            
        } else { // vertical line
            // Check boxes to the left and right of the line
            const boxesToCheck = [];
            
            // Box to the left
            if (lineCol > 0) {
                boxesToCheck.push({ row: lineRow, col: lineCol - 1 });
            }
            
            // Box to the right
            if (lineCol < boxSize) {
                boxesToCheck.push({ row: lineRow, col: lineCol });
            }
            
            boxesToCheck.forEach(box => {
                if (this.isBoxCompleted(room, box.row, box.col)) {
                    this.completeBox(room, box.row, box.col, lineType, lineRow, lineCol);
                    completedBoxes.push({ row: box.row, col: box.col });
                }
            });
        }

        return completedBoxes;
    }

    // Check if a specific box is completed
    isBoxCompleted(room, boxRow, boxCol) {
        // Check if box is already marked as completed
        if (room.boxes[boxRow][boxCol].completed) {
            return false;
        }

        // Check all four sides of the box
        const top = room.horizontalLines[boxRow][boxCol]?.drawn;
        const bottom = room.horizontalLines[boxRow + 1][boxCol]?.drawn;
        const left = room.verticalLines[boxRow][boxCol]?.drawn;
        const right = room.verticalLines[boxRow][boxCol + 1]?.drawn;

        return top && bottom && left && right;
    }

    // Mark a box as completed
    completeBox(room, boxRow, boxCol, completingLineType, completingRow, completingCol) {
        const currentPlayer = room.players[room.currentPlayer];
        
        room.boxes[boxRow][boxCol] = {
            completed: true,
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            color: currentPlayer.color,
            timestamp: new Date(),
            completingLine: {
                type: completingLineType,
                row: completingRow,
                col: completingCol
            }
        };
    }

    // Calculate final game results
    calculateFinalResults(room) {
        const results = [];
        
        // Calculate scores for each player
        room.players.forEach(player => {
            const score = room.scores[player.id] || 0;
            results.push({
                playerId: player.id,
                playerName: player.name,
                score: score,
                percentage: Math.round((score / room.totalBoxes) * 100)
            });
        });

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);
        
        // Determine winner(s)
        const highestScore = results[0]?.score || 0;
        const winners = results.filter(r => r.score === highestScore);
        
        room.gameResults = {
            rankings: results,
            winners: winners,
            isDraw: winners.length > 1,
            totalBoxes: room.totalBoxes,
            gameEndTime: new Date()
        };

        // Update round history
        room.roundHistory.push({
            gameNumber: room.gameCount + 1,
            results: results,
            winners: winners,
            totalMoves: this.countTotalMoves(room),
            gameDuration: Date.now() - room.gameStartTime,
            timestamp: new Date()
        });

        return room.gameResults;
    }

    // Count total moves made in the game
    countTotalMoves(room) {
        let moves = 0;
        
        // Count horizontal lines
        room.horizontalLines.forEach(row => {
            row.forEach(line => {
                if (line.drawn) moves++;
            });
        });
        
        // Count vertical lines
        room.verticalLines.forEach(row => {
            row.forEach(line => {
                if (line.drawn) moves++;
            });
        });
        
        return moves;
    }

    // Get game statistics
    getGameStats(room) {
        const totalLines = this.getTotalLineCount(room.dotCount);
        const drawnLines = this.countTotalMoves(room);
        const progress = Math.round((drawnLines / totalLines) * 100);
        
        return {
            gridSize: room.gridSize,
            dotCount: room.dotCount,
            totalBoxes: room.totalBoxes,
            completedBoxes: room.completedBoxes,
            boxProgress: Math.round((room.completedBoxes / room.totalBoxes) * 100),
            totalLines: totalLines,
            drawnLines: drawnLines,
            lineProgress: progress,
            currentPlayer: room.players[room.currentPlayer]?.name || 'Unknown',
            players: room.players.length,
            scores: room.scores
        };
    }

    // Get total number of possible lines
    getTotalLineCount(dotCount) {
        const horizontalLines = dotCount * (dotCount - 1);
        const verticalLines = (dotCount - 1) * dotCount;
        return horizontalLines + verticalLines;
    }

    // Reset game for new round
    resetGame(room) {
        const size = room.dotCount;
        
        room.horizontalLines = this.createLineArray(size, size - 1);
        room.verticalLines = this.createLineArray(size - 1, size);
        room.boxes = this.createBoxArray(size - 1);
        room.scores = {};
        room.completedBoxes = 0;
        room.currentPlayer = 0;
        room.lastMove = null;
        room.consecutiveTurns = false;
        room.gameStatus = room.players.length >= 2 ? 'playing' : 'waiting';
        room.gameCount++;
        room.gameStartTime = Date.now();
        
        // Reassign player colors
        room.players.forEach((player, index) => {
            player.color = this.PLAYER_COLORS[index % this.PLAYER_COLORS.length];
        });

        return room;
    }

    // Validate grid size
    isValidGridSize(size) {
        return Object.keys(this.GRID_SIZES).includes(size);
    }

    // Get available grid sizes
    getAvailableGridSizes() {
        return Object.keys(this.GRID_SIZES).map(key => ({
            key: key,
            size: this.GRID_SIZES[key],
            description: `${this.GRID_SIZES[key]}×${this.GRID_SIZES[key]} dots (${this.GRID_SIZES[key]-1}×${this.GRID_SIZES[key]-1} boxes)`
        }));
    }

    // Check if line position is valid
    isValidLinePosition(room, lineType, row, col) {
        if (lineType === 'horizontal') {
            return row >= 0 && row < room.dotCount && 
                   col >= 0 && col < (room.dotCount - 1);
        } else {
            return row >= 0 && row < (room.dotCount - 1) && 
                   col >= 0 && col < room.dotCount;
        }
    }

    // Get line at position
    getLine(room, lineType, row, col) {
        const lineArray = lineType === 'horizontal' ? room.horizontalLines : room.verticalLines;
        return lineArray[row]?.[col] || null;
    }

    // Get box at position
    getBox(room, row, col) {
        return room.boxes[row]?.[col] || null;
    }

    // Calculate AI move (for future AI implementation)
    calculateAIMove(room) {
        // Simple AI: prefer moves that complete boxes, avoid moves that give opponent boxes
        const availableMoves = this.getAvailableMoves(room);
        
        // Priority 1: Moves that complete boxes
        const completingMoves = availableMoves.filter(move => {
            return this.wouldCompleteBox(room, move.lineType, move.row, move.col);
        });
        
        if (completingMoves.length > 0) {
            return completingMoves[Math.floor(Math.random() * completingMoves.length)];
        }
        
        // Priority 2: Safe moves (don't give opponent boxes)
        const safeMoves = availableMoves.filter(move => {
            return !this.wouldGiveOpponentBox(room, move.lineType, move.row, move.col);
        });
        
        if (safeMoves.length > 0) {
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }
        
        // Fallback: Random move
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Get all available moves
    getAvailableMoves(room) {
        const moves = [];
        
        // Check horizontal lines
        room.horizontalLines.forEach((row, rowIndex) => {
            row.forEach((line, colIndex) => {
                if (!line.drawn) {
                    moves.push({ lineType: 'horizontal', row: rowIndex, col: colIndex });
                }
            });
        });
        
        // Check vertical lines
        room.verticalLines.forEach((row, rowIndex) => {
            row.forEach((line, colIndex) => {
                if (!line.drawn) {
                    moves.push({ lineType: 'vertical', row: rowIndex, col: colIndex });
                }
            });
        });
        
        return moves;
    }

    // Check if move would complete a box
    wouldCompleteBox(room, lineType, row, col) {
        // Temporarily mark the line as drawn
        const lineArray = lineType === 'horizontal' ? room.horizontalLines : room.verticalLines;
        const originalState = lineArray[row][col].drawn;
        lineArray[row][col].drawn = true;
        
        // Check if any box would be completed
        const completedBoxes = this.checkCompletedBoxes(room, lineType, row, col);
        
        // Restore original state
        lineArray[row][col].drawn = originalState;
        
        return completedBoxes.length > 0;
    }

    // Check if move would give opponent a box opportunity
    wouldGiveOpponentBox(room, lineType, row, col) {
        // This is a more complex calculation for AI strategy
        // For now, simplified version
        return false;
    }
}

module.exports = new DotsLinesGameLogic();