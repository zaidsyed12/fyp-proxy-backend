const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000; // ✅ Render injects PORT automatically

app.use(cors());

// ✅ Health check route for Render
app.get('/', (req, res) => {
  res.send('Token proxy is running');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientSocket) => {
  console.log('🔌 Client WebSocket connected');
  let userRole = 'unknown';

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
    try {
      const parsed = JSON.parse(message);
      if (parsed.channel?.alternatives?.length) {
        parsed.role = userRole;
      }
      clientSocket.send(JSON.stringify(parsed));
    } catch (e) {
      console.error('❌ Failed to parse Deepgram message:', e);
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
    } catch (err) {
      // Not JSON, assume it's audio
    }

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(message);
    }
  });

  deepgramSocket.on('close', () => clientSocket.close());
  clientSocket.on('close', () => deepgramSocket.close());

  deepgramSocket.on('error', (err) => console.error('Deepgram error:', err));
  clientSocket.on('error', (err) => console.error('Client error:', err));
});

server.listen(PORT, () => {
  console.log(`✅ Proxy WebSocket server running on port ${PORT}`);
});
