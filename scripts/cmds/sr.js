/cmd install sr.js "use strict";

const axios = require("axios");

module.exports = {
  config: {
    name: "sr",
    version: "1.1.0",
    author: "Arafat",
    countDown: 10,
    role: 0,
    shortDescription: {
      en: "4K Reverse Image Search (Direct Upload)",
    },
    longDescription: {
      en: "Locates and uploads 10 high-resolution matching photos with reaction feedback.",
    },
    category: "utility",
    guide: {
      en: "Reply to an image and type: {p}sr",
    },
  },

  onStart: async function ({ api, event, message }) {
    const { messageID, messageReply } = event;

    // ── Internal System Validation ──────────────────────────────
    if (this.config.author !== "Arafat") {
      return message.reply("⚠️ | 𝐒𝐲𝐬𝐭𝐞𝐦 𝐂𝐨𝐧𝐟𝐢𝐠𝐮𝐫𝐚𝐭𝐢𝐨𝐧 𝐄𝐫𝐫𝐨𝐫.");
    }
    // ────────────────────────────────────────────────────────────

    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return message.reply("❌ | 𝐏𝐥𝐞𝐚𝐬𝐞 𝐫𝐞𝐩𝐥𝐲 𝐭𝐨 𝐚 𝐩𝐡𝐨𝐭𝐨 𝐭𝐨 𝐛𝐞𝐠𝐢𝐧 𝐭𝐡𝐞 𝐯𝐢𝐬𝐮𝐚𝐥 𝐬𝐜𝐚𝐧.");
    }

    const attachment = messageReply.attachments.find(
      (a) => a.type === "photo" || a.type === "sticker" || a.type === "image"
    );

    if (!attachment) return message.reply("❌ | 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐦𝐞𝐝𝐢𝐚 𝐭𝐲𝐩𝐞.");

    const imageUrl = attachment.url || attachment.previewUrl;

    try {
      // ── Digital Animation Reaction ─────────────────────────────
      api.setMessageReaction("📡", messageID, () => {}, true);

      const SERPAPI_KEY = "149c361cde8cee48988308d0467eafabfa20b046aab19af5ec36ad2ae4870018";

      const response = await axios.get("https://serpapi.com/search", {
        params: {
          engine: "google_lens",
          url: imageUrl,
          api_key: SERPAPI_KEY,
          hl: "en",
        },
        timeout: 30000,
      });

      const visualMatches = response.data.visual_matches || [];

      if (visualMatches.length === 0) {
        api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❌ | 𝐍𝐨 𝐦𝐚𝐭𝐜𝐡𝐢𝐧𝐠 𝐯𝐢𝐬𝐮𝐚𝐥𝐬 𝐟𝐨𝐮𝐧𝐝.");
      }

      const imgData = [];
      const resultsToProcess = visualMatches.slice(0, 10);

      for (let i = 0; i < resultsToProcess.length; i++) {
        const item = resultsToProcess[i];
        try {
          // Attempting to pull higher resolution source if available
          const hdUrl = item.thumbnail.replace(/w\d+-h\d+/, 'w4096-h4096');
          const res = await axios.get(hdUrl, { responseType: "stream" });
          imgData.push(res.data);
        } catch (e) {
          // Fallback to original thumbnail if 4k upscale fails
          try {
            const resFallback = await axios.get(item.thumbnail, { responseType: "stream" });
            imgData.push(resFallback.data);
          } catch (err) { continue; }
        }
      }

      const caption = "✅ 𝐅𝐨𝐮𝐧𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲.";

      // Final success reaction
      api.setMessageReaction("✅", messageID, () => {}, true);

      return message.reply({
        body: caption,
        attachment: imgData
      });

    } catch (err) {
      console.error(err);
      api.setMessageReaction("⚠️", messageID, () => {}, true);
      return message.reply("⚠️ | 𝐒𝐞𝐫𝐯𝐞𝐫 𝐄𝐫𝐫𝐨𝐫: 𝐔𝐧𝐚𝐛𝐥𝐞 𝐭𝐨 𝐟𝐞𝐭𝐜𝐡 𝐦𝐞𝐝𝐢𝐚.");
    }
  },
};