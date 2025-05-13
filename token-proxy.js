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

const clients = new Map(); // Store client socket and role

wss.on('connection', (clientSocket) => {
  console.log('🔌 New WebSocket client connected');
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

  // Send Deepgram response to all clients with attached role
  deepgramSocket.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.channel?.alternatives?.length) {
        parsed.role = userRole;
        const jsonWithRole = JSON.stringify(parsed);

        // Broadcast to all connected clients
        for (const [client] of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonWithRole);
          }
        }
      }
    } catch (e) {
      console.error('❌ Deepgram parsing error:', e);
    }
  });

  clientSocket.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.role) {
        userRole = parsed.role;
        clients.set(clientSocket, userRole);
        console.log(`🎭 Role set to: ${userRole}`);
        return;
      }
    } catch {
      // Not JSON => it's audio
    }

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(message);
    }
  });

  clientSocket.on('close', () => {
    console.log('❌ WebSocket client disconnected');
    clients.delete(clientSocket);
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
