const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// GET /tic-tac-toe - Show join form
router.get('/', (req, res) => {
    res.render('games/tic-tac-toe', { 
        roomId: null, 
        playerName: null 
    });
});

// POST /tic-tac-toe/create - Create new room
router.post('/create', (req, res) => {
    const { playerName } = req.body;
    const roomId = uuidv4().substring(0, 8); // Short room ID
    
    // Redirect to the game room
    res.redirect(`/tic-tac-toe/room/${roomId}?player=${encodeURIComponent(playerName)}`);
});

// POST /tic-tac-toe/join - Join existing room
router.post('/join', (req, res) => {
    const { roomId, playerName } = req.body;
    res.redirect(`/tic-tac-toe/room/${roomId}?player=${encodeURIComponent(playerName)}`);
});

// GET /tic-tac-toe/room/:roomId - Game room
router.get('/room/:roomId', (req, res) => {
    const { roomId } = req.params;
    const { player } = req.query;
    
    if (!player) {
        return res.redirect('/tic-tac-toe');
    }
    
    res.render('games/tic-tac-toe', { 
        roomId, 
        playerName: player,
        shareUrl: `${req.protocol}://${req.get('host')}/tic-tac-toe/room/${roomId}`
    });
});

module.exports = router;