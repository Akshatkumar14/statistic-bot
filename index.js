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
    GatewayIntentBits.GuildMembers
  ]
});

let data = {};
if (fs.existsSync("./data.json")) {
  data = JSON.parse(fs.readFileSync("./data.json"));
}

function save() {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild.id;
  const user = message.author.id;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = { messages: 0, xp: 0, level: 0 };
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

    const canvas = Canvas.createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1e1e2f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Avatar
    const avatar = await Canvas.loadImage(
      message.author.displayAvatarURL({ extension: "png" })
    );
    ctx.drawImage(avatar, 40, 50, 150, 150);

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "30px Sans";
    ctx.fillText(message.author.username, 220, 90);

    // Level + Rank
    ctx.font = "22px Sans";
    ctx.fillText(`Level: ${userData.level}`, 220, 130);
    ctx.fillText(`Rank: #${rank}`, 220, 160);

    // XP
    ctx.fillText(`XP: ${userData.xp}`, 220, 190);
    ctx.fillText(`Messages: ${userData.messages}`, 220, 220);

    // XP Bar
    const barWidth = 400;
    const xpProgress = (userData.xp % 100) / 100;
    ctx.fillStyle = "#555";
    ctx.fillRect(220, 200, barWidth, 15);
    ctx.fillStyle = "#00ff99";
    ctx.fillRect(220, 200, barWidth * xpProgress, 15);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "rank-card.png"
    });

    message.reply({ files: [attachment] });
  }
});

client.login(process.env.TOKEN);
