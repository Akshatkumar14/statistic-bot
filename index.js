const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let data = {};

if (fs.existsSync('./data.json')) {
  data = JSON.parse(fs.readFileSync('./data.json'));
}

function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

client.on("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = { messages: 0 };

  data[guildId][userId].messages += 1;
  saveData();

  if (message.content === "St?me") {
    const messages = data[guildId][userId].messages;

    const embed = new EmbedBuilder()
      .setTitle("📊 Your Stats")
      .setColor("Blue")
      .addFields({ name: "Messages", value: `${messages}` });

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
