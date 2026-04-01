const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

let messageId = null;

function getRaidStatus() {
  const now = DateTime.now().setZone('Europe/Berlin');
  const day = now.weekday;

  let start, end;
  const isWeekend = (day === 6 || day === 7);

  if (isWeekend) {
    start = now.set({ hour: 9, minute: 0, second: 0 });
    end = start.plus({ days: 1 }).set({ hour: 3 });

    if (now.hour < 3) {
      start = start.minus({ days: 1 });
      end = now.set({ hour: 3, minute: 0, second: 0 });
    }
  } else {
    start = now.set({ hour: 15, minute: 0, second: 0 });
    end = now.set({ hour: 23, minute: 0, second: 0 });
  }

  const isActive = now >= start && now <= end;

  let nextChange;

  if (isActive) {
    nextChange = end;
  } else {
    if (now < start) {
      nextChange = start;
    } else {
      let next = now.plus({ days: 1 });

      const nextDay = next.weekday;
      const weekend = (nextDay === 6 || nextDay === 7);

      if (weekend) {
        next = next.set({ hour: 9, minute: 0, second: 0 });
      } else {
        next = next.set({ hour: 15, minute: 0, second: 0 });
      }

      nextChange = next;
    }
  }

  const diff = nextChange.diff(now, ['hours', 'minutes']).toObject();

  return {
    isActive,
    nowCET: now,
    nowEST: now.setZone('America/New_York'),
    timeRemaining: `${Math.floor(diff.hours)}h ${Math.floor(diff.minutes)}m`
  };
}

async function updateMessage() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const status = getRaidStatus();

  const embed = new EmbedBuilder()
    .setTitle('🏴 Raid Status')
    .setColor(status.isActive ? 0x00ff00 : 0xff0000)
    .addFields(
      { name: 'Status', value: status.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE' },
      { name: 'CET', value: status.nowCET.toFormat('HH:mm'), inline: true },
      { name: 'EST', value: status.nowEST.toFormat('HH:mm'), inline: true },
      { name: 'Next Change In', value: status.timeRemaining }
    );

  if (!messageId) {
    const msg = await channel.send({ embeds: [embed] });
    messageId = msg.id;
  } else {
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
    } catch {
      const msg = await channel.send({ embeds: [embed] });
      messageId = msg.id;
    }
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateMessage();
  setInterval(updateMessage, 60000);
});

client.login(TOKEN);
