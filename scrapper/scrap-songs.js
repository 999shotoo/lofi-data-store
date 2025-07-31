import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playlistsPath = path.join(__dirname, '..', 'api', 'playlists.json');
const outputPath = path.join(__dirname, '..', 'api', 'songs.json');

// Set your proxy URL here if needed, or leave as empty string for no proxy
const PROXY_URL = ''; // e.g. 'http://127.0.0.1:7890'
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

// Set your referer and origin headers here
const COMMON_HEADERS = {
    'referer': 'https://stream.chillhop.com/',
    'origin': 'https://stream.chillhop.com/'
};

const downloadFile = async (url, dest) => {
    const res = await fetch(url, {
        headers: COMMON_HEADERS,
        agent: proxyAgent
    });
    if (!res.ok) {
        throw new Error(`Failed to get '${url}' (${res.status})`);
    }
    await streamPipeline(res.body, fs.createWriteStream(dest));
};

const main = async () => {
    const playlists = JSON.parse(fs.readFileSync(playlistsPath, 'utf-8'));
    const allSongs = [];

    for (const playlist of playlists) {
        const playlistId = playlist.id;
        const res = await fetch(`https://stream.chillhop.com/live/${playlistId}`, {
            headers: COMMON_HEADERS,
            agent: proxyAgent
        });
        if (!res.ok) {
            console.error(`Failed to fetch songs for playlist ${playlistId}`);
            continue;
        }
        const songs = await res.json();
        for (const song of songs) {
            const songDir = path.join(__dirname, '..', 'assets', 'song', `${song.id}`);
            if (!fs.existsSync(songDir)) {
                fs.mkdirSync(songDir, { recursive: true });
            }

            // Download cover image
            const coverPath = path.join('assets', 'song', `${song.id}`, 'cover.jpg');
            const coverAbs = path.join(__dirname, '..', coverPath);
            if (!fs.existsSync(coverAbs)) {
                try {
                    await downloadFile(song.image, coverAbs);
                } catch (e) {
                    console.error(`Failed to download cover for song ${song.id}: ${e.message}`);
                }
            }

            // Download mp3
            const filePath = path.join('assets', 'song', `${song.id}`, 'audio.mp3');
            const fileAbs = path.join(__dirname, '..', filePath);
            const mp3Url = `https://stream.chillhop.com/mp3/${song.fileId}`;
            if (!fs.existsSync(fileAbs)) {
                try {
                    await downloadFile(mp3Url, fileAbs);
                } catch (e) {
                    console.error(`Failed to download mp3 for song ${song.id}: ${e.message}`);
                }
            }

            const songObj = {
                id: song.id,
                title: song.title,
                label: song.label,
                coverImage: song.image,
                coverPath: `assets/song/${song.id}/cover.jpg`,
                file: mp3Url,
                filepath: `assets/song/${song.id}/audio.mp3`,
                artists: song.artists
            };

            allSongs.push(songObj);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(allSongs, null, 2), 'utf-8');
    console.log(`Done! Saved all song info to ${outputPath}`);
};

main();