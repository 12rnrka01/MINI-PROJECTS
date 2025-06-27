// modules/games/bingo/routes.js
const express = require('express');
const router = express.Router();

// BINGO game room route with board size option
router.get('/:roomId', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const boardSize = req.query.size || 'medium'; // Default to medium (5x5)
    
    // Validate board size
    const validSizes = ['small', 'medium', 'large'];
    const selectedSize = validSizes.includes(boardSize) ? boardSize : 'medium';
    
    res.render('game', { 
        title: 'BINGO Game',
        gameType: 'bingo',
        roomId: roomId,
        boardSize: selectedSize
    });
});

// BINGO lobby/room creation page
router.get('/', (req, res) => {
    res.render('bingo-lobby', { 
        title: 'BINGO Lobby',
        gameType: 'bingo'
    });
});

// Create new BINGO room with custom settings
router.post('/create', (req, res) => {
    const { boardSize, autoCall, maxPlayers } = req.body;
    
    // Validate inputs
    const validSizes = ['small', 'medium', 'large'];
    const selectedSize = validSizes.includes(boardSize) ? boardSize : 'medium';
    const playerLimit = Math.min(Math.max(parseInt(maxPlayers) || 100, 2), 100);
    
    // Generate room ID
    const roomId = 'BINGO_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    res.json({
        success: true,
        roomId: roomId,
        gameUrl: `/games/bingo/${roomId}?size=${selectedSize}`,
        settings: {
            boardSize: selectedSize,
            maxPlayers: playerLimit,
            autoCall: autoCall === 'true'
        }
    });
});

// API: Get active BINGO rooms
router.get('/api/rooms', (req, res) => {
    // This would be populated from socket manager in a real implementation
    res.json({ 
        success: true, 
        rooms: [],
        message: 'BINGO rooms retrieved successfully' 
    });
});

// API: Join room validation
router.post('/api/room/:roomId/join', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const { playerName, boardSize } = req.body;
    
    if (!playerName || playerName.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Player name is required' 
        });
    }
    
    if (playerName.trim().length > 20) {
        return res.status(400).json({ 
            success: false, 
            message: 'Player name too long (max 20 characters)' 
        });
    }
    
    const validSizes = ['small', 'medium', 'large'];
    const selectedSize = validSizes.includes(boardSize) ? boardSize : 'medium';
    
    res.json({ 
        success: true, 
        roomId: roomId,
        boardSize: selectedSize,
        message: 'Ready to join BINGO room' 
    });
});

module.exports = router;