const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const historyPath = path.join(__dirname, "cache", "tikHistory.json");

function getHistory() {
    if (!fs.existsSync(historyPath)) return [];
    try {
        return fs.readJsonSync(historyPath);
    } catch (e) {
        return [];
    }
}

module.exports = {
  config: {
    name: "tik",
    aliases: ["tiktok", "video"],
    version: "3.0.0",
    author: "Mr.King",
    countDown: 2,
    role: 0,
    category: "media",
    guide: { en: "{pn} [video/song name]" }
  },

  onStart: async function ({ api, event, message, args }) {
    const { threadID, messageID } = event;
    const query = args.join(" ");

    if (!query) return message.reply("⚠️ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐭𝐲𝐩𝐞 𝐚 𝐯𝐢𝐝𝐞𝐨 𝐨𝐫 𝐬𝐨𝐧𝐠 𝐧𝐚𝐦𝐞!");

    try {
        api.setMessageReaction("⏳", messageID, () => {}, true);

        const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}`);
        const videoList = res.data?.data?.videos;

        if (!videoList || videoList.length === 0) {
            return message.reply("⚠️ 𝐍𝐨 𝐯𝐢𝐝𝐞𝐨 𝐟𝐨𝐮𝐧𝐝!");
        }

        let history = getHistory();
        
        // Filter out videos that have been sent before
        let filteredVideos = videoList.filter(v => !history.includes(v.video_id));

        // If all available videos in search results were already seen, clear history for this query
        if (filteredVideos.length === 0) {
            filteredVideos = videoList;
            // Filter global history to remove these specific IDs to allow fresh rotation
            const videoIds = videoList.map(v => v.video_id);
            history = history.filter(id => !videoIds.includes(id));
        }

        // Pick a random video from the new/unseen list
        const videoData = filteredVideos[Math.floor(Math.random() * Math.min(filteredVideos.length, 15))];
        
        // Save ID to prevent immediate repeat
        history.push(videoData.video_id);
        if (history.length > 150) history.shift(); 
        fs.writeJsonSync(historyPath, history);

        const videoPath = path.join(__dirname, "cache", `tik_${Date.now()}.mp4`);
        const response = await axios({ url: videoData.play, method: "GET", responseType: "stream" });
        const writer = fs.createWriteStream(videoPath);
        response.data.pipe(writer);

        writer.on("finish", () => {
            api.sendMessage({
                body: `✅ 𝐇𝐞𝐫𝐞 𝐢𝐬 𝐲𝐨𝐮𝐫 𝐯𝐢𝐝𝐞𝐨 🕊️💖`,
                attachment: fs.createReadStream(videoPath)
            }, threadID, () => {
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            }, messageID);
            api.setMessageReaction("✅", messageID, () => {}, true);
        });

    } catch (e) {
        return message.reply("⚠️ 𝐒𝐲𝐬𝐭𝐞𝐦 𝐁𝐮𝐬𝐲! 𝐓𝐫𝐲 𝐚𝐠𝐚𝐢𝐧.");
    }
  }
};