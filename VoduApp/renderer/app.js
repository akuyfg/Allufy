const content = document.getElementById('content');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

const playerOverlay = document.getElementById('playerOverlay');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const playerQuality = document.getElementById('playerQuality');
const closePlayer = document.getElementById('closePlayer');
const episodesCol = document.getElementById('episodesCol');
const epsList = document.getElementById('epsList');

let currentEpisodes = [];
let currentEpisodeIndex = 0;

const BASE = 'https://movie.vodu.me';

// Different API approaches depending on platform
let api;
if (window.alluffyAPI) {
  // Electron mode
  api = window.alluffyAPI;
} else if (window.Capacitor?.isNative?.()) {
  // Android (Capacitor) mode - native HTTP bypasses CORS
  const { CapacitorHttp } = window.Capacitor;
  api = {
    getHomepage: async () => {
      const r = await CapacitorHttp.get({ url: BASE, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' } });
      return parseHomepage(r.data);
    },
    search: async (q) => {
      const r = await CapacitorHttp.get({ url: `${BASE}/index.php?do=list&title=${encodeURIComponent(q)}`, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' } });
      return parseSearchResults(r.data);
    },
    getContent: async (id) => {
      const r = await CapacitorHttp.get({ url: `${BASE}/index.php?do=view&type=post&id=${id}`, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' } });
      return parseContent(r.data);
    },
  };
} else {
  // Browser/PWA mode - use CORS proxy
  const PROXIES = [
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  async function fetchViaProxy(url, attempt = 0) {
    if (attempt >= PROXIES.length) throw new Error('All proxies failed');
    const r = await fetch(PROXIES[attempt](url));
    if (!r.ok) return fetchViaProxy(url, attempt + 1);
    return r.text();
  }
  api = {
    getHomepage: async () => {
      const html = await fetchViaProxy(BASE);
      return parseHomepage(html);
    },
    search: async (q) => {
      const html = await fetchViaProxy(`${BASE}/index.php?do=list&title=${encodeURIComponent(q)}`);
      return parseSearchResults(html);
    },
    getContent: async (id) => {
      const html = await fetchViaProxy(`${BASE}/index.php?do=view&type=post&id=${id}`);
      return parseContent(html);
    },
  };
}

function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function fixImg(src) {
  if (!src) return null;
  return src.startsWith('http') ? src : `${BASE}/${src.replace(/^\//, '')}`;
}

function parseHomepage(html) {
  const doc = parseHTML(html);
  const sections = [];
  doc.querySelectorAll('.col-lg-12').forEach((el) => {
    const heading = el.querySelector('h2 a')?.textContent?.trim();
    if (!heading) return;
    const nextRow = el.nextElementSibling;
    if (!nextRow || !nextRow.classList.contains('col-md-12')) return;
    const items = [];
    nextRow.querySelectorAll('.itemx').forEach((item) => {
      const link = item.querySelector('a')?.getAttribute('href');
      const img = item.querySelector('img')?.getAttribute('src');
      const title = item.querySelector('.mytitle')?.textContent?.trim();
      if (title) {
        const id = link?.match(/id=(\d+)/)?.[1] || null;
        items.push({ id, title, image: fixImg(img) });
      }
    });
    if (items.length) sections.push({ title: heading, items });
  });
  return sections;
}

function parseSearchResults(html) {
  const doc = parseHTML(html);
  const results = [];
  doc.querySelectorAll('.myitem').forEach((el) => {
    const link = el.querySelector('a')?.getAttribute('href');
    const img = el.querySelector('img')?.getAttribute('src');
    const title = el.querySelector('.mytitle')?.textContent?.trim();
    if (title) {
      const id = link?.match(/id=(\d+)/)?.[1] || null;
      results.push({ id, title, image: fixImg(img) });
    }
  });
  return results;
}

function parseContent(html) {
  const doc = parseHTML(html);
  const episodes = [];
  doc.querySelectorAll('.play').forEach((el) => {
    const epTitle = el.getAttribute('data-title');
    const url1080 = el.getAttribute('data-url1080') || '';
    const url720 = el.getAttribute('data-url') || '';
    const url360 = el.getAttribute('data-url360') || '';
    const url4k = el.getAttribute('data-url4k') || '';
    const webvtt = el.getAttribute('data-webvtt') || '';
    if (epTitle && (url1080 || url720)) {
      episodes.push({
        title: epTitle,
        src: url4k || url1080 || url720 || url360,
        quality: url4k ? '4K' : url1080 ? '1080p' : url720 ? '720p' : '360p',
        subtitle: webvtt || null,
      });
    }
  });
  if (episodes.length === 0) return null;
  return {
    isSeries: episodes.length > 1,
    title: episodes[0].title.replace(/ S\d+E\d+.*$/, '').trim() || 'Unknown',
    episodes,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  loadHomepage();
});

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

closePlayer.addEventListener('click', closePlayerFn);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayerFn();
});

videoPlayer.addEventListener('contextmenu', (e) => e.preventDefault());
videoPlayer.addEventListener('dblclick', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
  const isFull = !!document.fullscreenElement;
  if (isFull) {
    episodesCol.style.display = 'none';
    videoPlayer.style.width = '100vw';
    videoPlayer.style.height = '100vh';
    videoPlayer.style.maxHeight = '100vh';
    videoPlayer.style.objectFit = 'contain';
  } else {
    episodesCol.style.display = '';
    videoPlayer.style.width = '';
    videoPlayer.style.height = '';
    videoPlayer.style.maxHeight = '';
  }
});

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    playerOverlay.requestFullscreen();
  }
}

async function loadHomepage() {
  showLoading(true);
  try {
    const sections = await api.getHomepage();
    showLoading(false);

    if (!sections || sections.length === 0) {
      content.innerHTML = '<div class="no-results">تعذر تحميل المحتوى. تأكد من اتصال الإنترنت.</div>';
      return;
    }

    let html = '';
    sections.forEach((section) => {
      html += `
        <div class="section">
          <div class="section-header"><h2>${escapeHtml(section.title)}</h2></div>
          <div class="items-grid">
            ${section.items.map(item => `
              <div class="item-card" data-id="${item.id}" data-title="${escapeHtml(item.title)}">
                <img src="${item.image || ''}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22><rect fill=%22%23333%22 width=%22200%22 height=%22300%22/><text fill=%22%23888%22 font-size=%2214%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>No Image</text></svg>'">
                <div class="item-overlay"><div class="play-icon">عرض</div></div>
                <div class="item-title">${escapeHtml(item.title)}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    });

    content.innerHTML = html;
    attachCardListeners();
  } catch (err) {
    showLoading(false);
    content.innerHTML = '<div class="no-results">تعذر تحميل المحتوى. تأكد من اتصال الإنترنت.</div>';
  }
}

function attachCardListeners() {
  document.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (id) openContent(id, card.dataset.title);
    });
  });
}

async function openContent(id, title) {
  showLoading(true);
  try {
    const data = await api.getContent(id);
    showLoading(false);

    if (!data || !data.episodes || data.episodes.length === 0) {
      alert('عذراً، لا يمكن تشغيل هذا المحتوى حالياً.');
      return;
    }

    currentEpisodes = data.episodes;
    currentEpisodeIndex = 0;
    playerTitle.textContent = title || data.title;

    if (data.isSeries) {
      episodesCol.classList.remove('movie');
      renderEpisodesList();
    } else {
      episodesCol.classList.add('movie');
    }

    playEpisode(0);
    playerOverlay.classList.remove('hidden');
  } catch (err) {
    showLoading(false);
    alert('عذراً، لا يمكن تشغيل هذا المحتوى حالياً.');
  }
}

function renderEpisodesList() {
  epsList.innerHTML = currentEpisodes.map((ep, i) => `
    <div class="eps-item ${i === currentEpisodeIndex ? 'active' : ''}" data-index="${i}">
      <div class="eps-num">${i + 1}</div>
      <div class="eps-name">${escapeHtml(ep.title)}</div>
      <div class="eps-qual">${ep.quality}</div>
    </div>
  `).join('');

  epsList.querySelectorAll('.eps-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      playEpisode(idx);
    });
  });
}

function playEpisode(index) {
  if (index < 0 || index >= currentEpisodes.length) return;
  currentEpisodeIndex = index;
  const ep = currentEpisodes[index];

  playerQuality.textContent = ep.quality;
  videoPlayer.src = ep.src;

  const oldTrack = videoPlayer.querySelector('track');
  if (oldTrack) oldTrack.remove();
  if (ep.subtitle) {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = ep.subtitle;
    track.srclang = 'ar';
    track.label = 'العربية';
    track.default = true;
    videoPlayer.appendChild(track);
  }

  videoPlayer.load();
  videoPlayer.play();

  epsList.querySelectorAll('.eps-item').forEach((el) => {
    el.classList.toggle('active', parseInt(el.dataset.index) === index);
  });

  const active = epsList.querySelector('.eps-item.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function closePlayerFn() {
  if (document.fullscreenElement) document.exitFullscreen();
  videoPlayer.pause();
  videoPlayer.src = '';
  playerOverlay.classList.add('hidden');
  currentEpisodes = [];
}

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  showLoading(true);
  try {
    const results = await api.search(query);
    showLoading(false);

    if (!results || results.length === 0) {
      content.innerHTML = `<div class="search-results">
        <button class="back-btn" id="backHome">← الرجوع</button>
        <div class="no-results">لا توجد نتائج لـ "${escapeHtml(query)}"</div>
      </div>`;
      document.getElementById('backHome').addEventListener('click', loadHomepage);
      return;
    }

    content.innerHTML = `
      <div class="search-results">
        <button class="back-btn" id="backHome">← الرجوع</button>
        <h2>نتائج البحث عن: "${escapeHtml(query)}"</h2>
        <div class="items-grid">
          ${results.map(item => `
            <div class="item-card" data-id="${item.id}" data-title="${escapeHtml(item.title)}">
              <img src="${item.image || ''}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22><rect fill=%22%23333%22 width=%22200%22 height=%22300%22/><text fill=%22%23888%22 font-size=%2214%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>No Image</text></svg>'">
              <div class="item-overlay"><div class="play-icon">عرض</div></div>
              <div class="item-title">${escapeHtml(item.title)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('backHome').addEventListener('click', loadHomepage);
    attachCardListeners();
  } catch (err) {
    showLoading(false);
    content.innerHTML = `<div class="search-results">
      <button class="back-btn" id="backHome">← الرجوع</button>
      <div class="no-results">خطأ في الاتصال، حاول مرة أخرى.</div>
    </div>`;
    document.getElementById('backHome').addEventListener('click', loadHomepage);
  }
}

function showLoading(state) {
  loading.style.display = state ? 'flex' : 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
