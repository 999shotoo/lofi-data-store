import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiUrl = 'https://stream.chillhop.com/presets';
const outputPath = path.join(__dirname, '..', 'api', 'playlists.json');

const main = async () => {
    const res = await fetch(apiUrl);
    if (!res.ok) {
        console.error('Failed to fetch playlists');
        process.exit(1);
    }
    const data = await res.json();
    // Save only the stations array if present, else save all
    const playlists = data.stations || data;
    fs.writeFileSync(outputPath, JSON.stringify(playlists, null, 2), 'utf-8');
    console.log(`Playlists saved to ${outputPath}`);
};

main();