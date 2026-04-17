const fs = require("fs-extra");
const path = __dirname + "/cache/slot_config.json";

function makeBold(text) {
  const letters = {
    'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦',
    'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
    'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌',
    'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
    '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
  };
  return text.split('').map(char => letters[char] || char).join('');
}

module.exports = {
  config: {
    name: "slot",
    version: "5.0.0",
    author: "Mr.King",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Slot machine with admin controls" },
    category: "Game",
  },

  onStart: async function ({ args, api, event, usersData, message }) {
    const { senderID } = event;
    const adminUID = "61588626550420"; // তোর ইউআইডি (Mr.King)

    // কনফিগারেশন লোড করা
    if (!fs.existsSync(path)) {
      fs.writeJsonSync(path, { winRate: 0.65, maxBet: 200000000 });
    }
    let config = fs.readJsonSync(path);

    // --- অ্যাডমিন কন্ট্রোল সিস্টেম ---
    if (args[0] === "limit" && senderID === adminUID) {
      const newLimit = parseSmartAmount(args[1]);
      if (isNaN(newLimit)) return message.reply("⚠️ | বসের হুকুম, লিমিট ঠিকমতো দাও!");
      config.maxBet = newLimit;
      fs.writeJsonSync(path, config);
      return message.reply(`✅ | 𝐒𝐥𝐨𝐭 𝐥𝐢𝐦𝐢𝐭 𝐮𝐩𝐝𝐚𝐭𝐞𝐝 𝐭𝐨: $${formatNumber(newLimit)}`);
    }

    if (args[0] === "win" && senderID === adminUID) {
      const newRate = parseFloat(args[1]);
      if (isNaN(newRate) || newRate < 1 || newRate > 100) return message.reply("⚠️ | ১ থেকে ১০০ এর মধ্যে রেট দাও বস!");
      config.winRate = newRate / 100;
      fs.writeJsonSync(path, config);
      return message.reply(`✅ | 𝐒𝐥𝐨𝐭 𝐰𝐢𝐧 𝐫𝐚𝐭𝐞 𝐮𝐩𝐝𝐚𝐭𝐞𝐝 𝐭𝐨: ${newRate}%`);
    }

    // --- গেম লজিক শুরু ---
    const userData = await usersData.get(senderID);
    const money = userData.money || 0;
    const betInput = args[0];

    if (!betInput) return message.reply(">🎀 ( 𝐒𝐥𝐨𝐭 𝐌𝐚𝐜𝐡𝐢𝐧𝐞 )\n━━━━━━━━━━━━━━━━━━\n⚠️ | 𝐁𝐚𝐛𝐲, 𝐞𝐧𝐭𝐞𝐫 𝐚𝐧 𝐚𝐦𝐨𝐮𝐧𝐭! (𝐄𝐱: 𝟏𝐌)");

    const betAmount = parseSmartAmount(betInput);

    if (isNaN(betAmount) || betAmount <= 0) return message.reply("⚠️ | 𝐁𝐚𝐛𝐲, 𝐞𝐧𝐭𝐞𝐫 𝐚 𝐯𝐚𝐥𝐢𝐝 𝐚𝐦𝐨𝐮𝐧𝐭!");
    if (betAmount > config.maxBet) return message.reply(`❌ | 𝐁𝐚𝐛𝐲, 𝐭𝐡𝐞 𝐦𝐚𝐱𝐢𝐦𝐮𝐦 𝐬𝐥𝐨𝐭 𝐥𝐢𝐦𝐢𝐭 𝐢𝐬 $${formatNumber(config.maxBet)}!`);
    if (betAmount > money) return message.reply(`❌ | 𝐁𝐚𝐛𝐲, 𝐲𝐨𝐮 𝐨𝐧𝐥𝐲 𝐡𝐚𝐯𝐞 $${formatNumber(money)}!`);

    const today = new Date().toISOString().slice(0, 10);
    let slotLimit = userData.slotLimit || { date: today, count: 0 };
    if (slotLimit.date !== today) slotLimit = { date: today, count: 0 };

    if (slotLimit.count >= 800) {
      return message.reply(">🎀 ( 𝐋𝐢𝐦𝐢𝐭 𝐑𝐞𝐚𝐜𝐡𝐞𝐝 )\n━━━━━━━━━━━━━━━━━━\n🚫 | 𝐁𝐚𝐛𝐲, 𝐲𝐨𝐮 𝐡𝐚𝐯𝐞 𝐟𝐢𝐧𝐢𝐬𝐡𝐞𝐝 𝐲𝐨𝐮𝐫 𝟖𝟎𝟎 𝐬𝐩𝐢𝐧𝐬!");
    }

    const isWin = Math.random() < config.winRate;
    const slots = ["🍒", "💎", "⭐", "💰", "👑", "🍀"];
    let s1, s2, s3, balanceChange;

    if (isWin) {
      const winSymbol = slots[Math.floor(Math.random() * slots.length)];
      s1 = s2 = s3 = winSymbol;
      balanceChange = betAmount;
    } else {
      s1 = slots[Math.floor(Math.random() * slots.length)];
      s2 = slots[Math.floor(Math.random() * slots.length)];
      s3 = slots[Math.floor(Math.random() * slots.length)];
      if (s1 === s2 && s2 === s3) s3 = "💔";
      balanceChange = -betAmount;
    }

    const newSpinCount = slotLimit.count + 1;
    let finalBalanceChange = balanceChange;
    if (newSpinCount === 800) finalBalanceChange += 400000000;

    await usersData.set(senderID, { 
      money: money + finalBalanceChange,
      slotLimit: { date: today, count: newSpinCount }
    });

    const footer = `━━━━━━━━━━━━━━━━━━\n• 𝐄𝐧𝐣𝐨𝐲 𝐛𝐛𝐲🐉 [ 💛 | 💛 | 💛 ]`;

    if (isWin) {
      return message.reply(`>🎀\n━━━━━━━━━━━━━━━━━━\n🏆 | 𝐘𝐨𝐮 𝐰𝐨𝐧: $${formatNumber(betAmount * 2)} (𝟐𝐱)\n🎰 | [ ${s1} | ${s2} | ${s3} ]\n${footer}`);
    } else {
      return message.reply(`>🎀\n━━━━━━━━━━━━━━━━━━\n💀 | 𝐘𝐨𝐮 𝐥𝐨𝐬𝐭: $${formatNumber(betAmount)}\n🎰 | [ ${s1} | ${s2} | ${s3} ]\n${footer}`);
    }
  }
};

function parseSmartAmount(str) {
  if (!str) return NaN;
  if (typeof str !== 'string') return parseFloat(str);
  const units = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const match = str.toLowerCase().match(/^(\d+(?:\.\d+)?)([kmbt]?)$/);
  if (!match) return parseFloat(str);
  return parseFloat(match[1]) * (units[match[2]] || 1);
}

function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "𝐓";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "𝐁";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "𝐌";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "𝐊";
  return num.toLocaleString();
}