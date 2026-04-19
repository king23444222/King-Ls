module.exports = {
  config: {
    name: "gift",
    version: "4.0.0",
    author: "Mr.King",
    countDown: 2,
    role: 0,
    shortDescription: { en: "Send money to everyone or reply to someone" },
    category: "economy",
    guide: { en: "{pn} send [amount] all | {pn} [amount] (reply)" }
  },

  onStart: async function ({ api, event, args, message, usersData, threadsData }) {
    const { threadID, messageID, senderID, messageReply } = event;
    const adminUID = "100025325472659"; // 👑 আপনার নির্দিষ্ট UID

    // 🛡️ Authority Check (Only Boss)
    if (senderID !== adminUID) {
      return message.reply("𝐇𝐨𝐩 𝐛𝐜, 𝐊𝐧𝐨𝐰 𝐲𝐨𝐮𝐫 𝐩𝐥𝐚𝐜𝐞. 𝐎𝐧𝐥𝐲 𝐌𝐫. 𝐊𝐢𝐧𝐠 𝐜𝐚𝐧 𝐮𝐬𝐞 𝐭𝐡𝐢𝐬! 👑⚔️");
    }

    // 💰 Money Parser (k, m, b, t, q সাপোর্ট)
    const parseAmount = (str) => {
      if (!str) return 0;
      const units = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 };
      const match = str.toLowerCase().match(/^(\d+(?:\.\d+)?)([kmbteq])?$/);
      if (!match) return parseFloat(str);
      const value = parseFloat(match[1]);
      const unit = match[2];
      return unit ? Math.floor(value * units[unit]) : Math.floor(value);
    };

    if (args.length === 0) return message.reply("📢 𝐔𝐬𝐚𝐠𝐞:\n𝟏. /𝐠𝐢𝐟𝐭 𝐬𝐞𝐧𝐝 𝟏𝟎𝟎𝟎𝐦 𝐚𝐥𝐥 (𝐒𝐞𝐧𝐝 𝐭𝐨 𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞)\n𝟐. 𝐑𝐞𝐩𝐥𝐲 + /𝐠𝐢𝐟𝐭 𝟓𝟎𝟎𝐤 (𝐒𝐞𝐧𝐝 𝐭𝐨 𝐔𝐬𝐞𝐫)");

    // 🌍 ১. এক কমান্ডে সবাইকে পাঠানোর সিস্টেম (Send to All)
    if (args[0] === "send" && args[2] === "all") {
      const amount = parseAmount(args[1]);
      if (isNaN(amount) || amount <= 0) return message.reply("⚠️ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐚𝐦𝐨𝐮𝐧𝐭! 𝐄𝐠: 𝟏𝟎𝟎𝐦, 𝟏𝟎𝐭");

      const threadInfo = await api.getThreadInfo(threadID);
      const participantIDs = threadInfo.participantIDs;

      api.sendMessage(`⏳ 𝐏𝐫𝐨𝐜𝐞𝐬𝐬𝐢𝐧𝐠 𝐆𝐢𝐟𝐭 𝐟𝐨𝐫 ${participantIDs.length} 𝐦𝐞𝐦𝐛𝐞𝐫𝐬...`, threadID);

      for (const id of participantIDs) {
        const userData = await usersData.get(id);
        await usersData.set(id, { money: (userData.money || 0) + amount });
      }

      return api.sendMessage(`🔥 𝐁𝐎𝐒𝐒 𝐃𝐎𝐍𝐀𝐓𝐈𝐎𝐍 🔥\n──────────────────\n👑 𝐌𝐫. 𝐊𝐢𝐧𝐠 𝐬𝐞𝐧𝐭 $${args[1].toUpperCase()} 𝐭𝐨 𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞!\n💰 𝐄𝐚𝐜𝐡 𝐌𝐞𝐦𝐛𝐞𝐫 𝐑𝐞𝐜𝐞𝐢𝐯𝐞𝐝: +${amount.toLocaleString()}\n──────────────────\n✅ 𝐀𝐥𝐥 𝐭𝐫𝐚𝐧𝐬𝐚𝐜𝐭𝐢𝐨𝐧𝐬 𝐜𝐨𝐦𝐩𝐥𝐞𝐭𝐞𝐝!`, threadID);
    }

    // 👤 ২. রিপ্লাই দিয়ে একজনকে পাঠানোর সিস্টেম
    if (messageReply) {
      const amount = parseAmount(args[0]);
      if (isNaN(amount) || amount <= 0) return message.reply("⚠️ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐩𝐫𝐨𝐯𝐢𝐝𝐞 𝐚𝐧 𝐚𝐦𝐨𝐮𝐧𝐭! 𝐄𝐠: /𝐠𝐢𝐟𝐭 𝟏𝟎𝟎𝐦");

      const targetID = messageReply.senderID;
      const userData = await usersData.get(targetID);
      await usersData.set(targetID, { money: (userData.money || 0) + amount });

      return api.sendMessage(`🎁 𝐆𝐈𝐅𝐓 𝐒𝐄𝐍𝐓 🎁\n──────────────────\n💰 𝐀𝐦𝐨𝐮𝐧𝐭: +${amount.toLocaleString()}\n👑 𝐅𝐫𝐨𝐦: 𝐌𝐫. 𝐊𝐢𝐧𝐠\n──────────────────\n✅ 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲 𝐃𝐞𝐥𝐢𝐯𝐞𝐫𝐞𝐝!`, threadID, messageID);
    }

    return message.reply("📢 𝐔𝐬𝐞 /𝐠𝐢𝐟𝐭 𝐬𝐞𝐧𝐝 [𝐚𝐦𝐨𝐮𝐧𝐭] 𝐚𝐥𝐥 𝐨𝐫 𝐫𝐞𝐩𝐥𝐲 𝐭𝐨 𝐬𝐨𝐦𝐞𝐨𝐧𝐞!");
  }
};
