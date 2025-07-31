import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONGS_JSON_PATH = path.join(__dirname, '../api/songs.json');
const SONGS_DIR = path.join(__dirname, '../assets/song');

const SUPABASE_URL = 'https://qvpqjcuargsjhwizgalm.supabase.co/rest/v1/tracks?select=id%2Ctitle%2Cduration%2Caudio_url%2Cthumbnail_url%2Cartist_id%2Cartists%28id%2Cname%29%2Calbum_id%2Calbums%28title%29&order=title.asc&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cHFqY3Vhcmdzamh3aXpnYWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNDUwOTcsImV4cCI6MjA1NzYyMTA5N30.CswRC5V3aSME-kxZemUDALT8cw6QoLtjBhZ94oj2lHo';

function generateUniqueId(existingIds) {
  let id;
  do {
    id = Math.floor(1000 + Math.random() * 90000); // 4-5 digit
  } while (existingIds.has(id));
  return id;
}

async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function main() {
  // Load existing songs
  let songs = [];
  try {
    songs = JSON.parse(fs.readFileSync(SONGS_JSON_PATH, 'utf8'));
  } catch (e) {
    // If file doesn't exist or is empty, start with empty array
    songs = [];
  }
  const existingIds = new Set(songs.map(s => s.id));

  // Fetch new songs
  const { data } = await axios.get(SUPABASE_URL);

  for (const track of data) {
    const id = generateUniqueId(existingIds);
    existingIds.add(id);

    const songDir = path.join(SONGS_DIR, String(id));
    if (!fs.existsSync(songDir)) fs.mkdirSync(songDir, { recursive: true });

    // Download cover and audio
    const coverPath = path.join(songDir, 'cover.jpg');
    const audioPath = path.join(songDir, 'audio.mp3');
    try {
      await downloadFile(track.thumbnail_url, coverPath);
      await downloadFile(track.audio_url, audioPath);
    } catch (err) {
      console.error(`Failed to download for track ${track.title}:`, err.message);
      continue;
    }

    // Map to your format
    songs.push({
      id,
      title: track.title,
      label: 'edenzen',
      coverImage: track.thumbnail_url,
      coverPath: `assets/song/${id}/cover.jpg`,
      file: track.audio_url,
      filepath: `assets/song/${id}/audio.mp3`,
      artists: track.artists?.name || '',
    });
  }

  // Save updated songs.json
  fs.writeFileSync(SONGS_JSON_PATH, JSON.stringify(songs, null, 2), 'utf8');
  console.log('Songs updated!');
}

main().catch(console.error);