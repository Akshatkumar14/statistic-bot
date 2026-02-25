const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const mongoose = require("mongoose");
const fetch = require("node-fetch");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ===============================
   DATABASE
=============================== */

mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  daily: Object
});

const User = mongoose.model("User", userSchema);

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ===============================
   READY
=============================== */

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

/* ===============================
   MESSAGE TRACKING
=============================== */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const date = today();

  let user = await User.findOne({
    guildId: message.guild.id,
    userId: message.author.id
  });

  if (!user) {
    user = new User({
      guildId: message.guild.id,
      userId: message.author.id,
      daily: {}
    });
  }

  if (!user.daily[date]) {
    user.daily[date] = { messages: 0, voice: 0 };
  }

  user.daily[date].messages += 1;
  await user.save();

  if (message.content === "St?dashboard") {
    generateDashboard(message, user);
  }
});

/* ===============================
   VOICE TRACKING
=============================== */

const voiceMap = new Map();

client.on("voiceStateUpdate", async (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const date = today();

  if (!oldState.channel && newState.channel) {
    voiceMap.set(userId, Date.now());
  }

  if (oldState.channel && !newState.channel) {
    const joinTime = voiceMap.get(userId);
    if (!joinTime) return;

    const minutes = Math.floor((Date.now() - joinTime) / 60000);

    let user = await User.findOne({ guildId, userId });
    if (!user) return;

    if (!user.daily[date]) {
      user.daily[date] = { messages: 0, voice: 0 };
    }

    user.daily[date].voice += minutes;
    await user.save();

    voiceMap.delete(userId);
  }
});

/* ===============================
   DASHBOARD IMAGE
=============================== */

async function generateDashboard(message, user) {

  const avatar = message.author.displayAvatarURL({ extension: "png" });

  const last7 = getLastDays(user.daily, 7);
  const last14 = getLastDays(user.daily, 14);

  const totalMessages = last14.messages;
  const totalVoice = last14.voice;

  const graphUrl = `https://quickchart.io/chart?c={
    type:'line',
    data:{
      labels:${JSON.stringify(last14.labels)},
      datasets:[
        {label:'Messages',data:${JSON.stringify(last14.messageArray)},borderColor:'red'},
        {label:'Voice',data:${JSON.stringify(last14.voiceArray)},borderColor:'green'}
      ]
    }
  }`;

  const imageApi = `https://api.popcat.xyz/rank?avatar=${avatar}&username=${encodeURIComponent(message.author.username)}&level=${Math.floor(totalMessages/100)}&xp=${totalMessages}&rank=1`;

  const graphBuffer = await (await fetch(graphUrl)).buffer();
  const rankBuffer = await (await fetch(imageApi)).buffer();

  const graphAttachment = new AttachmentBuilder(graphBuffer, { name: "graph.png" });
  const rankAttachment = new AttachmentBuilder(rankBuffer, { name: "rank.png" });

  message.reply({
    content: `📊 **Your 14-Day Dashboard**\nMessages: ${totalMessages}\nVoice: ${totalVoice} mins`,
    files: [rankAttachment, graphAttachment]
  });
}

function getLastDays(daily, days) {
  const labels = [];
  const messageArray = [];
  const voiceArray = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    labels.push(key.slice(5));
    messageArray.push(daily[key]?.messages || 0);
    voiceArray.push(daily[key]?.voice || 0);
  }

  return {
    labels,
    messageArray,
    voiceArray,
    messages: messageArray.reduce((a, b) => a + b, 0),
    voice: voiceArray.reduce((a, b) => a + b, 0)
  };
}

client.login(process.env.TOKEN);
