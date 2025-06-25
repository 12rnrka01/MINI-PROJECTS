// modules/games/connect4/routes.js
const express = require('express');
const router = express.Router();

// Connect4 game room route
router.get('/:roomId', (req, res) => {
    const roomId = req.params.roomId.toUpperCase(); // Ensure uppercase
    
    res.render('game', { 
        title: 'Connect Four Game',
        gameType: 'connect4',
        roomId: roomId 
    });
});

// Connect4 game API routes (for future features)
router.get('/api/rooms', (req, res) => {
    // Return list of active Connect4 rooms
    res.json({ 
        success: true, 
        rooms: [], // This will be populated from socket manager
        message: 'Connect4 rooms retrieved successfully' 
    });
});

router.post('/api/room/:roomId/join', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const { playerName } = req.body;
    
    if (!playerName || playerName.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Player name is required' 
        });
    }
    
    // Validation for room joining will be handled by socket manager
    res.json({ 
        success: true, 
        roomId: roomId,
        message: 'Ready to join Connect4 room' 
    });
});

module.exports = router;