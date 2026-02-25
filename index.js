const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const Canvas = require("canvas");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
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

const voiceMap = new Map();

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

/* ===============================
   MESSAGE + XP + VOICE TRACK
=============================== */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild.id;
  const user = message.author.id;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = {
      messages: 0,
      xp: 0,
      level: 0,
      voice: 0,
      theme: "blue"
    };
  }

  data[guild][user].messages += 1;
  data[guild][user].xp += 5;
  data[guild][user].level = Math.floor(data[guild][user].xp / 100);
  save();

  if (message.content === "St?me") {

    const users = Object.entries(data[guild]);
    const sorted = users.sort((a, b) => b[1].messages - a[1].messages);
    const rank = sorted.findIndex(u => u[0] === user) + 1;
    const userData = data[guild][user];

    const canvas = Canvas.createCanvas(900, 350);
    const ctx = canvas.getContext("2d");

    /* ===============================
       Animated Gradient Style Background
    =============================== */

    const gradient = ctx.createLinearGradient(0, 0, 900, 350);
    gradient.addColorStop(0, "#1e3c72");
    gradient.addColorStop(1, "#2a5298");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Avatar */
    const avatar = await Canvas.loadImage(
      message.author.displayAvatarURL({ extension: "png" })
    );
    ctx.drawImage(avatar, 50, 80, 150, 150);

    /* Username */
    ctx.fillStyle = "#ffffff";
    ctx.font = "28px Sans";
    ctx.fillText(message.author.username, 230, 90);

    ctx.font = "20px Sans";
    ctx.fillText(`Level: ${userData.level}`, 230, 130);
    ctx.fillText(`Rank: #${rank}`, 230, 160);
    ctx.fillText(`XP: ${userData.xp}`, 230, 190);
    ctx.fillText(`Messages: ${userData.messages}`, 230, 220);
    ctx.fillText(`Voice Minutes: ${userData.voice}`, 230, 250);

    /* ===============================
       XP BAR
    =============================== */

    const barWidth = 400;
    const progress = (userData.xp % 100) / 100;

    ctx.fillStyle = "#444";
    ctx.fillRect(230, 270, barWidth, 18);

    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(230, 270, barWidth * progress, 18);

    /* ===============================
       GRAPH (Bottom Left)
    =============================== */

    const graphX = 50;
    const graphY = 280;
    const graphWidth = 150;
    const graphHeight = 50;

    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);

    // Messages Line (Red)
    ctx.beginPath();
    ctx.strokeStyle = "red";
    ctx.moveTo(graphX, graphY + graphHeight);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight - (userData.messages % 50));
    ctx.stroke();

    // Voice Line (Green)
    ctx.beginPath();
    ctx.strokeStyle = "green";
    ctx.moveTo(graphX, graphY + graphHeight);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight - (userData.voice % 50));
    ctx.stroke();

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "rank-card.png"
    });

    message.reply({ files: [attachment] });
  }
});

/* ===============================
   VOICE TRACKING
=============================== */

client.on("voiceStateUpdate", (oldState, newState) => {
  const user = newState.id;
  const guild = newState.guild.id;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = {
      messages: 0,
      xp: 0,
      level: 0,
      voice: 0,
      theme: "blue"
    };
  }

  if (!oldState.channel && newState.channel) {
    voiceMap.set(user, Date.now());
  }

  if (oldState.channel && !newState.channel) {
    const joinTime = voiceMap.get(user);
    if (!joinTime) return;

    const minutes = Math.floor((Date.now() - joinTime) / 60000);
    data[guild][user].voice += minutes;
    save();
    voiceMap.delete(user);
  }
});

client.login(process.env.TOKEN);
