/* UNWANTED LABS — Upload Booster: lisensi (service worker)
   Made by Bagus (Shifted) MIBR

   license.json disisipkan server saat pelanggan mengunduh ZIP dari dashboard
   ({ token, api }). Token dicek ke  POST {api}/api/extension/verify  bersama
   installId acak milik instalasi ini. Server mengikat token ke installId
   pertama yang datang (1 lisensi = 1 komputer).

   Hasil cek disimpan di chrome.storage.local.lic:
     { ok:true,  until:<ms>, checkedAt:<ms> }   -> boleh dipakai sampai `until`
     { ok:false, reason:"..." }                  -> ditolak server
   Kalau server tidak bisa dihubungi, lisensi lama tetap berlaku sampai
   `until` habis (tenggang offline 7 hari).
*/
'use strict';

var GRACE_MS = 7 * 24 * 60 * 60 * 1000;
var RECHECK_MIN = 6 * 60;

function store(get) {
  return new Promise(function (res) { chrome.storage.local.get(get, res); });
}
function save(obj) {
  return new Promise(function (res) { chrome.storage.local.set(obj, res); });
}

async function readLicenseFile() {
  try {
    var r = await fetch(chrome.runtime.getURL('license.json'));
    if (!r.ok) return null;
    var j = await r.json();
    if (typeof j.token !== 'string' || typeof j.api !== 'string') return null;
    return j;
  } catch (e) {
    return null;
  }
}

async function installId() {
  var s = await store(['installId']);
  if (s.installId) return s.installId;
  var id = crypto.randomUUID();
  await save({ installId: id });
  return id;
}

async function verify() {
  var file = await readLicenseFile();
  if (!file) {
    await save({ lic: { ok: false, reason: 'File lisensi tidak ada. Unduh ulang extension dari dashboard.' } });
    return;
  }

  var id = await installId();
  try {
    var res = await fetch(file.api.replace(/\/$/, '') + '/api/extension/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: file.token, installId: id, version: chrome.runtime.getManifest().version }),
    });
    var j = await res.json().catch(function () { return {}; });

    if (res.ok && j.ok === true) {
      await save({ lic: { ok: true, until: Date.now() + GRACE_MS, checkedAt: Date.now(), email: j.email || '' } });
      return;
    }
    // 4xx = server menolak secara sadar → kunci. 5xx/lainnya = anggap gangguan.
    if (res.status >= 400 && res.status < 500) {
      await save({ lic: { ok: false, reason: j.reason || 'Lisensi ditolak.' } });
    }
  } catch (e) {
    // Offline: biarkan lisensi lama berlaku sampai masa tenggangnya habis.
  }
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.alarms.create('ul-verify', { periodInMinutes: RECHECK_MIN });
  verify();
});
chrome.runtime.onStartup.addListener(function () {
  chrome.alarms.create('ul-verify', { periodInMinutes: RECHECK_MIN });
  verify();
});
chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name === 'ul-verify') verify();
});

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg && msg.type === 'ul-verify') {
    verify().then(function () { sendResponse({ done: true }); });
    return true;
  }
});
