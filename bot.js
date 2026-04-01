const { Client, GatewayIntentBits } = require('discord.js');
const { DateTime } = require('luxon');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let messageRef;

// 🎯 Raid schedule logic (CET)
function getRaidStatus() {
  const now = DateTime.now().setZone('Europe/Berlin');

  const isWeekend = now.weekday >= 6;

  let start, end;

  if (isWeekend) {
    // Weekend: 09:00 - 03:00 (next day)
    start = now.set({ hour: 9, minute: 0, second: 0 });

    end = now
      .plus({ days: 1 })
      .set({ hour: 3, minute: 0, second: 0 });

    // If before 09:00, we’re still in the previous raid window
    if (now.hour < 3) {
      start = now.minus({ days: 1 }).set({ hour: 9, minute: 0, second: 0 });
      end = now.set({ hour: 3, minute: 0, second: 0 });
    }

  } else {
    // Weekday: 15:00 - 23:00
    start = now.set({ hour: 15, minute: 0, second: 0 });
    end = now.set({ hour: 23, minute: 0, second: 0 });
  }

  const inRaid = now >= start && now < end;

  const next = inRaid ? end : start;

  const diff = next.diff(now, ['hours', 'minutes', 'seconds']).toObject();

  const countdown = `${Math.floor(diff.hours || 0)}h ${Math.floor(diff.minutes || 0)}m ${Math.floor(diff.seconds || 0)}s`;

  return { now, inRaid, countdown };
}

// 🕒 Format CET + EST
function formatTimes(now) {
  const cet = now.toFormat('HH:mm');

  const est = now
    .setZone('America/New_York')
    .toFormat('h:mm a'); // 12-hour format with AM/PM

  return { cet, est };
}

// 🔁 Update Discord message
async function updateMessage() {
  const channel = await client.channels.fetch(CHANNEL_ID);

  const { now, inRaid, countdown } = getRaidStatus();
  const { cet, est } = formatTimes(now);

  const status = inRaid ? "🟢 RAID ACTIVE" : "🔴 RAID INACTIVE";
  const nextLabel = inRaid ? "Raid ends in" : "Raid starts in";

  const content = `
**DayZ Raid Status**

${status}

⏰ **CET:** ${cet}
⏰ **EST:** ${est}

⏳ **${nextLabel}:** ${countdown}
  `;

  try {
    if (!messageRef) {
      messageRef = await channel.send(content);
    } else {
      await messageRef.edit(content);
    }
  } catch (err) {
    console.error("Error updating message:", err);
  }
}

// 🚀 Bot ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await updateMessage();

  // update every 30 seconds
  setInterval(updateMessage, 30 * 1000);
});

client.login(TOKEN);
