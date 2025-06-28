
document.addEventListener('DOMContentLoaded', function() {

    // Handle Quick Play buttons
    document.querySelectorAll('.quick-play-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameType = e.target.getAttribute('data-game');
            const roomId = 'ROOM_' + Math.random().toString(36).substr(2, 9).toUpperCase();
            window.location.href = `/games/${gameType}/${roomId}`;
        });
    });

    // Handle Join Room buttons
    document.querySelectorAll('.join-room-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameType = e.target.getAttribute('data-game');
            const gameCard = e.target.closest('.game-card');
            const roomCodeInput = gameCard.querySelector('.room-code-input');
            const roomCode = roomCodeInput.value.trim().toUpperCase();
                
            if (roomCode) {
                window.location.href = `/games/${gameType}/${roomCode}`;
            } else {
                alert('Please enter a room code');
            }
        });
    });

    // Handle Enter key in room code inputs
    document.querySelectorAll('.room-code-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const gameCard = e.target.closest('.game-card');
                const joinButton = gameCard.querySelector('.join-room-btn');
                joinButton.click();
            }
        });
    });

});