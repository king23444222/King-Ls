const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
    config: {
        name: "refresh",
        aliases: ["ref", "reload", "refresh group"],
        version: "2.0.0",
        author: "Mr.King",
        countDown: 10,
        role: 2,
        category: "admin"
    },

    onStart: async function ({ api, event }) {
        const { threadID, messageID, senderID } = event;
        const bossUID = "100025325472659";

        if (senderID !== bossUID) return api.sendMessage("💀 𝐘𝐨𝐮 𝐝𝐨𝐧'𝐭 𝐡𝐚𝐯𝐞 𝐩𝐞𝐫𝐦𝐢𝐬𝐬𝐢𝐨𝐧", threadID, messageID);

        const loadingFrames = [
            "🌪️ [▯▯▯▯▯▯▯▯▯▯] 𝟎%",
            "🌪️ [▬▬▬▯▯▯▯▯▯▯] 𝟑𝟓%",
            "🌪️ [▬▬▬▬▬▬▯▯▯] 𝟕𝟎%",
            "🌪️ [▬▬▬▬▬▬▬▬▬▬] 𝟏𝟎𝟎%",
            "🦥 𝐒𝐲𝐬𝐭𝐞𝐦 𝐑𝐞𝐟𝐫𝐞𝐬𝐡𝐢𝐧𝐠..."
        ];

        const processingMsg = await api.sendMessage(loadingFrames[0], threadID);
        
        for (let i = 1; i < loadingFrames.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await api.editMessage(loadingFrames[i], processingMsg.messageID);
        }

        try {
            const allThreads = await api.getThreadList(100, null, ["INBOX"]);
            const groupCount = allThreads.filter(thread => thread.isGroup).length;
            
            const res = await axios.get("https://api.waifu.pics/sfw/happy");
            const imgUrl = res.data.url;
            const ext = "gif";
            const cachePath = path.join(__dirname, `/cache/refresh_${Date.now()}.${ext}`);

            const imageRes = await axios.get(imgUrl, { responseType: "arraybuffer" });
            fs.writeFileSync(cachePath, Buffer.from(imageRes.data, "utf-8"));

            const refreshMsg = {
                body: `⚔️ ( 𝐒𝐲𝐬𝐭𝐞𝐦 𝐑𝐞𝐟𝐫𝐞𝐬𝐡𝐞𝐝 )\n━━━━━━━━━━━━━━━━━━\n👑 𝐀𝐝𝐦𝐢𝐧: 𝐌𝐫.𝐊𝐢𝐧𝐠\n🕊️ 𝐒𝐭𝐚𝐭𝐮𝐬: 𝐅𝐮𝐥𝐥𝐲 𝐎𝐩𝐭𝐢𝐦𝐢𝐳𝐞𝐝\n👥 𝐓𝐨𝐭𝐚𝐥 𝐆𝐫𝐨𝐮𝐩𝐬: ${groupCount}\n 𝐄𝐟𝐟𝐞𝐜𝐭: 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥\n━━━━━━━━━━━━━━━━━━\n• 𝐌𝐫.𝐊𝐢𝐧𝐠 𝐒𝐲𝐬𝐭𝐞𝐦🐉`,
                attachment: fs.createReadStream(cachePath)
            };

            await api.unsendMessage(processingMsg.messageID);
            return api.sendMessage(refreshMsg, threadID, () => {
                if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
            }, messageID);

        } catch (err) {
            return api.sendMessage("❌ 𝐑𝐞𝐟𝐫𝐞𝐬𝐡 𝐅𝐚𝐢𝐥𝐞𝐝!", threadID, messageID);
        }
    }
};
