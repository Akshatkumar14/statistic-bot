const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { QuickDB } = require("quick.db");
const db = new QuickDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.on("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  await db.add(`messages_${guildId}_${userId}`, 1);

  if (message.content === "st?me") {
    const messages = await db.get(`messages_${guildId}_${userId}`) || 0;

    const embed = new EmbedBuilder()
      .setTitle("📊 Your Stats")
      .setColor("Blue")
      .addFields({ name: "Messages", value: `${messages}` });

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
