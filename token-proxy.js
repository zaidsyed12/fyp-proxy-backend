const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5001;

app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientSocket) => {
  console.log('🔌 Client WebSocket connected');

  const deepgramSocket = new WebSocket(
    'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&punctuate=true',
    {
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      },
    }
  );

  deepgramSocket.on('open', () => {
    console.log('🎧 Connected to Deepgram API');
  });

  deepgramSocket.on('message', (message) => {
    clientSocket.send(message);
  });

  clientSocket.on('message', (audioChunk) => {
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(audioChunk);
    }
  });

  deepgramSocket.on('close', () => clientSocket.close());
  clientSocket.on('close', () => deepgramSocket.close());

  deepgramSocket.on('error', (err) => console.error('Deepgram error:', err));
  clientSocket.on('error', (err) => console.error('Client error:', err));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy WebSocket server running at ws://0.0.0.0:${PORT}`);
});