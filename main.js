const { WebcastPushConnection } = require("tiktok-live-connector");
const express = require("express");
const puppeteer = require("puppeteer");
const WebSocket = require("ws");
const http = require("http");

const SECRET_KEY = "SuperStars)9827^%^&^%^%^&***()827$#@#$%%%$##$"; // GANTI jika perlu
const USERNAME = "maskoplak630";

let lastRobloxEvent = null;
let leaderboard = {};
let tiktok;
let clients = [];

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// ========================
// 🌐 HTTP API untuk Roblox
// ========================

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

// ==========================
// 🔐 WebSocket Area
// ==========================

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

// 📡 TikTok Connect
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

function setupEventHandlers() {
  const events = ["gift", "follow", "like"];
  for (const type of events) {
    tiktok.on(type, (data) => {
      const username = data.user || data.uniqueId || "anonymous";
      const event = {
        eventType: type,
        username,
        profileImageUrl: "",
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
      console.log(`🎯 ${type.toUpperCase()} oleh @${username}`);
    });
  }
}

async function openLiveViewer() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto(`https://www.tiktok.com/@${USERNAME}/live`, { waitUntil: "networkidle2", timeout: 0 });
    console.log("👁️ TikTok Live Viewer dibuka di background");
  } catch (err) {
    console.error("❌ Gagal buka viewer TikTok:", err.message);
  }
}

// ✅ Mulai semua server & koneksi
server.listen(PORT, () => {
  console.log(`🚀 Server aktif di http://0.0.0.0:${PORT}`);
});
openLiveViewer();
connectTikTok();
