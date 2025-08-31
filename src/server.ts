import express, { Application } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import playerRoutes from './routes/players';
import matchRoutes from './routes/matches';
import gameRoutes from './routes/games';

dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env['CORS_ORIGIN']?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env['CORS_ORIGIN']?.split(',') || ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env['MONGODB_URI'] || 'mongodb://localhost:27017/go-game-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
} as mongoose.ConnectOptions)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/games', gameRoutes);

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  // Join game room
  socket.on('join-game', (gameId: string) => {
    socket.join(`game-${gameId}`);
    console.log(`Client ${socket.id} joined game ${gameId}`);
  });

  // Leave game room
  socket.on('leave-game', (gameId: string) => {
    socket.leave(`game-${gameId}`);
    console.log(`Client ${socket.id} left game ${gameId}`);
  });

  // Handle game moves
  socket.on('game-move', (data: { gameId: string; x: number; y: number; color: string }) => {
    socket.to(`game-${data.gameId}`).emit('game-update', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Go Game API is running' });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT: number = parseInt(process.env['PORT'] || '3000', 10);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
