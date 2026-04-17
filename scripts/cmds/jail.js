const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    config: {
        name: "jail",
        version: "4.0.0",
        author: "Arafat",
        countDown: 5,
        role: 0,
        description: "Silent Premium Jail Effect",
        category: "premium",
        guide: "{pn} @tag | reply"
    },

    onStart: async function ({ api, event }) {
        const { threadID, messageID, senderID, mentions, type, messageReply } = event;

        // Smart Target Identification
        let targetID = (type === "message_reply") ? messageReply.senderID : 
                       (Object.keys(mentions).length > 0) ? Object.keys(mentions)[0] : senderID;

        const cachePath = path.join(__dirname, 'cache', `jail_${targetID}.png`);

        try {
            // High-Resolution Avatar Source
            const avatarUrl = `https://graph.facebook.com/${targetID}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
            
            // Premium Jail Generation API
            const jailApi = `https://api.popcat.xyz/jail?image=${encodeURIComponent(avatarUrl)}`;

            // Fetching Image Silently
            const response = await axios.get(jailApi, { 
                responseType: 'arraybuffer',
                timeout: 20000 
            });

            // Ensure Cache Directory Exists
            await fs.ensureDir(path.join(__dirname, 'cache'));
            await fs.outputFile(cachePath, Buffer.from(response.data));

            // Final Premium Delivery (No Processing Message)
            return api.sendMessage({
                body: "𝐄𝐟𝐟𝐞𝐜𝐭 𝐣𝐚𝐢𝐥 𝐬𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥 🐸",
                attachment: fs.createReadStream(cachePath)
            }, threadID, () => {
                // Instant Cleanup
                if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
            }, messageID);

        } catch (error) {
            console.error(error);
            // Silent error handling - only notifies if it truly fails
            return api.sendMessage("❌ 𝐏𝐫𝐞𝐦𝐢𝐮𝐦 𝐄𝐫𝐫𝐨𝐫: 𝐔𝐧𝐚𝐛𝐥𝐞 𝐭𝐨 𝐠𝐞𝐧𝐞𝐫𝐚𝐭𝐞 𝐞𝐟𝐟𝐞𝐜𝐭.", threadID, messageID);
        }
    }
};