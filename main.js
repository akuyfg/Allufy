const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://movie.vodu.me';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: 'Allufy',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

async function scrapeHomepage() {
  try {
    const { data } = await axios.get(BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const $ = cheerio.load(data);
    const sections = [];

    $('.col-lg-12').each((i, el) => {
      const heading = $(el).find('h2 a').text().trim();
      if (!heading) return;
      const items = [];
      const nextRow = $(el).next('.col-md-12');

      if (nextRow.length) {
        nextRow.find('.itemx').each((j, item) => {
          const link = $(item).find('a').first().attr('href');
          const img = $(item).find('img').attr('src');
          const title = $(item).find('.mytitle').text().trim();
          if (title) {
            const id = link ? link.match(/id=(\d+)/)?.[1] : null;
            items.push({
              id,
              title,
              image: img ? (img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`) : null,
            });
          }
        });
      }

      if (items.length) sections.push({ title: heading, items });
    });
    return sections;
  } catch (err) {
    return [];
  }
}

async function search(query) {
  try {
    const { data } = await axios.get(`${BASE_URL}/index.php?do=list&title=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const $ = cheerio.load(data);
    const results = [];

    $('.myitem').each((i, el) => {
      const link = $(el).find('a').first().attr('href');
      const img = $(el).find('img').attr('src');
      const title = $(el).find('.mytitle').text().trim();
      if (title) {
        const id = link ? link.match(/id=(\d+)/)?.[1] : null;
        results.push({
          id,
          title,
          image: img ? (img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`) : null,
        });
      }
    });
    return results;
  } catch (err) {
    return [];
  }
}

async function getContent(id) {
  try {
    const { data } = await axios.get(`${BASE_URL}/index.php?do=view&type=post&id=${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const $ = cheerio.load(data);
    const episodes = [];

    $('.play').each((i, el) => {
      const title = $(el).attr('data-title');
      const url1080 = $(el).attr('data-url1080') || '';
      const url720 = $(el).attr('data-url') || '';
      const url360 = $(el).attr('data-url360') || '';
      const url4k = $(el).attr('data-url4k') || '';
      const cookie = $(el).attr('data-cookie') || '';
      const webvtt = $(el).attr('data-webvtt') || '';
      if (title && (url1080 || url720)) {
        episodes.push({
          title,
          cookie,
          src: url4k || url1080 || url720 || url360,
          quality: url4k ? '4K' : url1080 ? '1080p' : url720 ? '720p' : '360p',
          subtitle: webvtt || null,
        });
      }
    });

    if (episodes.length === 0) return null;

    return {
      id,
      title: episodes[0].title.replace(/ S\d+E\d+.*$/, '').trim() || 'Unknown',
      isSeries: episodes.length > 1,
      episodes,
    };
  } catch (err) {
    return null;
  }
}

ipcMain.handle('get-homepage', async () => scrapeHomepage());
ipcMain.handle('search', async (event, query) => search(query));
ipcMain.handle('get-content', async (event, id) => getContent(id));
