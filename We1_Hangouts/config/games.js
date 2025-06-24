module.exports = {
    availableGames: ['tictactoe', 'connect4'],
    
    gameSettings: {
        tictactoe: {
            name: 'Tic-Tac-Toe',
            maxPlayers: 2,
            minPlayers: 2,
            boardSize: 9,
            turnBased: true,
            hasChat: true,
            defaultSettings: {
                boardSize: 3,
                winCondition: 3,
                turnTimer: 0
            }
        },
        connect4: {
            name: 'Connect 4',
            maxPlayers: 2,
            minPlayers: 2,
            boardSize: 42,
            turnBased: true,
            hasChat: true,
            defaultSettings: {
                rows: 6,
                cols: 7,
                winCondition: 4,
                turnTimer: 30
            }
        }
    },
    
    getGameConfig: function(gameName) {
        return this.gameSettings[gameName] || null;
    },
    
    isValidGame: function(gameName) {
        return this.availableGames.includes(gameName);
    }
};