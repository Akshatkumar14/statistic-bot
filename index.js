const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

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

/* MESSAGE TRACKING */

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

/* VOICE TRACKING */

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

/* DASHBOARD DESIGN */

async function generateDashboard(message, guild, user) {

  const canvas = createCanvas(1100, 500);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1f24";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card Function
  function card(x, y, w, h) {
    ctx.fillStyle = "#2a2c33";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 15);
    ctx.fill();
  }

  // Panels
  card(40, 40, 320, 150);   // Profile
  card(380, 40, 320, 150);  // Messages
  card(720, 40, 320, 150);  // Voice
  card(40, 220, 1000, 220); // Chart

  // Profile
  const avatar = await loadImage(
    message.author.displayAvatarURL({ extension: "png" })
  );

  ctx.drawImage(avatar, 60, 70, 80, 80);

  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Sans";
  ctx.fillText(message.author.username, 160, 100);

  // Stats
  const last14 = getLastDays(data[guild][user].daily, 14);

  ctx.font = "20px Sans";
  ctx.fillStyle = "#ff4d4d";
  ctx.fillText(`Messages (14d): ${sum(last14.messages)}`, 400, 110);

  ctx.fillStyle = "#00cc66";
  ctx.fillText(`Voice (14d): ${sum(last14.voice)} mins`, 740, 110);

  // Chart
  drawGraph(ctx, last14.messages, last14.voice);

  const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
    name: "dashboard.png"
  });

  message.reply({ files: [attachment] });
}

/* GRAPH */

function drawGraph(ctx, messages, voice) {

  const startX = 80;
  const startY = 380;
  const width = 920;
  const height = 150;

  const max = Math.max(...messages, ...voice, 10);

  ctx.lineWidth = 3;

  // Messages line
  ctx.strokeStyle = "#ff4d4d";
  ctx.beginPath();
  messages.forEach((val, i) => {
    const x = startX + (i * (width / messages.length));
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Voice line
  ctx.strokeStyle = "#00cc66";
  ctx.beginPath();
  voice.forEach((val, i) => {
    const x = startX + (i * (width / voice.length));
    const y = startY - (val / max) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

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
