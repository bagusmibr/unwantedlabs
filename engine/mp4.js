/* UNWANTED LABS — MP4 box reader (browser build)
   Made by Bagus (Shifted) MIBR

   IMPORTANT for large files: the whole video is NEVER loaded into memory. Only
   the `moov` box is read (typically a few hundred KB). Output is assembled as a
   Blob from slices of the original File, so the browser streams it from disk
   and a 1 GB file is perfectly safe.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ULMP4 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONTAINERS = { moov: 1, trak: 1, mdia: 1, edts: 1, minf: 1, stbl: 1 };

  function typeAt(dv, off) {
    return String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
  }

  /** Walk boxes inside a DataView. Returned offsets are relative to dv. */
  function readBoxes(dv, start, end) {
    var out = [];
    var pos = start;
    while (pos + 8 <= end) {
      var size = dv.getUint32(pos);
      var type = typeAt(dv, pos + 4);
      var headerSize = 8;
      if (size === 1) {
        if (pos + 16 > end) break;
        size = Number(dv.getBigUint64(pos + 8));
        headerSize = 16;
      } else if (size === 0) {
        size = end - pos;
      }
      if (size < headerSize || pos + size > end) break;

      var box = {
        type: type,
        start: pos,
        size: size,
        payload: pos + headerSize,
        payloadEnd: pos + size,
        children: [],
      };
      if (CONTAINERS[type]) box.children = readBoxes(dv, box.payload, box.payloadEnd);
      out.push(box);
      pos += size;
    }
    return out;
  }

  function find(list, type) {
    for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i];
    return null;
  }
  function findAll(list, type) {
    var r = [];
    for (var i = 0; i < list.length; i++) if (list[i].type === type) r.push(list[i]);
    return r;
  }

  var version = function (dv, box) { return dv.getUint8(box.payload); };

  /** mvhd and mdhd share an identical timescale/duration layout. */
  function headerFields(dv, box) {
    return version(dv, box) === 1
      ? { timescale: box.payload + 20, duration: box.payload + 24, dur64: true }
      : { timescale: box.payload + 12, duration: box.payload + 16, dur64: false };
  }
  function tkhdDuration(dv, box) {
    return version(dv, box) === 1
      ? { duration: box.payload + 28, dur64: true }
      : { duration: box.payload + 20, dur64: false };
  }
  /** Offset of the first matrix element in tkhd (9 x uint32, 16.16 fixed). */
  function tkhdMatrix(dv, box) {
    return version(dv, box) === 1 ? box.payload + 52 : box.payload + 40;
  }

  function readNum(dv, off, is64) {
    return is64 ? Number(dv.getBigUint64(off)) : dv.getUint32(off);
  }
  function writeNum(dv, off, val, is64) {
    if (is64) dv.setBigUint64(off, BigInt(Math.round(val)));
    else dv.setUint32(off, val >>> 0);
  }

  function handlerType(dv, mdia) {
    var hdlr = find(mdia.children, 'hdlr');
    if (!hdlr) return null;
    return typeAt(dv, hdlr.payload + 8);
  }

  function videoTraks(dv, moov) {
    return findAll(moov.children, 'trak').filter(function (t) {
      var mdia = find(t.children, 'mdia');
      return mdia && handlerType(dv, mdia) === 'vide';
    });
  }

  function audioTraks(dv, moov) {
    return findAll(moov.children, 'trak').filter(function (t) {
      var mdia = find(t.children, 'mdia');
      return mdia && handlerType(dv, mdia) === 'soun';
    });
  }

  /** Track duration in SECONDS, read from tkhd (units are the movie timescale). */
  function trakSeconds(dv, trak, movieTimescale) {
    if (!movieTimescale) return 0;
    var tkhd = find(trak.children, 'tkhd');
    if (!tkhd) return 0;
    var tf = tkhdDuration(dv, tkhd);
    return readNum(dv, tf.duration, tf.dur64) / movieTimescale;
  }

  function movieTimescale(dv, moov) {
    var mvhd = find(moov.children, 'mvhd');
    if (!mvhd) return 0;
    return dv.getUint32(headerFields(dv, mvhd).timescale);
  }

  /** The dominant sample_delta in a track's stts. */
  function dominantSttsDelta(dv, trak) {
    var mdia = find(trak.children, 'mdia');
    var minf = mdia && find(mdia.children, 'minf');
    var stbl = minf && find(minf.children, 'stbl');
    var stts = stbl && find(stbl.children, 'stts');
    if (!stts) return 0;
    var count = dv.getUint32(stts.payload + 4);
    var best = 0, delta = 0;
    for (var i = 0; i < count && i < 4096; i++) {
      var off = stts.payload + 8 + i * 8;
      if (off + 8 > stts.payloadEnd) break;
      var n = dv.getUint32(off), d = dv.getUint32(off + 4);
      if (n > best) { best = n; delta = d; }
    }
    return delta;
  }

  /* Detects a UNIFORMLY scaled timeline (video and audio together), the kind
     `ffmpeg -itsscale N` produces.

     Why this needs its own trick: when both tracks are scaled by the same
     factor there is no cross-track inconsistency left to compare. The file
     looks like an ordinary video that happens to be long, and duration
     comparison cannot tell the difference.

     The giveaway is inside the audio track. One AAC-LC frame always holds
     1024 samples, so the audio stts sample_delta must be 1024. Reading 2048,
     4096, 6144 ... means the timeline was multiplied by that much.

     Being honest about the limit: 2048 is also legitimate for HE-AAC/SBR, so a
     factor of exactly 2 is reported as suspected rather than certain. A factor
     of 3 or more has no legitimate equivalent in any AAC variant. */
  function detectUniformScale(dv, moov) {
    var atraks = audioTraks(dv, moov);
    if (!atraks.length) return { scale: 1, confident: false, delta: 0 };
    var trak = atraks[0];
    if (sampleFormat(dv, trak) !== 'mp4a') return { scale: 1, confident: false, delta: 0 };
    var delta = dominantSttsDelta(dv, trak);
    if (!delta) return { scale: 1, confident: false, delta: 0 };
    var k = delta / 1024;
    if (k < 1.9) return { scale: 1, confident: false, delta: delta };
    if (Math.abs(k - Math.round(k)) > 0.01) return { scale: 1, confident: false, delta: delta };
    k = Math.round(k);
    return { scale: k, confident: k >= 3, delta: delta };
  }

  /** fourcc of the first stsd entry — this track's codec (avc1 / hvc1 / mp4a / …). */
  function sampleFormat(dv, trak) {
    var mdia = find(trak.children, 'mdia');
    var minf = mdia && find(mdia.children, 'minf');
    var stbl = minf && find(minf.children, 'stbl');
    var stsd = stbl && find(stbl.children, 'stsd');
    if (!stsd) return null;
    if (stsd.payload + 16 > stsd.payloadEnd) return null;
    return typeAt(dv, stsd.payload + 12);
  }

  // ── Find and load the moov box from a File, without reading the whole file ─
  async function locateMoov(file) {
    var pos = 0;
    var size = file.size;
    var sawMdat = false;   // mdat before moov means NOT faststart
    while (pos + 8 <= size) {
      var headBuf = await file.slice(pos, Math.min(pos + 16, size)).arrayBuffer();
      var hv = new DataView(headBuf);
      if (headBuf.byteLength < 8) break;
      var boxSize = hv.getUint32(0);
      var type = typeAt(hv, 4);
      if (boxSize === 1) {
        if (headBuf.byteLength < 16) break;
        boxSize = Number(hv.getBigUint64(8));
      } else if (boxSize === 0) {
        boxSize = size - pos;
      }
      if (boxSize < 8) break;
      if (type === 'moov') return { start: pos, end: pos + boxSize, faststart: !sawMdat };
      if (type === 'mdat') sawMdat = true;
      pos += boxSize;
    }
    return null;
  }

  /** Read moov into an ArrayBuffer. Returns { start, end, buffer, dv, moov }. */
  async function loadMoov(file) {
    var loc = await locateMoov(file);
    if (!loc) throw new Error('No moov box found — this is not a valid MP4/MOV file.');
    if (loc.end - loc.start > 256 * 1024 * 1024) throw new Error('The moov box is too large (over 256 MB).');
    var buffer = await file.slice(loc.start, loc.end).arrayBuffer();
    var dv = new DataView(buffer);
    var boxes = readBoxes(dv, 0, buffer.byteLength);
    var moov = find(boxes, 'moov');
    if (!moov) throw new Error('The moov box could not be read.');
    return {
      start: loc.start, end: loc.end, buffer: buffer, dv: dv, moov: moov,
      faststart: loc.faststart !== false,
    };
  }

  // ── Video info (all of it lives inside moov) ───────────────────────────────
  function parseInfo(ctx, fileSize) {
    var dv = ctx.dv, moov = ctx.moov;
    var mvhd = find(moov.children, 'mvhd');
    var duration = 0;
    if (mvhd) {
      var f = headerFields(dv, mvhd);
      var ts = dv.getUint32(f.timescale);
      var d = readNum(dv, f.duration, f.dur64);
      if (ts > 0) duration = d / ts;
    }

    var traks = videoTraks(dv, moov);
    if (!traks.length) throw new Error('This file has no video track.');
    var trak = traks[0];
    var mdia = find(trak.children, 'mdia');

    // fps = mdhd.timescale / stts sample_delta
    var fps = 0, mdhdTs = 0, sampleDelta = 0, frames = 0;
    var mdhd = find(mdia.children, 'mdhd');
    if (mdhd) mdhdTs = dv.getUint32(headerFields(dv, mdhd).timescale);

    var minf = find(mdia.children, 'minf');
    var stbl = minf && find(minf.children, 'stbl');
    var stts = stbl && find(stbl.children, 'stts');
    if (stts) {
      var count = dv.getUint32(stts.payload + 4);
      var best = 0;
      for (var i = 0; i < count && i < 4096; i++) {
        var off = stts.payload + 8 + i * 8;
        if (off + 8 > stts.payloadEnd) break;
        var n = dv.getUint32(off);
        var delta = dv.getUint32(off + 4);
        frames += n;
        if (n > best) { best = n; sampleDelta = delta; }
      }
    }
    if (mdhdTs > 0 && sampleDelta > 0) fps = mdhdTs / sampleDelta;

    // Resolution: tkhd width/height (16.16 fixed)
    var width = 0, height = 0;
    var tkhd = find(trak.children, 'tkhd');
    if (tkhd) {
      var mbase = tkhdMatrix(dv, tkhd);
      width = Math.round(dv.getUint32(mbase + 36) / 65536);
      height = Math.round(dv.getUint32(mbase + 40) / 65536);
    }

    /* Reference for spotting a shifted file: when the video track runs longer
       than the audio track, this file is stretched. The ratio is exactly the
       factor that would have to be undone to restore it. */
    var movieTs = movieTimescale(dv, moov);
    var atraks = audioTraks(dv, moov);
    var videoSeconds = trakSeconds(dv, trak, movieTs);
    var audioSeconds = atraks.length ? trakSeconds(dv, atraks[0], movieTs) : 0;
    var speedRatio = (audioSeconds > 0 && videoSeconds > 0) ? videoSeconds / audioSeconds : 1;
    var uniform = detectUniformScale(dv, moov);

    return {
      width: width,
      height: height,
      fps: Math.round(fps * 1000) / 1000,
      fpsRounded: Math.round(fps),
      frames: frames,
      duration: duration,
      hasAudio: atraks.length > 0,
      audioTrakCount: atraks.length,
      videoCodec: sampleFormat(dv, trak),
      audioCodec: atraks.length ? sampleFormat(dv, atraks[0]) : null,
      faststart: ctx.faststart !== false,
      uniformScale: uniform.scale,
      uniformScaleConfident: uniform.confident,
      audioFrameDelta: uniform.delta,
      videoSeconds: videoSeconds,
      audioSeconds: audioSeconds,
      speedRatio: speedRatio,
      isShifted: speedRatio > 1.02,
      bitrateKbps: duration > 0 ? Math.round((fileSize * 8) / duration / 1000) : 0,
      sizeMB: (fileSize / 1048576).toFixed(1),
      fileSize: fileSize,
      mdhdTimescale: mdhdTs,
      sampleDelta: sampleDelta,
      videoTrakCount: traks.length,
    };
  }

  // ── TikTok's real limits (used to flag things in the UI) ──────────────────
  var TIKTOK = {
    fpsMin: 23,
    fpsMax: 60,
    idealW: 1080,
    idealH: 1920,
    usefulKbps: 25000,
    maxBytes: 4 * 1024 * 1024 * 1024,
  };

  return {
    loadMoov: loadMoov,
    parseInfo: parseInfo,
    TIKTOK: TIKTOK,
    _internal: {
      readBoxes: readBoxes, find: find,
      videoTraks: videoTraks, audioTraks: audioTraks,
      trakSeconds: trakSeconds, movieTimescale: movieTimescale,
    },
  };
});
