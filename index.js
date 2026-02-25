const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const fetch = require("node-fetch");
const fs = require("fs");

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
      voice: 0
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

    const avatar = message.author.displayAvatarURL({ extension: "png" });

    const url = `https://api.popcat.xyz/rank?avatar=${avatar}&username=${encodeURIComponent(message.author.username)}&level=${userData.level}&xp=${userData.xp}&rank=${rank}`;

    const response = await fetch(url);
    const buffer = await response.buffer();

    const attachment = new AttachmentBuilder(buffer, {
      name: "rank.png"
    });

    message.reply({ files: [attachment] });
  }
});

/* VOICE TRACKING */

client.on("voiceStateUpdate", (oldState, newState) => {
  const user = newState.id;
  const guild = newState.guild.id;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = {
      messages: 0,
      xp: 0,
      level: 0,
      voice: 0
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
