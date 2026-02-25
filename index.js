// =============================
// FINAL PRO STATISTIC BOT
// =============================

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");

// =============================
// CLIENT
// =============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =============================
// DATA SYSTEM
// =============================

let data = {};
if (fs.existsSync("./data.json")) {
  data = JSON.parse(fs.readFileSync("./data.json"));
}

function save() {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const voiceMap = new Map();

// =============================
// READY
// =============================

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

// =============================
// MESSAGE TRACKING
// =============================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild.id;
  const user = message.author.id;
  const date = today();
  const channelId = message.channel.id;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = { daily: {}, channels: {} };
  }

  if (!data[guild][user].daily[date])
    data[guild][user].daily[date] = { messages: 0, voice: 0 };

  if (!data[guild][user].channels[channelId])
    data[guild][user].channels[channelId] = 0;

  data[guild][user].daily[date].messages += 1;
  data[guild][user].channels[channelId] += 1;

  save();

  if (message.content === "St?dashboard") {
    generateDashboard(message, guild, user);
  }
});

// =============================
// VOICE TRACKING
// =============================

client.on("voiceStateUpdate", (oldState, newState) => {
  const user = newState.id;
  const guild = newState.guild.id;
  const date = today();

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user])
    data[guild][user] = { daily: {}, channels: {} };

  if (!data[guild][user].daily[date])
    data[guild][user].daily[date] = { messages: 0, voice: 0 };

  if (!oldState.channel && newState.channel) {
    voiceMap.set(user, Date.now());
  }

  if (oldState.channel && !newState.channel) {
    const joinTime = voiceMap.get(user);
    if (!joinTime) return;

    const minutes = Math.floor((Date.now() - joinTime) / 60000);
    data[guild][user].daily[date].voice += minutes;

    save();
    voiceMap.delete(user);
  }
});

// =============================
// DASHBOARD
// =============================

async function generateDashboard(message, guild, user) {

  const canvas = createCanvas(1300, 750);
  const ctx = canvas.getContext("2d");

  // ===== RED BLACK GRADIENT BACKGROUND =====

const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
gradient.addColorStop(0, "#0f0f0f");     // deep black
gradient.addColorStop(0.5, "#1a0000");   // dark red
gradient.addColorStop(1, "#330000");     // red tone

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Radial glow effect (center highlight)
const glow = ctx.createRadialGradient(
  canvas.width / 2,
  canvas.height / 2,
  100,
  canvas.width / 2,
  canvas.height / 2,
  700
);

glow.addColorStop(0, "rgba(255, 0, 0, 0.25)");
glow.addColorStop(1, "rgba(0, 0, 0, 0)");

ctx.fillStyle = glow;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Subtle red overlay lines for animated feel
ctx.strokeStyle = "rgba(255,0,0,0.05)";
for (let i = 0; i < canvas.height; i += 40) {
  ctx.beginPath();
  ctx.moveTo(0, i);
  ctx.lineTo(canvas.width, i + 50);
  ctx.stroke();
}

  // Card function
  function card(x, y, w, h) {
    ctx.fillStyle = "#1f2127";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 25);
    ctx.fill();
  }

  // Layout
  card(40, 40, 1220, 160);
  card(40, 230, 600, 200);
  card(660, 230, 600, 200);
  card(40, 460, 1220, 250);

  const userData = data[guild][user];

  // Avatar
  const avatar = await loadImage(
    message.author.displayAvatarURL({ extension: "png" })
  );
  ctx.drawImage(avatar, 70, 70, 100, 100);

  ctx.fillStyle = "#ffffff";
  ctx.font = "34px Sans";
  ctx.fillText(message.author.username, 200, 120);

  // Dates
  ctx.font = "20px Sans";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(`Created: ${message.author.createdAt.toDateString()}`, 200, 160);
  ctx.fillText(`Joined: ${message.member.joinedAt.toDateString()}`, 500, 160);

  // Stats
  const stats1 = getLastDays(userData.daily, 1);
  const stats7 = getLastDays(userData.daily, 7);
  const stats14 = getLastDays(userData.daily, 14);

  // Rank
  const sorted = Object.entries(data[guild]).sort((a, b) =>
    totalMessages(b[1]) - totalMessages(a[1])
  );
  const rank = sorted.findIndex(u => u[0] === user) + 1;

  ctx.fillStyle = "#ff4d4d";
  ctx.font = "22px Sans";
  ctx.fillText(`Messages`, 70, 260);
  ctx.fillText(`1d: ${stats1.totalMsg}`, 70, 300);
  ctx.fillText(`7d: ${stats7.totalMsg}`, 70, 330);
  ctx.fillText(`14d: ${stats14.totalMsg}`, 70, 360);

  ctx.fillStyle = "#00cc66";
  ctx.fillText(`Voice`, 690, 260);
  ctx.fillText(`1d: ${stats1.totalVoice} mins`, 690, 300);
  ctx.fillText(`7d: ${stats7.totalVoice} mins`, 690, 330);
  ctx.fillText(`14d: ${stats14.totalVoice} mins`, 690, 360);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Server Rank: #${rank}`, 950, 120);

  // Top Channel
  const topChannel = getTopChannel(userData.channels);
  ctx.fillText(`Top Channel: ${topChannel}`, 950, 160);

  drawGraph(ctx, stats14.msgArray, stats14.voiceArray);

  const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
    name: "pro-dashboard.png"
  });

  message.reply({ files: [attachment] });
}

// =============================
// GRAPH
// =============================

function drawGraph(ctx, messages, voice) {
  const startX = 80;
  const startY = 680;
  const width = 1140;
  const height = 180;
  const max = Math.max(...messages, ...voice, 10);

  ctx.lineWidth = 3;

  ctx.strokeStyle = "#333";
  for (let i = 0; i <= 5; i++) {
    const y = startY - (i * height / 5);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.stroke();
  }

  ctx.shadowBlur = 15;

  ctx.strokeStyle = "#ff4d4d";
  ctx.shadowColor = "#ff4d4d";
  ctx.beginPath();
  messages.forEach((val, i) => {
    const x = startX + (i * width / messages.length);
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#00cc66";
  ctx.shadowColor = "#00cc66";
  ctx.beginPath();
  voice.forEach((val, i) => {
    const x = startX + (i * width / voice.length);
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// =============================
// HELPERS
// =============================

function getLastDays(daily, days) {
  const msgArray = [];
  const voiceArray = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    msgArray.push(daily[key]?.messages || 0);
    voiceArray.push(daily[key]?.voice || 0);
  }
  return {
    msgArray,
    voiceArray,
    totalMsg: msgArray.reduce((a, b) => a + b, 0),
    totalVoice: voiceArray.reduce((a, b) => a + b, 0)
  };
}

function totalMessages(user) {
  return Object.values(user.daily || {})
    .reduce((sum, d) => sum + (d.messages || 0), 0);
}

function getTopChannel(channels = {}) {
  const sorted = Object.entries(channels)
    .sort((a, b) => b[1] - a[1]);
  return sorted[0] ? `<#${sorted[0][0]}>` : "None";
}

client.login(process.env.TOKEN);
