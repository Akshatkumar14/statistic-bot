// === IMPORTS ===
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");

// === CLIENT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// === DATA ===
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

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

// === MESSAGE TRACKING ===
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild.id;
  const user = message.author.id;
  const date = today();

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) data[guild][user] = { daily: {} };
  if (!data[guild][user].daily[date])
    data[guild][user].daily[date] = { messages: 0, voice: 0 };

  data[guild][user].daily[date].messages += 1;
  save();

  if (message.content === "St?dashboard") {
    generateDashboard(message, guild, user);
  }
});

// === VOICE TRACKING ===
client.on("voiceStateUpdate", (oldState, newState) => {
  const user = newState.id;
  const guild = newState.guild.id;
  const date = today();

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) data[guild][user] = { daily: {} };
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

// === DASHBOARD ===
async function generateDashboard(message, guild, user) {

  const canvas = createCanvas(1200, 650);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#17181c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function card(x, y, w, h) {
    ctx.fillStyle = "#23252b";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.fill();
  }

  // Panels
  card(40, 40, 350, 180);
  card(420, 40, 350, 180);
  card(800, 40, 350, 180);
  card(40, 260, 1110, 320);

  const avatar = await loadImage(
    message.author.displayAvatarURL({ extension: "png" })
  );
  ctx.drawImage(avatar, 60, 70, 100, 100);

  ctx.fillStyle = "#ffffff";
  ctx.font = "30px Sans";
  ctx.fillText(message.author.username, 180, 110);

  // === CALCULATIONS ===
  const stats1 = getLastDays(data[guild][user].daily, 1);
  const stats7 = getLastDays(data[guild][user].daily, 7);
  const stats14 = getLastDays(data[guild][user].daily, 14);

  const total14 = sum(stats14.messages);

  // Rank
  const allUsers = Object.entries(data[guild]);
  const sorted = allUsers.sort((a, b) =>
    sum(Object.values(b[1].daily || {}).map(d => d.messages || 0)) -
    sum(Object.values(a[1].daily || {}).map(d => d.messages || 0))
  );
  const rank = sorted.findIndex(u => u[0] === user) + 1;

  ctx.font = "22px Sans";
  ctx.fillStyle = "#ff4d4d";
  ctx.fillText(`1d: ${sum(stats1.messages)} msgs`, 440, 110);
  ctx.fillText(`7d: ${sum(stats7.messages)} msgs`, 440, 150);
  ctx.fillText(`14d: ${sum(stats14.messages)} msgs`, 440, 190);

  ctx.fillStyle = "#00cc66";
  ctx.fillText(`1d: ${sum(stats1.voice)} mins`, 820, 110);
  ctx.fillText(`7d: ${sum(stats7.voice)} mins`, 820, 150);
  ctx.fillText(`14d: ${sum(stats14.voice)} mins`, 820, 190);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Rank #${rank}`, 180, 150);

  // === GRAPH ===
  drawGraph(ctx, stats14.messages, stats14.voice);

  const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
    name: "dashboard.png"
  });

  message.reply({ files: [attachment] });
}

// === GRAPH WITH GRID + GLOW ===
function drawGraph(ctx, messages, voice) {

  const startX = 80;
  const startY = 540;
  const width = 1040;
  const height = 250;

  const max = Math.max(...messages, ...voice, 10);

  // Grid
  ctx.strokeStyle = "#333";
  for (let i = 0; i <= 5; i++) {
    const y = startY - (i * height / 5);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.stroke();
  }

  // Glow effect
  ctx.shadowBlur = 15;

  // Messages
  ctx.strokeStyle = "#ff4d4d";
  ctx.shadowColor = "#ff4d4d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  messages.forEach((val, i) => {
    const x = startX + (i * (width / messages.length));
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Voice
  ctx.strokeStyle = "#00cc66";
  ctx.shadowColor = "#00cc66";
  ctx.beginPath();
  voice.forEach((val, i) => {
    const x = startX + (i * (width / voice.length));
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// === HELPERS ===
function getLastDays(daily, days) {
  const messages = [];
  const voice = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    messages.push(daily[key]?.messages || 0);
    voice.push(daily[key]?.voice || 0);
  }
  return { messages, voice };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

client.login(process.env.TOKEN);
