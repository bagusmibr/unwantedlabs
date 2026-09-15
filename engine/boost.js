/* UNWANTED LABS — DUAL_AUDIO patch
   Made by Bagus (Shifted) MIBR

   Reconstructed from a byte-for-byte comparison between a raw file and the
   same file after a third-party service processed it — a service whose output
   demonstrably plays at 120 fps on TikTok. What is replicated is the
   MECHANISM, not their code.

   ── What it does ───────────────────────────────────────────────────────────
   1. `mdat` copied through untouched   -> zero re-encode, video not touched
   2. `moov` moved to the front         -> faststart
   3. Every `edts`/`elst` removed       -> no edit list left to honour
   4. A second audio track added        -> copy of the audio table + 9x dummy samples
   5. Dummy block appended after mdat   -> 8 bytes per dummy sample

   That second track points at the SAME AUDIO DATA inside mdat, then runs on
   with fake 8-byte samples each lasting 1 tick. No video timing field is
   changed anywhere, so by construction this cannot produce slow motion — the
   fundamental difference from the timescale/itsscale tricks.

   ── Being honest about it ──────────────────────────────────────────────────
   WHAT changes is fully mapped and can be replicated exactly.
   WHY it works is a hypothesis: this unusual structure most likely keeps
   TikTok's ingest off its aggressive frame-rate normalisation path. That is
   server behaviour, and it can change at any time without notice.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ULBOOST = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONTAINERS = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, edts: 1 };
  var DUMMY_PATTERN = [0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00];
  var DUMMY_SAMPLE_BYTES = 8;
  var SAMPLE_MULTIPLIER = 10;   // new track sample count = 10x the original

  // ── byte helpers ───────────────────────────────────────────────────────────
  function type4(b, o) {
    return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  }
  function rd32(b, o) {
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  }
  function wr32(b, o, v) {
    b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255;
    b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255;
  }
  function rd64(b, o) {
    return rd32(b, o) * 4294967296 + rd32(b, o + 4);
  }
  function wr64(b, o, v) {
    wr32(b, o, Math.floor(v / 4294967296)); wr32(b, o + 4, v >>> 0);
  }

  // ── box tree ───────────────────────────────────────────────────────────────
  /* node = { type, payload:Uint8Array }  or  { type, children:[node] } */
  function parseBoxes(buf, start, end) {
    var out = [], pos = start;
    while (pos + 8 <= end) {
      var size = rd32(buf, pos);
      var type = type4(buf, pos + 4);
      var hs = 8;
      if (size === 1) { size = rd64(buf, pos + 8); hs = 16; }
      else if (size === 0) { size = end - pos; }
      if (size < hs || pos + size > end) break;
      var node = { type: type };
      if (CONTAINERS[type]) node.children = parseBoxes(buf, pos + hs, pos + size);
      else node.payload = buf.subarray(pos + hs, pos + size);
      out.push(node);
      pos += size;
    }
    return out;
  }

  function nodeSize(n) {
    if (n.children) {
      var s = 8;
      for (var i = 0; i < n.children.length; i++) s += nodeSize(n.children[i]);
      return s;
    }
    return 8 + n.payload.length;
  }

  function writeNode(n, out, pos) {
    var size = nodeSize(n);
    wr32(out, pos, size);
    out[pos + 4] = n.type.charCodeAt(0); out[pos + 5] = n.type.charCodeAt(1);
    out[pos + 6] = n.type.charCodeAt(2); out[pos + 7] = n.type.charCodeAt(3);
    var p = pos + 8;
    if (n.children) {
      for (var i = 0; i < n.children.length; i++) p = writeNode(n.children[i], out, p);
    } else {
      out.set(n.payload, p);
      p += n.payload.length;
    }
    return p;
  }

  function serialize(n) {
    var out = new Uint8Array(nodeSize(n));
    writeNode(n, out, 0);
    return out;
  }

  function kid(node, type) {
    if (!node.children) return null;
    for (var i = 0; i < node.children.length; i++) {
      if (node.children[i].type === type) return node.children[i];
    }
    return null;
  }
  function kids(node, type) {
    var r = [];
    if (!node.children) return r;
    for (var i = 0; i < node.children.length; i++) {
      if (node.children[i].type === type) r.push(node.children[i]);
    }
    return r;
  }
  function cloneNode(n) {
    if (n.children) {
      var c = { type: n.type, children: [] };
      for (var i = 0; i < n.children.length; i++) c.children.push(cloneNode(n.children[i]));
      return c;
    }
    return { type: n.type, payload: new Uint8Array(n.payload) };
  }
  function dropChild(node, type) {
    if (!node.children) return false;
    var before = node.children.length;
    node.children = node.children.filter(function (c) { return c.type !== type; });
    return node.children.length !== before;
  }

  // ── field access ───────────────────────────────────────────────────────────
  function stblOf(trak) {
    var mdia = kid(trak, 'mdia'); if (!mdia) return null;
    var minf = kid(mdia, 'minf'); if (!minf) return null;
    return kid(minf, 'stbl');
  }
  function handlerOf(trak) {
    var mdia = kid(trak, 'mdia'); if (!mdia) return null;
    var hdlr = kid(mdia, 'hdlr'); if (!hdlr) return null;
    return type4(hdlr.payload, 8);
  }
  function trackId(trak) {
    var tkhd = kid(trak, 'tkhd'); if (!tkhd) return 0;
    return tkhd.payload[0] === 1 ? rd32(tkhd.payload, 20) : rd32(tkhd.payload, 12);
  }
  function setTrackId(trak, id) {
    var tkhd = kid(trak, 'tkhd');
    if (tkhd) wr32(tkhd.payload, tkhd.payload[0] === 1 ? 20 : 12, id);
  }

  // ── main patch ─────────────────────────────────────────────────────────────
  /**
   * layout : { ftyp:{start,end}, moov:{start,end}, mdat:{start,end}, fileSize }
   * moovBuf: Uint8Array holding the whole moov box (layout.moov.start..end)
   * return : { moovBytes, dummyBytes, newMdatStart, dummyStart, log }
   */
  function build(layout, moovBuf) {
    var log = [];
    var tree = parseBoxes(moovBuf, 0, moovBuf.length);
    var moov = null;
    for (var i = 0; i < tree.length; i++) if (tree[i].type === 'moov') moov = tree[i];
    if (!moov) throw new Error('The moov box could not be read.');

    var traks = kids(moov, 'trak');
    if (!traks.length) throw new Error('No tracks inside moov.');

    // 1. drop every edit list
    var dropped = 0;
    for (i = 0; i < traks.length; i++) if (dropChild(traks[i], 'edts')) dropped++;
    log.push('edts/elst removed from ' + dropped + ' track(s)');

    // 2. find the source audio track
    var audio = null;
    for (i = 0; i < traks.length; i++) if (handlerOf(traks[i]) === 'soun') { audio = traks[i]; break; }
    if (!audio) throw new Error('No audio track. This method needs audio as the source for the second track.');

    var srcStbl = stblOf(audio);
    if (!srcStbl) throw new Error('The audio sample table (stbl) could not be read.');
    var sStts = kid(srcStbl, 'stts'), sStsz = kid(srcStbl, 'stsz');
    var sStsc = kid(srcStbl, 'stsc'), sStco = kid(srcStbl, 'stco') || kid(srcStbl, 'co64');
    if (!sStts || !sStsz || !sStsc || !sStco) throw new Error('The audio sample table is incomplete.');
    var co64 = !kid(srcStbl, 'stco');

    var sampleCount = rd32(sStsz.payload, 8);
    if (!sampleCount) throw new Error('The audio track has no samples.');
    var extra = sampleCount * (SAMPLE_MULTIPLIER - 1);
    var chunkCount = rd32(sStco.payload, 4);

    // 3. build the new track
    var maxId = 0;
    for (i = 0; i < traks.length; i++) maxId = Math.max(maxId, trackId(traks[i]));
    var newId = maxId + 1;

    var nt = cloneNode(audio);
    setTrackId(nt, newId);
    var nStbl = stblOf(nt);

    // stts: one extra entry (extra x 1 tick)
    var oldN = rd32(sStts.payload, 4);
    var stts = new Uint8Array(8 + (oldN + 1) * 8);
    stts.set(sStts.payload.subarray(0, 8 + oldN * 8), 0);
    wr32(stts, 4, oldN + 1);
    wr32(stts, 8 + oldN * 8, extra);
    wr32(stts, 12 + oldN * 8, 1);
    kid(nStbl, 'stts').payload = stts;

    // stsz: `extra` more entries of 8 bytes each
    var fixed = rd32(sStsz.payload, 4);
    var stsz = new Uint8Array(12 + (sampleCount + extra) * 4);
    wr32(stsz, 0, rd32(sStsz.payload, 0));
    wr32(stsz, 4, 0);
    wr32(stsz, 8, sampleCount + extra);
    if (fixed) {
      for (i = 0; i < sampleCount; i++) wr32(stsz, 12 + i * 4, fixed);
    } else {
      stsz.set(sStsz.payload.subarray(12, 12 + sampleCount * 4), 12);
    }
    for (i = 0; i < extra; i++) wr32(stsz, 12 + (sampleCount + i) * 4, DUMMY_SAMPLE_BYTES);
    kid(nStbl, 'stsz').payload = stsz;

    // stsc: one extra entry — every dummy sample becomes one new chunk
    var scN = rd32(sStsc.payload, 4);
    var stsc = new Uint8Array(8 + (scN + 1) * 12);
    stsc.set(sStsc.payload.subarray(0, 8 + scN * 12), 0);
    wr32(stsc, 4, scN + 1);
    wr32(stsc, 8 + scN * 12, chunkCount + 1);
    wr32(stsc, 12 + scN * 12, extra);
    wr32(stsc, 16 + scN * 12, 1);
    kid(nStbl, 'stsc').payload = stsc;

    // stco: one extra offset, filled in later once the layout is known
    var w = co64 ? 8 : 4;
    var stco = new Uint8Array(8 + (chunkCount + 1) * w);
    stco.set(sStco.payload.subarray(0, 8 + chunkCount * w), 0);
    wr32(stco, 4, chunkCount + 1);
    var newStcoNode = kid(nStbl, co64 ? 'co64' : 'stco');
    newStcoNode.payload = stco;

    // mdhd.duration grows by `extra` ticks
    var nMdhd = kid(kid(nt, 'mdia'), 'mdhd');
    if (nMdhd) {
      if (nMdhd.payload[0] === 1) wr64(nMdhd.payload, 24, rd64(nMdhd.payload, 24) + extra);
      else wr32(nMdhd.payload, 16, rd32(nMdhd.payload, 16) + extra);
    }

    log.push('audio track #' + newId + ' built: ' + sampleCount + ' real samples + ' +
             extra + ' dummy = ' + (sampleCount + extra) + ' (x' + SAMPLE_MULTIPLIER + ')');
    log.push('dummy block of ' + (extra * DUMMY_SAMPLE_BYTES) + ' bytes will follow mdat');

    // insert right after the last trak
    var lastTrakIdx = -1;
    for (i = 0; i < moov.children.length; i++) if (moov.children[i].type === 'trak') lastTrakIdx = i;
    moov.children.splice(lastTrakIdx + 1, 0, nt);

    // mvhd.nextTrackID
    var mvhd = kid(moov, 'mvhd');
    if (mvhd) {
      wr32(mvhd.payload, mvhd.payload.length - 4, newId + 1);
      log.push('mvhd.nextTrackID -> ' + (newId + 1));
    }

    // 4. new layout: ftyp | moov | mdat | dummy
    var ftypSize = layout.ftyp ? (layout.ftyp.end - layout.ftyp.start) : 0;
    var moovSize = nodeSize(moov);                 // independent of offset values
    var newMdatStart = ftypSize + moovSize;
    var mdatSize = layout.mdat.end - layout.mdat.start;
    var dummyStart = newMdatStart + mdatSize;
    var delta = newMdatStart - layout.mdat.start;

    // 5. shift every chunk offset, then fill in the dummy offset
    var allTraks = kids(moov, 'trak');
    for (i = 0; i < allTraks.length; i++) {
      var st = stblOf(allTraks[i]); if (!st) continue;
      var co = kid(st, 'stco'), big = false;
      if (!co) { co = kid(st, 'co64'); big = true; }
      if (!co) continue;
      var n = rd32(co.payload, 4);
      for (var j = 0; j < n; j++) {
        var o = 8 + j * (big ? 8 : 4);
        if (big) wr64(co.payload, o, rd64(co.payload, o) + delta);
        else wr32(co.payload, o, rd32(co.payload, o) + delta);
      }
    }
    // the dummy chunk offset on the new track (last entry)
    var lastOff = 8 + chunkCount * w;
    if (co64) wr64(newStcoNode.payload, lastOff, dummyStart);
    else wr32(newStcoNode.payload, lastOff, dummyStart);

    log.push('moov moved to the front (faststart); chunk offsets shifted by ' + delta + ' bytes');

    // 6. dummy block
    var dummy = new Uint8Array(extra * DUMMY_SAMPLE_BYTES);
    for (i = 0; i < dummy.length; i++) dummy[i] = DUMMY_PATTERN[i % DUMMY_PATTERN.length];

    return {
      moovBytes: serialize(moov),
      dummyBytes: dummy,
      newMdatStart: newMdatStart,
      dummyStart: dummyStart,
      addedSamples: extra,
      newTrackId: newId,
      log: log,
    };
  }

  /* Read the top-level box layout (ftyp / moov / mdat) without loading the
     file. Only a 16-byte header per box is read, so a 4 GB file is instant. */
  async function loadLayout(file) {
    var pos = 0, size = file.size, layout = { fileSize: size };
    while (pos + 8 <= size) {
      var head = new Uint8Array(await file.slice(pos, Math.min(pos + 16, size)).arrayBuffer());
      if (head.length < 8) break;
      var sz = rd32(head, 0);
      var t = type4(head, 4);
      if (sz === 1) {
        if (head.length < 16) break;
        sz = rd64(head, 8);
      } else if (sz === 0) {
        sz = size - pos;
      }
      if (sz < 8) break;
      if (t === 'ftyp' || t === 'moov' || t === 'mdat') layout[t] = { start: pos, end: pos + sz };
      pos += sz;
    }
    if (!layout.moov) throw new Error('No moov box found — this is not a valid MP4/MOV file.');
    if (!layout.mdat) throw new Error('No mdat box found. Fragmented files (fMP4) are not supported yet.');
    if (!layout.ftyp) throw new Error('No ftyp box found.');
    return layout;
  }

  /** Assemble the result as a Blob without loading the video into memory. */
  function buildBlob(file, layout, res) {
    return new Blob([
      file.slice(layout.ftyp.start, layout.ftyp.end),
      res.moovBytes,
      file.slice(layout.mdat.start, layout.mdat.end),
      res.dummyBytes,
    ], { type: 'video/mp4' });
  }

  return {
    build: build,
    loadLayout: loadLayout,
    buildBlob: buildBlob,
    parseBoxes: parseBoxes,
    serialize: serialize,
    _const: {
      DUMMY_PATTERN: DUMMY_PATTERN,
      DUMMY_SAMPLE_BYTES: DUMMY_SAMPLE_BYTES,
      SAMPLE_MULTIPLIER: SAMPLE_MULTIPLIER,
    },
  };
});
