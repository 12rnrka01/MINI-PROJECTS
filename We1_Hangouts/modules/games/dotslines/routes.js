// modules/games/dotslines/routes.js
const express = require('express');
const router = express.Router();

// Dots and Lines game room route with grid size option
router.get('/:roomId', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const gridSize = req.query.size || 'medium'; // Default to medium (4x4)
    
    // Validate grid size
    const validSizes = ['small', 'medium', 'large', 'huge'];
    const selectedSize = validSizes.includes(gridSize) ? gridSize : 'medium';
    
    res.render('game', { 
        title: 'Dots and Lines Game',
        gameType: 'dotslines',
        roomId: roomId,
        gridSize: selectedSize
    });
});

// Dots and Lines lobby/room creation page
router.get('/', (req, res) => {
    res.render('dotslines-lobby', { 
        title: 'Dots and Lines Lobby',
        gameType: 'dotslines'
    });
});

// Create new Dots and Lines room with custom settings
router.post('/create', (req, res) => {
    const { gridSize, maxPlayers, allowSpectators } = req.body;
    
    // Validate inputs
    const validSizes = ['small', 'medium', 'large', 'huge'];
    const selectedSize = validSizes.includes(gridSize) ? gridSize : 'medium';
    const playerLimit = Math.min(Math.max(parseInt(maxPlayers) || 8, 2), 8);
    
    // Generate room ID
    const roomId = 'DOTS_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    res.json({
        success: true,
        roomId: roomId,
        gameUrl: `/games/dotslines/${roomId}?size=${selectedSize}`,
        settings: {
            gridSize: selectedSize,
            maxPlayers: playerLimit,
            allowSpectators: allowSpectators === 'true'
        }
    });
});

// API: Get active Dots and Lines rooms
router.get('/api/rooms', (req, res) => {
    // This would be populated from socket manager in a real implementation
    res.json({ 
        success: true, 
        rooms: [],
        message: 'Dots and Lines rooms retrieved successfully' 
    });
});

// API: Join room validation
router.post('/api/room/:roomId/join', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const { playerName, gridSize } = req.body;
    
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
    
    const validSizes = ['small', 'medium', 'large', 'huge'];
    const selectedSize = validSizes.includes(gridSize) ? gridSize : 'medium';
    
    res.json({ 
        success: true, 
        roomId: roomId,
        gridSize: selectedSize,
        message: 'Ready to join Dots and Lines room' 
    });
});

// API: Get grid size information
router.get('/api/grid-sizes', (req, res) => {
    const gridSizes = [
        { key: 'small', size: 3, description: '3×3 dots (2×2 boxes)', difficulty: 'Easy' },
        { key: 'medium', size: 4, description: '4×4 dots (3×3 boxes)', difficulty: 'Medium' },
        { key: 'large', size: 5, description: '5×5 dots (4×4 boxes)', difficulty: 'Hard' },
        { key: 'huge', size: 6, description: '6×6 dots (5×5 boxes)', difficulty: 'Expert' }
    ];
    
    res.json({
        success: true,
        gridSizes: gridSizes
    });
});

module.exports = router;