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
    GatewayIntentBits.GuildVoiceStates,
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

/* DASHBOARD */

async function generateDashboard(message, guild, user) {

  const last14 = getLastDays(data[guild][user].daily, 14);

  const graphUrl = `https://quickchart.io/chart?c={
    type:'line',
    data:{
      labels:${JSON.stringify(last14.labels)},
      datasets:[
        {label:'Messages',data:${JSON.stringify(last14.messages)},borderColor:'red'},
        {label:'Voice',data:${JSON.stringify(last14.voice)},borderColor:'green'}
      ]
    }
  }`;

  const graphBuffer = await (await fetch(graphUrl)).buffer();
  const graphAttachment = new AttachmentBuilder(graphBuffer, { name: "graph.png" });

  message.reply({
    content: `📊 14 Day Dashboard\nMessages: ${sum(last14.messages)}\nVoice: ${sum(last14.voice)} mins`,
    files: [graphAttachment]
  });
}

function getLastDays(daily, days) {
  const labels = [];
  const messages = [];
  const voice = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    labels.push(key.slice(5));
    messages.push(daily[key]?.messages || 0);
    voice.push(daily[key]?.voice || 0);
  }

  return { labels, messages, voice };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

client.login(process.env.TOKEN);
