const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Routes
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const sftpRoutes = require('./routes/sftp');
const sftpQuickRoutes = require('./routes/sftp-quick');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Database
const db = require('./config/database');

// Socket handlers
const socketHandler = require('./socket/socketHandler');

// Utilities
const cryptoUtil = require('./utils/crypto');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(frontendDistPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/sftp', sftpRoutes);
app.use('/api/sftp/quick', sftpQuickRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Crypto Endpoint
app.get('/api/crypto/public-key', (req, res) => {
  res.json({ publicKey: cryptoUtil.getPublicKey() });
});

// Socket.io connection handling
socketHandler(io);

// Frontend history fallback
if (fs.existsSync(frontendIndexPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(frontendIndexPath);
  });
}

// Database connection test
db.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Initialize RSA keys
cryptoUtil.initKeys();
console.log('RSA Keys initialized for secure payload transmission.');

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`WebSSH server running on port ${PORT}`);
});
