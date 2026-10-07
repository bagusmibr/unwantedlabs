/* UNWANTED LABS — Upload Booster: hook halaman (world MAIN)
   Made by Bagus (Shifted) MIBR

   Cara kerja:
   TikTok membungkus data posting menjadi JSON lewat JSON.stringify sebelum
   dikirim ke server. Fungsi itu dibungkus di sini. Saat booster AKTIF dan
   objeknya adalah request posting (punya single_post_req_list /
   vedit_common_info / post_common_info), jejak editor web TikTok dibersihkan
   supaya server memperlakukannya sebagai upload mentah, bukan hasil editor
   yang harus di-render ulang di cloud (render ulang itulah yang menurunkan
   FPS & bitrate).

   Yang diubah:
     - hapus: draft, canvas_config, vedit_segment_info
     - cloud_edit_is_use_video_canvas -> false
     - post_type 2 -> 3
     - enter_post_page_from -> 1 (tombol upload utama)

   Status aktif/mati dikirim oleh content.js lewat window.postMessage, karena
   skrip di world MAIN tidak bisa membaca chrome.storage.
*/
(function () {
  'use strict';
  if (window.__ulBoosterInstalled) return;
  window.__ulBoosterInstalled = true;

  var active = false;
  var cleaned = 0;

  var FORBIDDEN = ['draft', 'canvas_config', 'vedit_segment_info'];
  var MARKERS = ['single_post_req_list', 'vedit_common_info', 'post_common_info'];

  function isUploadPage() {
    var u = location.href;
    return u.indexOf('/upload') !== -1 || u.indexOf('/creator-center') !== -1;
  }

  function deepClean(obj, seen) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);

    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, FORBIDDEN[i])) delete obj[FORBIDDEN[i]];
    }
    if (obj.cloud_edit_is_use_video_canvas !== undefined) obj.cloud_edit_is_use_video_canvas = false;
    if (obj.post_type === 2) obj.post_type = 3;
    if (obj.enter_post_page_from !== undefined) obj.enter_post_page_from = 1;

    for (var k in obj) {
      if (obj[k] && typeof obj[k] === 'object') deepClean(obj[k], seen);
    }
  }

  function isPostRequest(v) {
    for (var i = 0; i < MARKERS.length; i++) if (v[MARKERS[i]]) return true;
    return false;
  }

  function report() {
    window.postMessage({ source: 'ul-page', type: 'stats', active: active, cleaned: cleaned }, '*');
  }

  var original = JSON.stringify;
  JSON.stringify = function (value) {
    if (active && value && typeof value === 'object' && isUploadPage()) {
      try {
        if (isPostRequest(value)) {
          deepClean(value, new WeakSet());
          cleaned++;
          report();
        }
      } catch (e) {
        console.error('[UL Booster] gagal membersihkan request:', e);
      }
    }
    return original.apply(this, arguments);
  };

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.source !== 'ul-ext') return;
    if (e.data.type === 'state') {
      active = e.data.active === true;
      report();
    }
  });

  // Minta status ke content.js (kalau content.js sudah siap duluan).
  window.postMessage({ source: 'ul-page', type: 'hello' }, '*');
})();
