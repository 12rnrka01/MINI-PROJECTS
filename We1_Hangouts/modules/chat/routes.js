const express = require('express');
const router = express.Router();

// GET /chat/stats - Get chat statistics
router.get('/stats', (req, res) => {
    res.json({
        totalRooms: 5,
        totalMessages: 150,
        activeUsers: 8
    });
});

// GET /chat/rooms - Get active chat rooms
router.get('/rooms', (req, res) => {
    const activeRooms = [
        {
            id: 'ttt_room1',
            name: 'Tic-Tac-Toe Room 1',
            activeUsers: 2,
            lastActivity: new Date()
        }
    ];
    
    res.json({ rooms: activeRooms });
});

module.exports = router;