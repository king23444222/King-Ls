const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");
const http = require("http");

const RAPIDAPI_KEY = "286ca7c128mshd367c7d5a5ce3c3p139e38jsnf2383bf345fc";
const SHAZAM_HOST  = "shazam.p.rapidapi.com";
const SHAZAM_URL   = "https://shazam.p.rapidapi.com";
const TMP_DIR      = path.join(__dirname, "cache");
const MAX_BYTES    = 100 * 1024 * 1024;

const REACT_WORKING = "🐤";
const REACT_DONE    = "🪶";
const REACT_ERROR   = "❌";

function react(api, event, emoji) {
  try { api.setMessageReaction(emoji, event.messageID, () => {}, true); } catch (_) {}
}

// ─── Shared helper: store card data for BOTH reply & reaction ───────────────
function registerCard(msgID, data) {
  const payload = { commandName: "find", messageID: msgID, ...data };
  global.GoatBot.onReply.set(msgID, payload);
  global.GoatBot.onReaction.set(msgID, payload);
}

module.exports = {
  config: {
    name: "find",
    aliases: ["shazam", "detect"],
    version: "3.4.1",
    author: "Arafat",
    countDown: 10,
    role: 0,
    shortDescription: "Detect song from video/audio and download the full track",
    longDescription:
      "Reply to any video or audio with 'find' → detects the background song + sends info card.\n" +
      "Reply to the card OR react to it → downloads and sends the full song.",
    category: "music",
    guide: {
      en: "Step 1 — Reply to a video or audio: {pn}\nStep 2 — Reply to the card OR react with any emoji → full song sent"
    }
  },

  onStart: async function ({ message, event, api }) {
    return handleFindSong({ message, event, api });
  },

  onReply: async function ({ message, event, api, Reply }) {
    return sendAudio({ message, event, api, songData: Reply });
  },

  onReaction: async function ({ message, event, api, Reaction }) {
    return sendAudio({ message, event, api, songData: Reaction });
  }
};

// ══════════════════════════════════════════════
//  STEP 1 — Detect song from replied video OR audio
// ══════════════════════════════════════════════
async function handleFindSong({ message, event, api }) {
  const reply = event.messageReply;
  if (!reply) {
    return message.reply("❌ | Please reply to a video or audio message and type: !find");
  }

  const mediaUrl = extractMediaUrl(reply);
  if (!mediaUrl) {
    const types = (reply.attachments || []).map(a => a.type || "unknown").join(", ");
    return message.reply(
      "❌ | No video or audio found in the replied message.\n" +
      `Attachment types: [${types || "none"}]`
    );
  }

  react(api, event, REACT_WORKING);
  await fs.ensureDir(TMP_DIR);

  const ts        = Date.now();
  const mediaPath = path.join(TMP_DIR, `fm_${ts}.media`);
  const pcmPath   = path.join(TMP_DIR, `fp_${ts}.raw`);

  try {
    await streamDownload(mediaUrl, mediaPath);

    const { execSync } = require("child_process");

    // ── FIX 1: Extract exactly 5s of PCM — ideal size for Shazam detection ──
    // 5s × 44100 Hz × 1 ch × 2 bytes = ~441,000 bytes
    // Using explicit codec pcm_s16le avoids any ambiguity with -f s16le alone
    execSync(
      `ffmpeg -y -i "${mediaPath}" -vn -ar 44100 -ac 1 -t 5 -acodec pcm_s16le -f s16le "${pcmPath}"`,
      { stdio: "pipe" }
    );

    const pcmBuffer = fs.readFileSync(pcmPath);

    // ── FIX 2: Guard against empty/corrupt extraction ──────────────────────
    if (pcmBuffer.length < 8000) {
      throw new Error("Audio extraction produced too little data — check if media has audio.");
    }

    // ── FIX 3: Cap at ~5s worth of PCM (264,600 bytes) ─────────────────────
    // Sending too much data (500 KB+) causes Shazam's API to return 500
    const MAX_PCM = 264600;
    const chunk   = pcmBuffer.slice(0, Math.min(pcmBuffer.length, MAX_PCM));
    const b64     = chunk.toString("base64");

    // ── FIX 4: Set Accept header + increase timeouts ────────────────────────
    const detectRes = await axios.post(
      `${SHAZAM_URL}/songs/detect`,
      b64,
      {
        headers: {
          "Content-Type":    "text/plain",
          "x-rapidapi-host": SHAZAM_HOST,
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "Accept":          "application/json",
        },
        timeout: 30000,
        maxBodyLength:    Infinity,
        maxContentLength: Infinity,
      }
    );

    const track = detectRes.data?.track;
    if (!track) {
      react(api, event, REACT_ERROR);
      return message.reply("❌ | No song detected in this video/audio.");
    }

    const details   = await getShazamDetails(track.key);
    const info      = buildSongInfo(track, details);
    const coverPath = await downloadCover(
      track.images?.coverarthq || track.images?.coverart,
      track.key
    );

    const caption = buildCaption(info);
    let sentMsg;

    if (coverPath && fs.existsSync(coverPath)) {
      sentMsg = await message.reply({ body: caption, attachment: fs.createReadStream(coverPath) });
      cleanFile(coverPath);
    } else {
      sentMsg = await message.reply(caption);
    }

    react(api, event, REACT_DONE);
    registerCard(sentMsg.messageID, { title: info.title, artist: info.artist });

  } catch (err) {
    console.error("[find] handleFindSong:", err.message);

    // ── FIX 5: Log Shazam API error body for easier debugging ───────────────
    if (err.response) {
      console.error("[find] Shazam API response:", err.response.status, JSON.stringify(err.response.data));
    }

    react(api, event, REACT_ERROR);
    await message.reply(`❌ | Error detecting song: ${err.message}`);
  } finally {
    cleanFile(mediaPath);
    cleanFile(pcmPath);
  }
}

// ══════════════════════════════════════════════
//  STEP 2 — Download & send full song
// ══════════════════════════════════════════════
const ytSearch = require("yt-search");
const NIX_API_JSON = "https://raw.githubusercontent.com/aryannix/stuffs/master/raw/apis.json";

async function sendAudio({ message, event, api, songData }) {
  const { title, artist } = songData;
  if (!title || !artist) {
    return message.reply("❌ | Song data missing. Please use !find again.");
  }

  const searchQuery = `${title} ${artist} official audio`;
  react(api, event, REACT_WORKING);
  await fs.ensureDir(TMP_DIR);

  const audioPath = path.join(TMP_DIR, `find_audio_${Date.now()}.mp3`);

  try {
    console.log(`[find] Downloading: "${searchQuery}"`);

    const ytRes = await ytSearch(searchQuery);
    const video = ytRes.videos.find(v => v.seconds < 600) || ytRes.videos[0];
    if (!video) throw new Error("No YouTube results found.");
    console.log(`[find] Found: ${video.title} → ${video.url}`);

    // ── Attempt 1: ytdl-core ────────────────────────────────────────────
    let downloaded = false;
    try {
      const ytdl = require("@distube/ytdl-core");
      const audioStream = ytdl(video.url, {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: { headers: { "User-Agent": "Mozilla/5.0" } }
      });
      await streamToFile(audioStream, audioPath);
      const size = fs.statSync(audioPath).size;
      if (size < 10240) throw new Error("File too small — ytdl-core failed silently.");
      downloaded = true;
      console.log("[find] Downloaded via ytdl-core");
    } catch (ytdlErr) {
      console.warn("[find] ytdl-core failed:", ytdlErr.message, "→ trying nix API…");
    }

    // ── Attempt 2: nix / aryannix API ──────────────────────────────────
    if (!downloaded) {
      const apiBase = await getNixApiBase();
      if (!apiBase) throw new Error("Both ytdl-core and nix API unavailable.");

      const dlRes = await axios.get(`${apiBase}/ytdl`, {
        params:  { url: video.url, type: "audio" },
        timeout: 30000
      });

      if (!dlRes.data?.status || !dlRes.data?.downloadUrl)
        throw new Error("Nix API did not return a download URL.");

      const audioRes = await axios.get(dlRes.data.downloadUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      await fs.outputFile(audioPath, Buffer.from(audioRes.data));
      const size = fs.statSync(audioPath).size;
      if (size < 10240) throw new Error("Nix API: downloaded file too small.");
      downloaded = true;
      console.log("[find] Downloaded via nix API");
    }

    if (!downloaded) throw new Error("All download methods failed.");

    await message.reply({
      body:       `✅ | 𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐫𝐞𝐪𝐮𝐞𝐬𝐭𝐞𝐝 𝐬𝐨𝐧𝐠\n➡️ ${title} — ${artist}`,
      attachment: fs.createReadStream(audioPath)
    });

    react(api, event, REACT_DONE);

  } catch (err) {
    console.error("[find] sendAudio:", err.message);
    react(api, event, REACT_ERROR);
    await message.reply(``);
  } finally {
    setTimeout(() => cleanFile(audioPath), 10000);
  }
}

// ══════════════════════════════════════════════
//  Nix API base fetcher
// ══════════════════════════════════════════════
async function getNixApiBase() {
  try {
    const res = await axios.get(NIX_API_JSON, { timeout: 8000 });
    return res.data?.api || null;
  } catch (_) { return null; }
}

// ══════════════════════════════════════════════
//  Pipe a readable stream to a file path
// ══════════════════════════════════════════════
function streamToFile(readableStream, destPath) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    readableStream.pipe(out);
    out.on("finish", resolve);
    out.on("error",  reject);
    readableStream.on("error", reject);
  });
}

// ══════════════════════════════════════════════
//  Shazam helpers
// ══════════════════════════════════════════════
async function getShazamDetails(songKey) {
  try {
    const res = await axios.get(`${SHAZAM_URL}/songs/get-details`, {
      params:  { key: songKey, locale: "en-US" },
      headers: {
        "Content-Type":    "application/json",
        "x-rapidapi-host": SHAZAM_HOST,
        "x-rapidapi-key":  RAPIDAPI_KEY,
      },
      timeout: 12000
    });
    return res.data;
  } catch (_) { return null; }
}

function buildSongInfo(track, details) {
  const meta    = details?.sections?.find(s => s.type === "SONG") || {};
  const lyrics  = details?.sections?.find(s => s.type === "LYRICS");
  const metaMap = {};
  (meta.metadata || []).forEach(m => { metaMap[(m.title || "").toLowerCase()] = m.text; });
  return {
    title:         track.title    || details?.title    || "Unknown",
    artist:        track.subtitle || details?.subtitle || "Unknown",
    album:         metaMap["album"]                    || "Unknown",
    released:      metaMap["released"]                 || "Unknown",
    genre:         track.genres?.primary               || "Unknown",
    lyrics:        lyrics?.text?.slice(0, 3).join("\n") || null,
    shazamUrl:     track.url                           || null,
    appleMusicUrl: details?.hub?.actions?.find(a => a.type === "uri")?.uri || null
  };
}

function buildCaption(info) {
  const lines = [
    "ღ 𝖮𝖬𝖭𝖨-𝖷 𝖠𝖭𝖠𝖫𝖸𝖳𝖨𝖢𝖲",
    "ღ 𝖲𝖸𝖲𝖳𝖤𝖬 𝖡𝖸 𝖠𝖱𝖠𝖥𝖠𝖳",
    "",
    `❍ 𝖳𝗂𝗍𝗅𝖾: ${info.title}`,
    `❍ 𝖠𝗋𝗍𝗂𝗌𝗍: ${info.artist}`,
    `❍ 𝖠𝗅𝖻𝗎𝗆: ${info.album}`,
    `❍ 𝖦𝖾𝗇𝗋𝖾: ${info.genre}`,
    `❍ 𝖱𝖾𝗅𝖾𝖺𝗌𝖾: ${info.released}`,
  ];
  if (info.lyrics) {
    lines.push("", "❍ 𝖫𝗒𝗋𝗂𝖼𝗌:");
    info.lyrics.split("\n").forEach(l => lines.push(l));
  }
  lines.push("", "");
  return lines.join("\n");
}

// ══════════════════════════════════════════════
//  Utilities
// ══════════════════════════════════════════════
function extractMediaUrl(reply) {
  if (!reply) return null;
  for (const att of (reply.attachments || [])) {
    const t = (att.type || "").toLowerCase();
    if (["video", "animated_image", "gif", "audio"].includes(t) && att.url)
      return att.url;
    if (att.payload?.url) return att.payload.url;
    if (t === "share" && att.url) return att.url;
  }
  return null;
}

function streamDownload(url, destPath, maxBytes = 0) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const doRequest = (currentUrl, hops = 0) => {
      if (hops > 10) return reject(new Error("Too many redirects"));
      const mod = currentUrl.startsWith("https") ? https : http;
      mod.get(currentUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" }
      }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
          return doRequest(res.headers.location, hops + 1);
        if (res.statusCode !== 200)
          return reject(new Error(`HTTP ${res.statusCode}`));
        const out = fs.createWriteStream(destPath);
        res.on("data", chunk => {
          received += chunk.length;
          if (maxBytes > 0 && received > maxBytes) {
            res.destroy(); out.close();
            reject(new Error(`Exceeds ${maxBytes / 1024 / 1024} MB`));
          }
        });
        res.pipe(out);
        out.on("finish", resolve);
        out.on("error",  reject);
        res.on("error",  reject);
      }).on("error", reject)
        .setTimeout(120000, () => reject(new Error("Stream timeout")));
    };
    doRequest(url);
  });
}

async function downloadCover(url, songKey) {
  if (!url) return null;
  try {
    await fs.ensureDir(TMP_DIR);
    const p = path.join(TMP_DIR, `cover_${songKey}.jpg`);
    await streamDownload(url, p, 5 * 1024 * 1024);
    return p;
  } catch (_) { return null; }
}

function cleanFile(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}