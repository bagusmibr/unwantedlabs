/* UNWANTED LABS — Upload Booster: jembatan + badge (world ISOLATED)
   Made by Bagus (Shifted) MIBR

   - Membaca status dari chrome.storage (toggle + lisensi) lalu meneruskannya
     ke inject.js lewat window.postMessage.
   - Menampilkan badge kecil di halaman upload supaya pelanggan tahu booster
     benar-benar aktif dan berapa request posting yang sudah dibersihkan.
*/
(function () {
  'use strict';

  var state = { enabled: false, licensed: false, reason: '' };
  var cleaned = 0;

  function licenseValid(lic) {
    return !!(lic && lic.ok === true && typeof lic.until === 'number' && Date.now() < lic.until);
  }

  function isActive() { return state.enabled && state.licensed; }

  function isUploadPage() {
    var u = location.href;
    return u.indexOf('/upload') !== -1 || u.indexOf('/creator-center') !== -1;
  }

  function push() {
    window.postMessage({ source: 'ul-ext', type: 'state', active: isActive() }, '*');
    renderBadge();
  }

  function load() {
    chrome.storage.local.get(['enabled', 'lic'], function (r) {
      state.enabled = r.enabled === true;
      state.licensed = licenseValid(r.lic);
      state.reason = (r.lic && r.lic.reason) || '';
      push();
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes.enabled || changes.lic)) load();
  });

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.source !== 'ul-page') return;
    if (e.data.type === 'hello') push();
    if (e.data.type === 'stats') {
      cleaned = e.data.cleaned || 0;
      renderBadge();
    }
  });

  // ── Badge ──────────────────────────────────────────────────────────────
  var STYLE = [
    '#ul-booster-badge{position:fixed;right:24px;bottom:24px;z-index:2147483647;',
    'font:600 11px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    'background:rgba(10,10,10,.92);color:#fff;border:1px solid rgba(255,255,255,.14);',
    'padding:10px 14px;display:flex;align-items:center;gap:10px;letter-spacing:.06em;',
    'text-transform:uppercase;box-shadow:0 8px 28px rgba(0,0,0,.45);cursor:default;user-select:none}',
    '#ul-booster-badge .ul-dot{width:8px;height:8px;border-radius:50%;background:#555;flex-shrink:0}',
    '#ul-booster-badge.on .ul-dot{background:#2ecc71;box-shadow:0 0 10px #2ecc71}',
    '#ul-booster-badge.warn .ul-dot{background:#f5a623}',
    '#ul-booster-badge .ul-sub{display:block;font-weight:500;color:rgba(255,255,255,.5);',
    'letter-spacing:.02em;text-transform:none;margin-top:2px}',
    '#ul-booster-badge .ul-x{margin-left:6px;opacity:.4;cursor:pointer;font-size:14px;line-height:1}',
    '#ul-booster-badge .ul-x:hover{opacity:1}'
  ].join('');

  var hidden = false;

  function renderBadge() {
    if (!document.body) return;
    var el = document.getElementById('ul-booster-badge');

    if (!isUploadPage() || hidden) {
      if (el) el.remove();
      return;
    }

    if (!document.getElementById('ul-booster-style')) {
      var st = document.createElement('style');
      st.id = 'ul-booster-style';
      st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }

    if (!el) {
      el = document.createElement('div');
      el.id = 'ul-booster-badge';
      document.body.appendChild(el);
    }

    var title, sub, cls;
    if (!state.licensed) {
      title = 'UL Booster — Lisensi';
      sub = state.reason || 'Buka ikon extension untuk aktivasi';
      cls = 'warn';
    } else if (!state.enabled) {
      title = 'UL Booster — Mati';
      sub = 'Nyalakan lewat ikon extension';
      cls = '';
    } else {
      title = 'UL Booster — Aktif';
      sub = cleaned > 0 ? (cleaned + ' request posting dibersihkan') : 'Siap. Upload seperti biasa';
      cls = 'on';
    }

    el.className = cls;
    el.innerHTML = '';
    var dot = document.createElement('span'); dot.className = 'ul-dot';
    var txt = document.createElement('span'); txt.textContent = title;
    var s = document.createElement('span'); s.className = 'ul-sub'; s.textContent = sub;
    txt.appendChild(s);
    var x = document.createElement('span'); x.className = 'ul-x'; x.textContent = '×'; x.title = 'Sembunyikan';
    x.addEventListener('click', function () { hidden = true; renderBadge(); });
    el.appendChild(dot); el.appendChild(txt); el.appendChild(x);
  }

  // TikTok adalah SPA: URL berganti tanpa reload, jadi badge dicek berkala.
  var lastUrl = '';
  setInterval(function () {
    if (location.href !== lastUrl) { lastUrl = location.href; renderBadge(); }
  }, 1000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBadge);
  load();
})();
