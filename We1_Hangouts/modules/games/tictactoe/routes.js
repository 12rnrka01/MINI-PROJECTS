const express = require('express');
const router = express.Router();


router.get('/', (req, res) => {
    res.render('game', { 
        title: 'Tic-Tac-Toe Lobby',
        gameType: 'tictactoe'
    });
});


router.get('/quick', (req, res) => {
    const roomId = 'ttt_' + Math.random().toString(36).substr(2, 9);
    res.redirect(`/games/tictactoe/${roomId}`);
});

router.get('/:roomId', (req, res) => {
    const { roomId } = req.params;
    
    res.render('game', { 
        title: 'Tic-Tac-Toe Game',
        gameType: 'tictactoe',
        roomId: roomId,
        shareUrl: `${req.protocol}://${req.get('host')}/games/tictactoe/${roomId}`
    });
});

router.post('/create', (req, res) => {
    const { playerName, isPrivate } = req.body;
    
    const roomId = isPrivate ? 
        'ttt_private_' + Math.random().toString(36).substr(2, 12) :
        'ttt_' + Math.random().toString(36).substr(2, 9);
    
    res.json({
        success: true,
        roomId: roomId,
        gameUrl: `/games/tictactoe/${roomId}`
    });
});

module.exports = router;
