const { WebcastPushConnection } = require("tiktok-live-connector");
const express = require("express");
const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 4000;   // Gunakan 1 port dari env Railway

const SECRET_KEY = "SuperStars)9827^%^&^%^%^&***()827$#@#$%%%$##$"; 
const USERNAME = "maskoplak630";         

let lastRobloxEvent = null;
let leaderboard = {};
let tiktok;

// Koneksi TikTok Live
async function connectTikTok() {
  tiktok = new WebcastPushConnection(USERNAME);

  try {
    const state = await tiktok.connect();
    console.log(`📺 Terhubung ke TikTok LIVE roomId: ${state.roomId}`);
    setupEventHandlers();
  } catch (err) {
    console.error("❌ Gagal konek TikTok:", err.message);
    setTimeout(connectTikTok, 10000);
  }

  tiktok.on("disconnected", () => {
    console.warn("⚠️ Terputus dari TikTok, reconnect dalam 10 detik...");
    setTimeout(connectTikTok, 10000);
  });
}

// Setup handler event TikTok
function setupEventHandlers() {
  const events = ["gift", "follow", "like"];

  for (const type of events) {
    tiktok.on(type, (data) => {
      const username = data.user || data.uniqueId || "anonymous";
      const profileImageUrl = data.userProfilePic || data.profilePictureUrl || "";

      const event = {
        eventType: type,
        username,
        profileImageUrl,
        amount: type === "gift" ? data.diamondCount || 1 : undefined,
        giftId: data.gift?.giftId || data.giftId || 0,
        giftName: data.gift?.name || data.giftName || "Unknown Gift",
        timestamp: Date.now()
      };

      lastRobloxEvent = event;

      if (type === "gift") {
        const coins = data.diamondCount || 1;
        leaderboard[username] = (leaderboard[username] || 0) + coins;
      }

      broadcastToClients(event);
      console.log(`🎯 ${type.toUpperCase()} oleh @${username}`, event);
    });
  }
}

// Setup express
const app = express();

app.get("/roblox-event", (req, res) => {
  const token = req.query.token;
  if (token !== SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (lastRobloxEvent) {
    res.json(lastRobloxEvent);
    lastRobloxEvent = null;
  } else {
    res.json({ eventType: "none" });
  }
});

app.get("/leaderboard", (req, res) => {
  const sorted = Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])
    .map(([username, totalCoins]) => ({ username, totalCoins }));

  res.json({ leaderboard: sorted });
});

// Buat HTTP server dari Express app
const server = http.createServer(app);

// Buat WebSocket Server di atas HTTP server yang sama
const wss = new WebSocket.Server({ server });
let clients = [];

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const token = params.get("token");

  if (token !== SECRET_KEY) {
    ws.close(1008, "Unauthorized");
    console.log("❌ WebSocket client ditolak: token salah");
    return;
  }

  console.log("✅ WebSocket client terhubung");
  clients.push(ws);
  ws.send("🟢 WebSocket terhubung ke TikTok Event");

  ws.on("close", () => {
    console.log("🔌 WebSocket client disconnect");
    clients = clients.filter(client => client !== ws);
  });
});

function broadcastToClients(event) {
  const payload = JSON.stringify(event);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// Jalankan server HTTP + WebSocket di PORT yang sama
server.listen(PORT, () => {
  console.log(`🌐 Server HTTP & WebSocket aktif di port ${PORT}`);
});

// Jalankan koneksi TikTok LIVE
connectTikTok();
