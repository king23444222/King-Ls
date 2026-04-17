const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "alldl",
    version: "2.5.0",
    author: "Arafat",
    role: 0,
    shortDescription: "Auto & Reply downloader",
    longDescription: "Download media automatically or by replying 'alldl' to a link.",
    category: "utility",
    guide: { en: "Send a link OR reply to a link with 'alldl'." }
  },

  onStart: async function({ api, event }) {
    return api.sendMessage("𝐒𝐞𝐧𝐝 𝐚 𝐥𝐢𝐧𝐤 𝐎𝐑 𝐫𝐞𝐩𝐥𝐲 𝐭𝐨 𝐚 𝐥𝐢𝐧𝐤 𝐰𝐢𝐭𝐡 '𝐚𝐥𝐥𝐝𝐥' 𝐭𝐨 𝐝𝐨𝐰𝐧𝐥𝐨𝐚𝐝.", event.threadID, event.messageID);
  },

  onChat: async function({ api, event }) {
    const { body, threadID, messageID, type, messageReply } = event;
    if (!body) return;

    const urlRegex = /https?:\/\/(www\.)?(facebook\.com|fb\.watch|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|x\.com|twitter\.com|terabox\.com|teraboxapp\.com|nephobox\.com|drive\.google\.com|snapchat\.com|reddit\.com|pinterest\.com|pin\.it|linkedin\.com|threads\.net|capcut\.com|likee\.video|soundcloud\.com|twitch\.tv|vimeo\.com|dailymotion\.com|bilibili\.com|rumble\.com)\/\S+/gi;

    let videoUrl = "";

    // Check if user replied to a link with "alldl"
    if (type === "message_reply" && body.toLowerCase() === "alldl") {
      const replyBody = messageReply.body;
      const match = replyBody.match(urlRegex);
      if (match) videoUrl = match[0];
    } 
    // Otherwise, check if the message itself is a link (Auto-download)
    else if (body.startsWith("https://")) {
      const match = body.match(urlRegex);
      if (match) videoUrl = match[0];
    }

    if (!videoUrl) return;

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
      if (!downloadUrl) throw new Error("Link not supported");

      const extension = downloadUrl.includes(".mp3") ? "mp3" : "mp4";
      const cacheDir = path.join(__dirname, "cache");
      const filePath = path.join(cacheDir, `autodl_${Date.now()}.${extension}`);
      
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
      api.setMessageReaction("❌", messageID, () => {}, true);
    }
  }
};