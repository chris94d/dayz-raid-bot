const { Client, GatewayIntentBits } = require('discord.js');
const { DateTime } = require('luxon');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let messageRef;

// 🎯 Raid schedule logic (CET / Europe/Berlin handles DST automatically)
function getRaidStatus() {
  const now = DateTime.now().setZone('Europe/Berlin');

  // ✅ Friday (5), Saturday (6), Sunday (7) = weekend
  const isWeekend = now.weekday >= 5;

  let start, end;

  if (isWeekend) {
    // Weekend: 09:00 → 03:00 next day
    start = now.set({ hour: 9, minute: 0, second: 0 });

    end = start
      .plus({ days: 1 })
      .set({ hour: 3, minute: 0, second: 0 });

    // Handle early morning (00:00–03:00)
    if (now.hour < 3) {
      start = now.minus({ days: 1 }).set({ hour: 9, minute: 0, second: 0 });
      end = now.set({ hour: 3, minute: 0, second: 0 });
    }

  } else {
    // Weekday: 15:00 → 00:00 (midnight)
    start = now.set({ hour: 15, minute: 0, second: 0 });

    end = now
      .plus({ days: 1 })
      .set({ hour: 0, minute: 0, second: 0 });
  }

  const inRaid = now >= start && now < end;

  // Determine next start/end properly
  let nextStart = start;
  let nextEnd = end;

  if (inRaid) {
    nextEnd = end;
  } else {
    if (now < start) {
      nextStart = start;
      nextEnd = end;
    } else {
      // Move to next day schedule
      let next = now.plus({ days: 1 });

      const nextIsWeekend = next.weekday >= 5;

      if (nextIsWeekend) {
        nextStart = next.set({ hour: 9, minute: 0, second: 0 });
        nextEnd = nextStart.plus({ days: 1 }).set({ hour: 3, minute: 0, second: 0 });
      } else {
        nextStart = next.set({ hour: 15, minute: 0, second: 0 });
        nextEnd = next.plus({ days: 1 }).set({ hour: 0, minute: 0, second: 0 });
      }
    }
  }

  const target = inRaid ? nextEnd : nextStart;

  const diff = target.diff(now, ['hours', 'minutes', 'seconds']).toObject();

  const countdown = `${Math.floor(diff.hours || 0)}h ${Math.floor(diff.minutes || 0)}m ${Math.floor(diff.seconds || 0)}s`;

  return {
    now,
    inRaid,
    countdown,
    nextStart,
    nextEnd
  };
}

// 🕒 Format CET + EST
function formatTimes(now, nextStart, nextEnd) {
  const cetNow = now.toFormat('HH:mm');

  const estNow = now
    .setZone('America/New_York')
    .toFormat('h:mm a');

  const cetStart = nextStart.toFormat('HH:mm');
  const estStart = nextStart.setZone('America/New_York').toFormat('h:mm a');

  const cetEnd = nextEnd.toFormat('HH:mm');
  const estEnd = nextEnd.setZone('America/New_York').toFormat('h:mm a');

  return {
    cetNow,
    estNow,
    cetStart,
    estStart,
    cetEnd,
    estEnd
  };
}

// 🔁 Update Discord message
async function updateMessage() {
  const channel = await client.channels.fetch(CHANNEL_ID);

  const { now, inRaid, countdown, nextStart, nextEnd } = getRaidStatus();
  const times = formatTimes(now, nextStart, nextEnd);

  const status = inRaid ? "🟢 RAID ACTIVE" : "🔴 RAID INACTIVE";
  const nextLabel = inRaid ? "Raid ends in" : "Raid starts in";

  const content = `
**🏴 DayZ Raid Status**

${status}

⏰ **Current Time**
🇪🇺 CET: ${times.cetNow}
🇺🇸 EST: ${times.estNow}

⏳ **${nextLabel}:** ${countdown}

📅 **Next Raid Window**
Start → CET: ${times.cetStart} | EST: ${times.estStart}
End → CET: ${times.cetEnd} | EST: ${times.estEnd}
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
