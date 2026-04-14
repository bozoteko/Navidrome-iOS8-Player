var cfg      = {};
var queue    = [];
var queueIdx = 0;
var audio    = document.getElementById('audio');
var shuffle = false;
var originalQueue = [];

function authParams() {
  return 'u=' + encodeURIComponent(cfg.username) +
         '&p=' + encodeURIComponent(cfg.password) +
         '&v=1.16.0&c=mobileapp&f=json';
}
function apiUrl(method, extra) {
  return cfg.server + '/rest/' + method + '.view?' + authParams() + (extra || '');
}
function coverUrl(id) {
  return id ? apiUrl('getCoverArt', '&id=' + id + '&size=60') : '';
}

var themeAccent = '#1db954';
var themeBg     = '#1a1a1a';
var themeBg2    = '#222222';

var _themeEl = null;
function getThemeEl() {
  if (!_themeEl) {
    _themeEl = document.createElement('style');
    document.getElementsByTagName('head')[0].appendChild(_themeEl);
  }
  return _themeEl;
}

function hexLighten(hex, amt) {
  var n = parseInt(hex.replace('#',''), 16);
  var r = Math.min(255, ((n>>16)&0xff)+amt);
  var g = Math.min(255, ((n>>8) &0xff)+amt);
  var b = Math.min(255, ( n     &0xff)+amt);
  return '#'+[r,g,b].map(function(x){return('0'+x.toString(16)).slice(-2);}).join('');
}

function applyTheme() {
  var a   = themeAccent;
  var bg  = themeBg;
  var bg2 = themeBg2;
  var bg3 = hexLighten(bg2, 10);

  getThemeEl().innerHTML =
    'body,#login,#app,#content{background:' + bg + ' !important}' +
    '#nav,#player,#settings-box{background:' + bg2 + ' !important}' +
    '.list-item,.play-all-row{background:' + bg + ' !important}' +
    '.item-art-placeholder,#player-art,#progress-wrap{background:' + bg3 + ' !important}' +
    '#connect-btn,.play-all-icon{background:' + a + ' !important}' +
    '#settings-done{background:' + a + ' !important;color:#fff !important}' +
    '#progress-bar{background:' + a + ' !important}' +
    '.play-all-label,.back-btn{color:' + a + ' !important}' +
    '.back-btn{background:' + bg2 + ' !important}' +
    '#nav button.active{color:' + a + ' !important;border-bottom-color:' + a + ' !important}' +
    '#login-inner input{background:' + bg3 + ' !important}';

  setVal('set-accent', a);
  setVal('set-bg',     bg);
  setVal('set-bg2',    bg2);
}

function loadTheme() {
  var t = {};
  try { t = JSON.parse(localStorage.getItem('mp_theme') || '{}'); } catch(e) {}
  themeAccent = t.accent || '#1db954';
  themeBg     = t.bg     || '#1a1a1a';
  themeBg2    = t.bg2    || '#222222';
  applyTheme();
}

function saveTheme() {
  localStorage.setItem('mp_theme', JSON.stringify({
    accent: themeAccent, bg: themeBg, bg2: themeBg2
  }));
}

function applyAccent(v) { themeAccent = v; applyTheme(); saveTheme(); }
function applyBg(v)     { themeBg     = v; applyTheme(); saveTheme(); }
function applyBg2(v)    { themeBg2    = v; applyTheme(); saveTheme(); }

function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
function getVal(id)    { var el = document.getElementById(id); return el ? el.value : ''; }

function openSettings() {
  var el = document.getElementById('settings-overlay');
  el.style.display = '-webkit-flex';
  el.style.display = 'flex';
}
function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
}
function closeSettingsOutside(e) {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
}

function saveSession()  { localStorage.setItem('mp_cfg', JSON.stringify(cfg)); }
function clearSession() { localStorage.removeItem('mp_cfg'); }

function doLogin() {
  var server   = document.getElementById('server').value.trim().replace(/\/$/, '');
  var username = document.getElementById('username').value.trim();
  var password = document.getElementById('password').value;
  if (!server || !username || !password) { showErr('Please fill in all fields'); return; }
  cfg = { server: server, username: username, password: password };
  pingAndEnter(true);
}

function pingAndEnter(save) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', apiUrl('ping'), true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try {
      var r = JSON.parse(xhr.responseText)['subsonic-response'];
      if (r && r.status === 'ok') {
        if (save) saveSession();
        showApp();
      } else {
        clearSession();
        showErr('Login failed - check your details');
      }
    } catch(e) {
      clearSession();
      showErr('Could not connect to server');
    }
  };
  xhr.send();
}

function doLogout() {
  clearSession();
  cfg = {}; queue = [];
  audio.pause(); audio.src = '';
  closeSettings();
  document.getElementById('player').style.display = 'none';
  document.getElementById('app').style.display    = 'none';
  var login = document.getElementById('login');
  login.style.display = '-webkit-flex';
  login.style.display = 'flex';
  showErr('');
}

function showErr(msg) { document.getElementById('error-msg').textContent = msg; }

function showApp() {
  document.getElementById('login').style.display = 'none';
  var app = document.getElementById('app');
  app.style.display = '-webkit-box';
  app.style.display = '-webkit-flex';
  app.style.display = 'flex';
  showTab('playlists');
}

window.onload = function() {
  loadTheme();
  var saved = localStorage.getItem('mp_cfg');
  if (saved) {
    try {
      cfg = JSON.parse(saved);
      setVal('server',   cfg.server   || '');
      setVal('username', cfg.username || '');
      setVal('password', cfg.password || '');
      pingAndEnter(false);
    } catch(e) { clearSession(); }
  }
};

function showTab(tab) {
  var tabs = ['playlists', 'artists', 'albums'];
  for (var i = 0; i < tabs.length; i++) {
    document.getElementById('tab-' + tabs[i]).className = (tabs[i] === tab) ? 'active' : '';
  }
  if      (tab === 'playlists') loadPlaylists();
  else if (tab === 'artists')   loadArtists();
  else if (tab === 'albums')    loadAlbums();
}

function setContent(html) { document.getElementById('content').innerHTML = html; }
function setLoading()     { setContent('<div id="loading-msg">Loading\u2026</div>'); }

function artImg(coverArtId, symbol) {
  if (coverArtId) {
    return '<img class="item-art" src="' + coverUrl(coverArtId) + '" onerror="this.style.display=\'none\'">';
  }
  return '<div class="item-art-placeholder">' + (symbol || '&#9835;') + '</div>';
}

function playAllRow(songs) {
  if (songs.length < 2) return '';
  var key = 'pa_' + Date.now();
  window._songCache = window._songCache || {};
  window._songCache[key] = songs;
  return '<div class="play-all-row" onclick="playAllCached(\'' + key + '\')">' +
    '<div class="play-all-icon">&#9654;</div>' +
    '<div class="item-info">' +
      '<div class="play-all-label">Play All</div>' +
      '<div class="play-all-sub">' + songs.length + ' songs</div>' +
    '</div></div>';
}

function playAllCached(key) {
  var s = window._songCache && window._songCache[key];
  if (s) playAll(s);
}

function backBtn(label, fn) {
  window._backFn = fn;
  return '<button class="back-btn" onclick="goBack()">&#8249; ' + esc(label) + '</button>';
}
function goBack() { if (window._backFn) window._backFn(); }

function toggleShuffle() {
  shuffle = !shuffle;

  var btn = document.getElementById('shuffle-btn');
  btn.style.color = shuffle ? themeAccent : '#ffffff';

  if (shuffle) {
    originalQueue = queue.slice();

    for (var i = queue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = queue[i];
      queue[i] = queue[j];
      queue[j] = temp;
    }

    queueIdx = 0;
  } else {
    queue = originalQueue.slice();
    queueIdx = 0;
  }
}

function loadPlaylists() {
  setLoading();
  get(apiUrl('getPlaylists'), function(data) {
    var list = forceArray(data.playlists && data.playlists.playlist);
    if (!list.length) { setContent('<div id="loading-msg">No playlists</div>'); return; }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      html += '<div class="list-item" onclick="loadPlaylist(\'' + p.id + '\',\'' + escQ(p.name) + '\')">' +
        '<div class="item-art-placeholder">&#9835;</div>' +
        '<div class="item-info">' +
          '<div class="item-name">' + esc(p.name) + '</div>' +
          '<div class="item-sub">' + (p.songCount || 0) + ' songs</div>' +
        '</div><div class="item-chevron">&#8250;</div></div>';
    }
    setContent(html);
  });
}

function loadPlaylist(id, name) {
  setLoading();
  get(apiUrl('getPlaylist', '&id=' + id), function(data) {
    var songs = forceArray(data.playlist && data.playlist.entry);
    renderSongs(songs, name, function() { showTab('playlists'); });
  });
}

function loadArtists() {
  setLoading();
  get(apiUrl('getArtists'), function(data) {
    var indices = forceArray(data.artists && data.artists.index);
    var artists = [];
    for (var i = 0; i < indices.length; i++) {
      artists = artists.concat(forceArray(indices[i].artist));
    }
    if (!artists.length) { setContent('<div id="loading-msg">No artists</div>'); return; }
    var html = '';
    for (var j = 0; j < artists.length; j++) {
      var a = artists[j];
      html += '<div class="list-item" onclick="loadArtist(\'' + a.id + '\',\'' + escQ(a.name) + '\')">' +
        artImg(a.coverArt, '&#9836;') +
        '<div class="item-info">' +
          '<div class="item-name">' + esc(a.name) + '</div>' +
          '<div class="item-sub">' + (a.albumCount || 0) + ' albums</div>' +
        '</div><div class="item-chevron">&#8250;</div></div>';
    }
    setContent(html);
  });
}

function loadArtist(id, name) {
  window._artistId   = id;
  window._artistName = name;
  setLoading();
  get(apiUrl('getArtist', '&id=' + id), function(data) {
    var albums = forceArray(data.artist && data.artist.album);
    var html = backBtn('Artists', function() { showTab('artists'); });
    if (albums.length > 1) {
      html += '<div class="play-all-row" onclick="playArtistAll(\'' + id + '\')">' +
        '<div class="play-all-icon">&#9654;</div>' +
        '<div class="item-info">' +
          '<div class="play-all-label">Play All</div>' +
          '<div class="play-all-sub">' + albums.length + ' albums</div>' +
        '</div></div>';
    }
    for (var i = 0; i < albums.length; i++) {
      var a = albums[i];
      html += '<div class="list-item" onclick="loadAlbum(\'' + a.id + '\',\'' + escQ(a.name) + '\',\'artist\')">' +
        artImg(a.coverArt, '&#9834;') +
        '<div class="item-info">' +
          '<div class="item-name">' + esc(a.name) + '</div>' +
          '<div class="item-sub">' + (a.year || '') + (a.songCount ? (a.year ? ' · ' : '') + a.songCount + ' songs' : '') + '</div>' +
        '</div><div class="item-chevron">&#8250;</div></div>';
    }
    if (!albums.length) html += '<div id="loading-msg">No albums</div>';
    setContent(html);
  });
}

function playArtistAll(artistId) {
  setLoading();
  get(apiUrl('getArtist', '&id=' + artistId), function(data) {
    var albums = forceArray(data.artist && data.artist.album);
    if (!albums.length) return;
    var all = [], done = 0, total = albums.length;
    for (var i = 0; i < total; i++) {
      (function(alb) {
        get(apiUrl('getAlbum', '&id=' + alb.id), function(d) {
          all = all.concat(forceArray(d.album && d.album.song));
          done++;
          if (done === total) { queue = all; queueIdx = 0; playCurrent(); }
        });
      })(albums[i]);
    }
  });
}

function loadAlbums() {
  setLoading();
  get(apiUrl('getAlbumList2', '&type=alphabeticalByName&size=500'), function(data) {
    var albums = forceArray(data.albumList2 && data.albumList2.album);
    if (!albums.length) { setContent('<div id="loading-msg">No albums</div>'); return; }
    var html = '';
    for (var i = 0; i < albums.length; i++) {
      var a = albums[i];
      html += '<div class="list-item" onclick="loadAlbum(\'' + a.id + '\',\'' + escQ(a.name) + '\',\'albums\')">' +
        artImg(a.coverArt, '&#9834;') +
        '<div class="item-info">' +
          '<div class="item-name">' + esc(a.name) + '</div>' +
          '<div class="item-sub">' + esc(a.artist || '') + (a.year ? ' · ' + a.year : '') + '</div>' +
        '</div><div class="item-chevron">&#8250;</div></div>';
    }
    setContent(html);
  });
}

function loadAlbum(id, name, ctx) {
  setLoading();
  get(apiUrl('getAlbum', '&id=' + id), function(data) {
    var songs = forceArray(data.album && data.album.song);
    var back = ctx === 'artist'
      ? function() { loadArtist(window._artistId, window._artistName); }
      : function() { showTab('albums'); };
    renderSongs(songs, name, back);
  });
}

function renderSongs(songs, title, backFn) {
  window._currentSongs = songs;
  var html = backBtn(title, backFn) + playAllRow(songs);
  for (var i = 0; i < songs.length; i++) {
    var s = songs[i];
    html += '<div class="list-item" onclick="playSongIdx(' + i + ')">' +
      artImg(s.coverArt, '&#9835;') +
      '<div class="item-info">' +
        '<div class="item-name">' + esc(s.title) + '</div>' +
        '<div class="item-sub">' + esc(s.artist || '') + (s.album ? ' · ' + esc(s.album) : '') + '</div>' +
      '</div></div>';
  }
  if (!songs.length) html += '<div id="loading-msg">No songs</div>';
  setContent(html);
}

function playSongIdx(idx) {
  playSongAt(idx, window._currentSongs || []);
}

function playSongAt(idx, songs) { queue = songs; queueIdx = idx; playCurrent(); }
function playAll(songs)         { queue = songs; queueIdx = 0;   playCurrent(); }

function playCurrent() {
  if (!queue.length) return;
  var s = queue[queueIdx];
  audio.src = apiUrl('stream', '&id=' + s.id + '&maxBitRate=128');
  audio.load();
  audio.play();

  document.getElementById('player-title').textContent  = s.title  || 'Unknown';
  document.getElementById('player-artist').textContent = s.artist || (s.album || '');
  document.getElementById('play-btn').innerHTML        = '&#9646;&#9646;';

  var playerEl = document.getElementById('player');
  playerEl.style.display = '-webkit-flex';
  playerEl.style.display = 'flex';

  var artEl = document.getElementById('player-art');
  if (s.coverArt) {
    artEl.innerHTML = '<img src="' + coverUrl(s.coverArt) + '" onerror="this.style.display=\'none\'" style="width:100%;height:100%;border-radius:6px;">';
  } else {
    artEl.innerHTML = '&#9835;';
  }
}

function togglePlay() {
  if (audio.paused) {
    audio.play();
    document.getElementById('play-btn').innerHTML = '&#9646;&#9646;';
  } else {
    audio.pause();
    document.getElementById('play-btn').innerHTML = '&#9654;';
  }
}

function nextSong() {
  if (queueIdx < queue.length - 1) {
    queueIdx++;
    playCurrent();
  } else if (shuffle) {
    toggleShuffle();
    toggleShuffle();
  }
}
function prevSong() {
  if (audio.currentTime > 3) { audio.currentTime = 0; }
  else if (queueIdx > 0)     { queueIdx--; playCurrent(); }
}

function seekTo(e) {
  var wrap = document.getElementById('progress-wrap');
  var rect = wrap.getBoundingClientRect();
  var clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
  var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  if (audio.duration) audio.currentTime = pct * audio.duration;
}

function fmt(s) {
  s = Math.floor(s || 0);
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

audio.addEventListener('timeupdate', function() {
  if (!audio.duration) return;
  var pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('time-cur').textContent     = fmt(audio.currentTime);
  document.getElementById('time-dur').textContent     = fmt(audio.duration);
});

audio.addEventListener('ended', nextSong);
audio.addEventListener('play',  function() { document.getElementById('play-btn').innerHTML = '&#9646;&#9646;'; });
audio.addEventListener('pause', function() { document.getElementById('play-btn').innerHTML = '&#9654;'; });

function get(url, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try { cb(JSON.parse(xhr.responseText)['subsonic-response']); }
    catch(e) { setContent('<div id="loading-msg">Error loading data</div>'); }
  };
  xhr.send();
}

function forceArray(v) {
  if (!v) return [];
  return (v instanceof Array) ? v : [v];
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escQ(s) { return (s || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
