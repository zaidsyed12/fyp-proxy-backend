const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Token proxy is running');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientSocket) => {
  console.log('🔌 New WebSocket client connected');
  let userRole = 'unknown';

  // Create a Deepgram socket for this client only
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

  // Receive transcript and send it back to this client only
  deepgramSocket.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.channel?.alternatives?.length) {
        parsed.role = userRole;
        clientSocket.send(JSON.stringify(parsed));
      }
    } catch (err) {
      console.error('❌ Deepgram parsing error:', err);
    }
  });

  clientSocket.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.role) {
        userRole = parsed.role;
        console.log(`🎭 Role set to: ${userRole}`);
        return;
      }
    } catch {
      // binary audio chunk
    }

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(message);
    }
  });

  clientSocket.on('close', () => {
    console.log('❌ Client disconnected');
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  });

  clientSocket.on('error', (err) => console.error('Client error:', err));
  deepgramSocket.on('error', (err) => console.error('Deepgram error:', err));
});

server.listen(PORT, () => {
  console.log(`✅ Proxy WebSocket server running on port ${PORT}`);
});