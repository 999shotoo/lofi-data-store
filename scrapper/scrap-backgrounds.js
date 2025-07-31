import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'api', 'background.json');
const assetsDir = path.join(__dirname, '..', 'assets', 'background');

function generateRandomId(existingIds) {
    let id;
    do {
        id = String(Math.floor(1000 + Math.random() * 90000));
    } while (existingIds.has(id));
    return id;
}

const downloadFile = async (url, dest) => {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
    });
    if (!res.ok) throw new Error(`Failed to get '${url}' (${res.status})`);
    await streamPipeline(res.body, fs.createWriteStream(dest));
};

const scrapeMoewalls = async (existingIds) => {
    // Fetch first page to get total_pages
    const firstRes = await fetch('http://127.0.0.1:5000/api/search?q=lofi&page=1');
    if (!firstRes.ok) {
        console.error('Failed to fetch backgrounds from moewalls');
        return [];
    }
    const firstData = await firstRes.json();
    const totalPages = firstData.total_pages || 1;
    const mapped = [];

    for (let page = 1; page <= totalPages; page++) {
        const url = `http://127.0.0.1:5000/api/search?q=lofi&page=${page}`;
        const res = page === 1 ? firstRes : await fetch(url);
        if (!res.ok) {
            console.error(`Failed to fetch page ${page} from moewalls`);
            continue;
        }
        const data = page === 1 ? firstData : await res.json();
        const wallpapers = data.wallpapers || [];

        for (const wp of wallpapers) {
            const id = generateRandomId(existingIds);
            existingIds.add(id);
            const name = wp.title;
            const file = wp.download_link;
            const thumbnail = wp.thumbnail;

            const bgDir = path.join(assetsDir, id);
            if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

            const filepath = path.join('assets', 'background', id, 'video.mp4');
            const thumbnailpath = path.join('assets', 'background', id, 'cover.jpg');

            // Download files if not present
            try {
                const fileAbs = path.join(__dirname, '..', filepath);
                if (!fs.existsSync(fileAbs)) {
                    await downloadFile(file, fileAbs);
                }
            } catch (e) {
                console.error(`Failed to download file for ${id}: ${e.message}`);
            }
            try {
                const thumbAbs = path.join(__dirname, '..', thumbnailpath);
                if (!fs.existsSync(thumbAbs)) {
                    await downloadFile(thumbnail, thumbAbs);
                }
            } catch (e) {
                console.error(`Failed to download thumbnail for ${id}: ${e.message}`);
            }

            mapped.push({
                id,
                name,
                file,
                filepath,
                thumbnail,
                thumbnailpath
            });
        }
    }
    return mapped;
};

const scrapeEdenzen = async (existingIds) => {
    const url = 'https://qvpqjcuargsjhwizgalm.supabase.co/rest/v1/background_videos?select=*%2Cpremium_videos%3Apremium_feature_background_videos%28premium_feature_id%29&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cHFqY3Vhcmdzamh3aXpnYWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNDUwOTcsImV4cCI6MjA1NzYyMTA5N30.CswRC5V3aSME-kxZemUDALT8cw6QoLtjBhZ94oj2lHo';
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Failed to fetch backgrounds from EdenZen');
        return [];
    }
    const data = await res.json();
    const mapped = [];

    for (const bg of data) {
        const id = generateRandomId(existingIds);
        existingIds.add(id);
        const name = bg.name;
        const file = bg.video_url;
        const thumbnail = bg.thumbnail_url;

        const bgDir = path.join(assetsDir, id);
        if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

        const filepath = path.join('assets', 'background', id, 'video.mp4');
        const thumbnailpath = path.join('assets', 'background', id, 'cover.jpg');

        // Download files if not present
        try {
            const fileAbs = path.join(__dirname, '..', filepath);
            if (!fs.existsSync(fileAbs)) {
                await downloadFile(file, fileAbs);
            }
        } catch (e) {
            console.error(`Failed to download file for ${id}: ${e.message}`);
        }
        try {
            const thumbAbs = path.join(__dirname, '..', thumbnailpath);
            if (!fs.existsSync(thumbAbs)) {
                await downloadFile(thumbnail, thumbAbs);
            }
        } catch (e) {
            console.error(`Failed to download thumbnail for ${id}: ${e.message}`);
        }

        mapped.push({
            id,
            name,
            file,
            filepath,
            thumbnail,
            thumbnailpath
        });
    }
    return mapped;
};

const main = async () => {
    const existingIds = new Set();
    const moewalls = await scrapeMoewalls(existingIds);
    const edenzen = await scrapeEdenzen(existingIds);
    const mapped = [...moewalls, ...edenzen];

    fs.writeFileSync(outputPath, JSON.stringify(mapped, null, 2), 'utf-8');
    console.log(`Done! Saved background info to ${outputPath}`);
};

main();