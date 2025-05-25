import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { workerManager } from './lib/Worker';
import { SignalingServer } from './websocket/signaling';
import apiRoutes from './routes/api';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({
  server,
});

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

async function start() {
  try {
    // Initialize mediasoup workers
    await workerManager.init();

    // Initialize WebSocket signaling server
    new SignalingServer(wss);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function shutdown() {
  console.log('Shutting down...');
  workerManager.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

start();
