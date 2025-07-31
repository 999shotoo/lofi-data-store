import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const chillpop_stream_url = "https://stream.chillhop.com/";

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

app.get('/', async (req, res) => {
    // Fetch radios
    const fetchdata = await fetch(`${chillpop_stream_url}presets`);
    const data = await fetchdata.json();
    const stations = data.stations;

    const idx = parseInt(req.query.idx || '0', 10);

    if (idx >= stations.length) {
        return res.send('<h2>All done! You can close this window.</h2>');
    }
    const station = stations[idx];

    // Always use q=lofi for wallpaper search, load 50 images (10 pages)
    let allImages = [];
    for (let p = 1; p <= 10; p++) {
        const fetchwalllpaper = await fetch(`https://wallhaven.cc/api/v1/search?q=lofi&page=${p}&resolution=1920x1080&atleast=1920x1080&sorting=relevance&order=desc`);
        if (!fetchwalllpaper.ok) {
            console.error(`Wallhaven API error on page ${p}: ${fetchwalllpaper.status}`);
            break;
        }
        const contentType = fetchwalllpaper.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`Wallhaven API returned non-JSON on page ${p}`);
            break;
        }
        const imgData = await fetchwalllpaper.json();
        allImages = allImages.concat(imgData.data);
    }
    allImages = allImages.slice(0, 50);

    let html = `<h2>Select cover for: ${station.name}</h2>`;
    html += `<form method="POST" action="/select?idx=${idx}">`;
    allImages.forEach((img, i) => {
        html += `
            <div style="margin-bottom:20px; display:inline-block; vertical-align:top;">
                <label>
                    <input type="radio" name="choice" value="${i}" ${i === 0 ? 'checked' : ''}>
                    <img src="${img.thumbs.small}" style="max-width:200px;display:block;">
                    <a href="${img.path}" target="_blank">Full Image</a>
                </label>
            </div>
        `;
    });
    html += `<br><button type="submit">Select</button></form>`;

    res.send(html);
});

app.post('/select', express.urlencoded({ extended: true }), async (req, res) => {
    const idx = parseInt(req.query.idx || '0', 10);
    const choice = parseInt(req.body.choice, 10);

    // Fetch radios
    const fetchdata = await fetch(`${chillpop_stream_url}presets`);
    const data = await fetchdata.json();
    const stations = data.stations;
    const station = stations[idx];

    // Always use q=lofi for wallpaper search, load 50 images (10 pages)
    let allImages = [];
    for (let p = 1; p <= 10; p++) {
        const fetchwalllpaper = await fetch(`https://wallhaven.cc/api/v1/search?q=lofi&page=${p}&resolution=1920x1080&atleast=1920x1080&sorting=relevance&order=desc`);
        if (!fetchwalllpaper.ok) {
            console.error(`Wallhaven API error on page ${p}: ${fetchwalllpaper.status}`);
            break;
        }
        const contentType = fetchwalllpaper.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`Wallhaven API returned non-JSON on page ${p}`);
            break;
        }
        const imgData = await fetchwalllpaper.json();
        allImages = allImages.concat(imgData.data);
    }
    allImages = allImages;
    const selected = allImages[choice];

    // Save images
    const assetsDir = path.join(__dirname, '..', 'assets', `${station.id}`);
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    const localCover = path.join(assetsDir, 'cover.jpg');
    const localThumb = path.join(assetsDir, 'thumb.jpg');
    await downloadImage(selected.path, localCover);
    await downloadImage(selected.thumbs.large, localThumb);

    // Save selection to a JSON file (append or update)
    const apiDir = path.join(__dirname, '..', 'api');
    if (!fs.existsSync(apiDir)) {
        fs.mkdirSync(apiDir, { recursive: true });
    }
    const playlistsPath = path.join(apiDir, 'playlists.json');
    let radios = [];
    if (fs.existsSync(playlistsPath)) {
        radios = JSON.parse(fs.readFileSync(playlistsPath, 'utf-8'));
    }
    radios = radios.filter(r => r.id !== station.id);
    radios.push({
        id: station.id,
        name: station.name,
        coverImage: selected.path,
        thumbnail: selected.thumbs.large,
        coverPath: `assets/${station.id}/cover.jpg` ,
        thumbnailPath: `assets/${station.id}/thumb.jpg`,
    });
    fs.writeFileSync(playlistsPath, JSON.stringify(radios, null, 2), 'utf-8');

    // Go to next station
    res.redirect('/?idx=' + (idx + 1));
});

app.listen(PORT, () => {
    console.log(`Open http://localhost:${PORT} in your browser to select playlist images.`);
});