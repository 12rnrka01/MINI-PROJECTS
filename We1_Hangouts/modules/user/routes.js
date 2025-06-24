const express = require('express');
const router = express.Router();

// GET /user/online - Get online users count
router.get('/online', (req, res) => {
    res.json({
        onlineUsers: 12,
        totalUsers: 50
    });
});

// GET /user/stats - Get user statistics
router.get('/stats', (req, res) => {
    res.json({
        totalRegistered: 1000,
        activeToday: 25,
        gamesPlayed: 500
    });
});

module.exports = router;