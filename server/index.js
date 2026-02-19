require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiLimiter);

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'client')));

// API Routes
app.use('/api/disasters', require('./routes/disasters'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/geocode', require('./routes/geocode'));
app.use('/api/disasters', require('./routes/socialMedia'));
app.use('/api/disasters', require('./routes/resources'));
app.use('/api/disasters', require('./routes/officialUpdates'));
app.use('/api/disasters', require('./routes/verification'));
app.use('/api/resources', require('./routes/resources'));

// Mock social media standalone endpoint
app.get('/api/mock-social-media', async (req, res) => {
  const { fetchSocialMediaPosts } = require('./services/socialMedia');
  const posts = await fetchSocialMediaPosts('mock', []);
  res.json(posts);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Error handler
app.use(errorHandler);

// WebSocket connections
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { id: socket.id });

  socket.on('join_disaster', (disasterId) => {
    socket.join(`disaster:${disasterId}`);
    logger.info(`Client joined disaster room`, { socketId: socket.id, disasterId });
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { id: socket.id });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Disaster Response Server running on port ${PORT}`);
  logger.info(`📡 WebSocket server active`);
  logger.info(`🌐 Frontend: http://localhost:${PORT}`);
  logger.info(`📋 API: http://localhost:${PORT}/api`);
});

module.exports = { app, server, io };
