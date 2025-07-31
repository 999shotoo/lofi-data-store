import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import https from 'https';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'api', 'background.json');
const assetsDir = path.join(__dirname, '..', 'assets', 'background');

const downloadFile = async (url, dest) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to get '${url}' (${res.status})`);
    await streamPipeline(res.body, fs.createWriteStream(dest));
};

const main = async () => {
    // Fetch backgrounds data
    const res = await fetch('https://stream.chillhop.com/presets');
    if (!res.ok) {
        console.error('Failed to fetch backgrounds');
        return;
    }
    const data = await res.json();
    const backgrounds = data.backgrounds || data || [];

    const mapped = [];

    for (const bg of backgrounds) {
        const id = bg.id;
        const name = bg.name;
        const landscape = bg.landscapeUrl;
        const portrait = bg.portraitUrl;

        // Craft thumbnails from landscapeUrl and portraitUrl
        let thumbnailLandscape = landscape.endsWith('.mp4')
            ? landscape.replace('.mp4', '.jpg')
            : landscape + '.jpg';
        let thumbnailPortrait = portrait.endsWith('.mp4')
            ? portrait.replace('.mp4', '.jpg')
            : portrait + '.jpg';

        // Prepare paths
        const bgDir = path.join(assetsDir, id);
        if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

        const landscapePath = path.join('assets', 'background', id, 'desktop.mp4');
        const portraitPath = path.join('assets', 'background', id, 'portrait.mp4');
        const thumbnailLandscapePath = path.join('assets', 'background', id, 'cover_landscape.jpg');
        const thumbnailPortraitPath = path.join('assets', 'background', id, 'cover_portrait.jpg');

        // Download files if not present
        try {
            const landscapeAbs = path.join(__dirname, '..', landscapePath);
            if (!fs.existsSync(landscapeAbs)) {
                await downloadFile(landscape, landscapeAbs);
            }
        } catch (e) {
            console.error(`Failed to download landscape for ${id}: ${e.message}`);
        }
        try {
            const portraitAbs = path.join(__dirname, '..', portraitPath);
            if (!fs.existsSync(portraitAbs)) {
                await downloadFile(portrait, portraitAbs);
            }
        } catch (e) {
            console.error(`Failed to download portrait for ${id}: ${e.message}`);
        }
        try {
            const thumbLandAbs = path.join(__dirname, '..', thumbnailLandscapePath);
            if (!fs.existsSync(thumbLandAbs)) {
                await downloadFile(thumbnailLandscape, thumbLandAbs);
            }
        } catch (e) {
            console.error(`Failed to download landscape thumbnail for ${id}: ${e.message}`);
        }
        try {
            const thumbPortAbs = path.join(__dirname, '..', thumbnailPortraitPath);
            if (!fs.existsSync(thumbPortAbs)) {
                await downloadFile(thumbnailPortrait, thumbPortAbs);
            }
        } catch (e) {
            console.error(`Failed to download portrait thumbnail for ${id}: ${e.message}`);
        }

        mapped.push({
            id,
            name,
            landscape,
            portrait,
            thumbnailLandscape,
            thumbnailPortrait,
            landscapePath,
            portraitPath,
            thumbnailLandscapePath,
            thumbnailPortraitPath
        });
    }

    fs.writeFileSync(outputPath, JSON.stringify(mapped, null, 2), 'utf-8');
    console.log(`Done! Saved background info to ${outputPath}`);
};

main();