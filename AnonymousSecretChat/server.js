const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3020;

// Setup file upload using multer
const upload = multer({
  dest: path.join(__dirname, 'public/uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit to 10MB
});

// Serve static files (e.g., images)
app.use(express.static(path.join(__dirname, 'public')));

// Handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  res.send({
    message: 'Image uploaded successfully!',
    imageUrl: `/uploads/${req.file.filename}`, // URL to the uploaded image
  });
});

// Setup socket.io
let users = [];
const chatFile = path.join(__dirname, 'chats.json');
let chatHistory = [];

if (fs.existsSync(chatFile)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(chatFile));
  } catch (err) {
    console.error('Error reading chat file:', err.message);
  }
}

function saveChat(message) {
  chatHistory.push(message);
  fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2));
}

io.on('connection', (socket) => {
  console.log("A user connected");

  socket.on('register', (username) => {
    socket.username = username;
    users.push(username);

    // Notify everyone that a user has joined
    io.emit('user joined', `${username} has joined the chat`);

    // Send chat history to the newly connected user
    chatHistory.forEach((msg) => {
      socket.emit('chat message', msg);
    });
  });

  socket.on('chat message', (msg) => {
    const messageObj = {
      sender: socket.username,
      msg,
      timestamp: new Date().toISOString(),
    };
    io.emit('chat message', messageObj);
    saveChat(messageObj);
  });

  socket.on('send image', (imageUrl) => {
    const messageObj = {
      sender: socket.username,
      msg: imageUrl,
      timestamp: new Date().toISOString(),
      type: 'image',
    };
    io.emit('chat message', messageObj);
    saveChat(messageObj);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users = users.filter(u => u !== socket.username);
      // Notify everyone that a user has left
      io.emit('user left', `${socket.username} has left the chat`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
