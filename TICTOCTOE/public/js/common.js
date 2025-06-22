// Common JavaScript functions for all pages
debugger
function createQuickRoom() {
    const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
    window.location.href = `/game/${roomId}`;
}

function generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'success');
    } catch (err) {
        showNotification('Could not copy to clipboard', 'error');
    }
    document.body.removeChild(textArea);
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
}

// Initialize common functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers for any copy buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-copy') || e.target.id === 'copy-room-id') {
            const roomId = window.location.pathname.split('/').pop();
            copyToClipboard(roomId);
        }
    });
});