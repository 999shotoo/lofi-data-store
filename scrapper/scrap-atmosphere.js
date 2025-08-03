import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiUrl = 'https://stream.chillhop.com/presets';
const outputPath = path.join(__dirname, '..', 'api', 'atmospheres.json');
const assetsDir = path.join(__dirname, '..', 'assets', 'atmospheres');

const downloadFile = async (url, dest) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}`);
    const fileStream = fs.createWriteStream(dest);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
};

const main = async () => {
    const res = await fetch(apiUrl);
    if (!res.ok) {
        console.error('Failed to fetch atmospheres');
        process.exit(1);
    }
    const data = await res.json();
    const atmospheres = data.atmospheres || data;

    // Download audio files and build output array
    const output = [];
    for (const atmosphere of atmospheres) {
        const id = atmosphere.id;
        const name = atmosphere.name;
        const url = atmosphere.url;
        if (!id || !url) continue;
        const dir = path.join(assetsDir, id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const dest = path.join(dir, 'audio.mp3');
        try {
            console.log(`Downloading ${id} from ${url}...`);
            await downloadFile(url, dest);
            console.log(`Saved to ${dest}`);
        } catch (err) {
            console.error(`Failed to download ${id}: ${err.message}`);
        }
        output.push({
            id,
            name,
            file: url,
            filepath: `assets/atmospheres/${id}/audio.mp3`
        });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Atmospheres saved to ${outputPath}`);
};

main();