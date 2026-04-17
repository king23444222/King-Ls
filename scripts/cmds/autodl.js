const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "autodl",
    version: "2.2.1",
    author: "Arafat",
    role: 0,
    shortDescription: "Fixed all-in-one downloader",
    longDescription: "High-speed auto-downloader for 25+ major platforms with HD support.",
    category: "utility",
    guide: { en: "Simply send a supported link to download media." }
  },

  onStart: async function({ api, event }) {
    const text = "𝐒𝐞𝐧𝐝 𝐚 𝐯𝐢𝐝𝐞𝐨/𝐦𝐞𝐝𝐢𝐚 𝐥𝐢𝐧𝐤 𝐭𝐨 𝐚𝐮𝐭𝐨-𝐝𝐨𝐰𝐧𝐥𝐨𝐚𝐝.";
    return api.sendMessage(text, event.threadID, event.messageID);
  },

  onChat: async function({ api, event }) {
    const { body, threadID, messageID } = event;
    if (!body || !body.startsWith("https://")) return;

    // 25+ Top Tier Domains
    const urlRegex = /https?:\/\/(www\.)?(facebook\.com|fb\.watch|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|x\.com|twitter\.com|terabox\.com|teraboxapp\.com|nephobox\.com|drive\.google\.com|snapchat\.com|reddit\.com|pinterest\.com|pin\.it|linkedin\.com|threads\.net|capcut\.com|likee\.video|soundcloud\.com|twitch\.tv|vimeo\.com|dailymotion\.com|bilibili\.com|rumble\.com)\/\S+/gi;

    const urlMatch = body.match(urlRegex);
    if (!urlMatch) return;
    const videoUrl = urlMatch[0];

    // Fixed Short-code for Bold Serif
    const toBold = (str) => {
      return str.split('').map(char => {
        if (/[A-Z]/.test(char)) return String.fromCodePoint(char.charCodeAt(0) + 119743);
        if (/[a-z]/.test(char)) return String.fromCodePoint(char.charCodeAt(0) + 119737);
        return char;
      }).join('');
    };

    api.setMessageReaction("🪽", messageID, () => {}, true);

    try {
      const API = `https://xsaim8x-xxx-api.onrender.com/api/auto?url=${encodeURIComponent(videoUrl)}`;
      const res = await axios.get(API);

      const downloadUrl = res.data.high_quality || res.data.low_quality || res.data.url;
      if (!downloadUrl) throw new Error("No media link");

      const extension = downloadUrl.includes(".mp3") ? "mp3" : "mp4";
      const cacheDir = path.join(__dirname, "cache");
      const filePath = path.join(cacheDir, `autodl_${Date.now()}.${extension}`);
      
      // Fixed: Ensure cache directory exists before writing
      await fs.ensureDir(cacheDir);

      const response = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 30000 });
      fs.writeFileSync(filePath, Buffer.from(response.data));

      const platformRaw = videoUrl.includes("drive.google.com") ? "GOOGLE DRIVE" : new URL(videoUrl).hostname.replace('www.', '').split('.')[0].toUpperCase();
      const infoCard = `${toBold("PLATFORM")} : ${toBold(platformRaw)}`;

      api.sendMessage({
        body: infoCard,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        api.setMessageReaction("✅", messageID, () => {}, true);
      }, messageID);

    } catch (err) {
      console.error(err);
      api.setMessageReaction("❌", messageID, () => {}, true);
    }
  }
};