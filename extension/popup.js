/* UNWANTED LABS — Upload Booster: popup */
'use strict';

var $ = function (id) { return document.getElementById(id); };

function licenseValid(lic) {
  return !!(lic && lic.ok === true && typeof lic.until === 'number' && Date.now() < lic.until);
}

function render() {
  chrome.storage.local.get(['enabled', 'lic'], function (r) {
    var ok = licenseValid(r.lic);
    var on = r.enabled === true;

    $('toggle').checked = on && ok;
    $('toggle').disabled = !ok;
    $('card').classList.toggle('on', on && ok);
    $('statusLbl').textContent = !ok ? 'Terkunci' : (on ? 'Aktif' : 'Mati');
    $('statusSub').textContent = !ok
      ? 'Lisensi belum aktif'
      : (on ? 'Refresh halaman upload TikTok' : 'Nyalakan sebelum upload');

    var licBox = $('lic');
    if (ok) {
      licBox.classList.remove('bad');
      $('licText').textContent = r.lic.email ? ('Aktif · ' + r.lic.email) : 'Aktif';
    } else {
      licBox.classList.add('bad');
      $('licText').textContent = (r.lic && r.lic.reason) || 'Belum diaktifkan';
    }
  });
}

$('toggle').addEventListener('change', function (e) {
  chrome.storage.local.set({ enabled: e.target.checked }, render);
});

$('recheck').addEventListener('click', function () {
  $('licText').textContent = 'Memeriksa…';
  chrome.runtime.sendMessage({ type: 'ul-verify' }, render);
});

$('foot').textContent = 'v' + chrome.runtime.getManifest().version + ' · Made by Bagus (Shifted) MIBR';
chrome.storage.onChanged.addListener(render);
render();
