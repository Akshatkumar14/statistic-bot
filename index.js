const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

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
if (fs.existsSync('./data.json')) {
  data = JSON.parse(fs.readFileSync('./data.json'));
}

function save() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

const voiceMap = new Map();

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

/* MESSAGE + XP SYSTEM */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild.id;
  const user = message.author.id;
  const content = message.content;

  if (!data[guild]) data[guild] = {};
  if (!data[guild][user]) {
    data[guild][user] = {
      messages: 0,
      xp: 0,
      level: 0,
      voice: 0
    };
  }

  // Track messages + XP
  data[guild][user].messages += 1;
  data[guild][user].xp += 5;
  data[guild][user].level = Math.floor(data[guild][user].xp / 100);

  save();

  /* ===============================
     St?me → Personal Stats
  =============================== */
  if (content === "St?me") {

    const userData = data[guild][user];

    const embed = new EmbedBuilder()
      .setTitle("📊 Your Stats")
      .setColor("Blue")
      .addFields(
        { name: "💬 Messages", value: `${userData.messages}`, inline: true },
        { name: "⭐ XP", value: `${userData.xp}`, inline: true },
        { name: "🏆 Level", value: `${userData.level}`, inline: true },
        { name: "🎤 Voice Minutes", value: `${userData.voice}`, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }

  /* ===============================
     St?m → Message Leaderboard
  =============================== */
  if (content === "St?m") {

    const users = Object.entries(data[guild] || {});
    const sorted = users.sort((a, b) => b[1].messages - a[1].messages);

    let desc = "";
    sorted.slice(0, 10).forEach((u, i) => {
      desc += `**${i + 1}.** <@${u[0]}> — ${u[1].messages} msgs\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("📊 Message Leaderboard")
      .setColor("Green")
      .setDescription(desc || "No data yet.");

    return message.reply({ embeds: [embed] });
  }

  /* ===============================
     St?v → Voice Leaderboard
  =============================== */
  if (content === "St?v") {

    const users = Object.entries(data[guild] || {});
    const sorted = users.sort((a, b) => b[1].voice - a[1].voice);

    let desc = "";
    sorted.slice(0, 10).forEach((u, i) => {
      desc += `**${i + 1}.** <@${u[0]}> — ${u[1].voice} mins\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🎤 Voice Leaderboard")
      .setColor("Purple")
      .setDescription(desc || "No data yet.");

    return message.reply({ embeds: [embed] });
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
      voice: 0
    };
  }

  // Joined voice
  if (!oldState.channel && newState.channel) {
    voiceMap.set(user, Date.now());
  }

  // Left voice
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
