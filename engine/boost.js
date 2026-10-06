/* UNWANTED LABS — DUAL_AUDIO patch (refined layout)
   Made by Bagus (Shifted) MIBR

   Reconstructed from a byte-for-byte comparison between a raw file and the
   same file after a third-party service processed it — a service whose output
   demonstrably plays at 120 fps on TikTok. What is replicated is the
   MECHANISM, not their code.

   ── Reference file dissected ───────────────────────────────────────────────
   raw : ftyp | free | mdat | moov          moov v0, mvhd.duration = real
   out : ftyp | moov | free | mdat          moov v1, mvhd.duration = unknown

   Every difference below was measured on the pair, not guessed:

   1. `mdat` sample bytes copied through    -> zero re-encode, bit-identical
   2. `moov` moved to the front             -> faststart, 8-byte `free` after it
   3. `mvhd` upgraded to version 1 and its
      duration written as 0xFFFF…FF         -> movie duration declared UNKNOWN
   4. All creation/modification times zeroed (mvhd, tkhd, mdhd)
   5. Video media timescale multiplied so it lands on 15360
      (120 -> 15360, x128); stts deltas, ctts offsets, mdhd.duration and
      elst.media_time scaled by the same factor -> same fps, canonical units
   6. `edts`/`elst` KEPT on every track (the earlier patch deleted them)
   7. A second audio track added: copy of the audio sample table, its own
      `elst`, a distinct alternate_group, + 9x dummy samples of 1 tick
   8. The audio payload is physically DUPLICATED at the tail of `mdat`, and
      the dummy block lives INSIDE `mdat` (the earlier patch appended it
      after `mdat`, which left a malformed top-level box)
   9. Samples re-interleaved 1:1 per audio frame, the video pointer running
      `max(ctts offset)` frames ahead of the audio clock
  10. Original `udta`/`meta` replaced by a single iTunes-style `©too` tag

   No video timing field is scaled unevenly anywhere — video keeps exactly its
   original frame rate — so by construction this cannot produce slow motion.

   ── Being honest about it ──────────────────────────────────────────────────
   WHAT changes is fully mapped and can be replicated exactly.
   WHY it works is a hypothesis: an unknown movie duration plus this unusual
   track structure most likely keeps TikTok's ingest off its aggressive
   frame-rate normalisation path. That is server behaviour, and it can change
   at any time without notice.

   Known cosmetic deltas vs the reference (harmless, both files are valid):
   - their muxer stretched the LAST audio sample by a few ticks; we don't.
   - their chunk boundary lands one frame later at ~2 of 2564 chunks, where
     the audio clock falls within 0.002 of a frame boundary.
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
  var SAMPLE_MULTIPLIER = 10;      // new track sample count = 10x the original
  var VIDEO_TIMESCALE_TARGET = 15360;
  var TOOL_TAG = 'UNWANTED LABS DUAL_AUDIO';
  var U32_MAX = 4294967295;

  // ── byte helpers ───────────────────────────────────────────────────────────
  function type4(b, o) {
    return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  }
  function rd16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function wr16(b, o, v) { b[o] = (v >>> 8) & 255; b[o + 1] = v & 255; }
  function rd32(b, o) {
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  }
  function rd32s(b, o) {
    return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
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
  function fill(b, o, n, v) { for (var i = 0; i < n; i++) b[o + i] = v; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  function concat(list) {
    var n = 0, i;
    for (i = 0; i < list.length; i++) n += list[i].length;
    var out = new Uint8Array(n), p = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], p); p += list[i].length; }
    return out;
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
    out[pos + 4] = n.type.charCodeAt(0) & 255; out[pos + 5] = n.type.charCodeAt(1) & 255;
    out[pos + 6] = n.type.charCodeAt(2) & 255; out[pos + 7] = n.type.charCodeAt(3) & 255;
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

  function box(type, payload) { return { type: type, payload: payload }; }

  function kid(node, type) {
    if (!node || !node.children) return null;
    for (var i = 0; i < node.children.length; i++) {
      if (node.children[i].type === type) return node.children[i];
    }
    return null;
  }
  function kids(node, type) {
    var r = [];
    if (!node || !node.children) return r;
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

  // ── full-box field layouts ─────────────────────────────────────────────────
  /* mvhd / mdhd share the same head shape: version, times, timescale, duration */
  function headLayout(p) {
    if (p[0] === 1) {
      return { v: 1, create: 4, timeW: 8, modify: 12, ts: 20, dur: 24, durW: 8, rest: 32 };
    }
    return { v: 0, create: 4, timeW: 4, modify: 8, ts: 12, dur: 16, durW: 4, rest: 20 };
  }
  /* tkhd puts trackID between the times and the duration */
  function tkhdLayout(p) {
    if (p[0] === 1) {
      return { v: 1, create: 4, timeW: 8, modify: 12, id: 20, dur: 28, durW: 8, layer: 36, altGroup: 38, volume: 40 };
    }
    return { v: 0, create: 4, timeW: 4, modify: 8, id: 12, dur: 20, durW: 4, layer: 32, altGroup: 34, volume: 36 };
  }
  function readDur(p, lay) { return lay.durW === 8 ? rd64(p, lay.dur) : rd32(p, lay.dur); }
  function writeDur(p, lay, v) { if (lay.durW === 8) wr64(p, lay.dur, v); else wr32(p, lay.dur, v); }
  function zeroTimes(p, lay) {
    fill(p, lay.create, lay.timeW, 0);
    fill(p, lay.modify, lay.timeW, 0);
  }

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
    return rd32(tkhd.payload, tkhdLayout(tkhd.payload).id);
  }
  function setTrackId(trak, id) {
    var tkhd = kid(trak, 'tkhd');
    if (tkhd) wr32(tkhd.payload, tkhdLayout(tkhd.payload).id, id);
  }
  function chunkTableOf(stbl) {
    var n = kid(stbl, 'stco');
    if (n) return { node: n, big: false };
    n = kid(stbl, 'co64');
    if (n) return { node: n, big: true };
    return null;
  }

  // ── reading one track's sample tables ──────────────────────────────────────
  /* Everything is snapshotted into typed arrays here, BEFORE the moov is
     mutated, so later edits can't invalidate the interleave plan. */
  function readTrack(trak, index) {
    var stbl = stblOf(trak);
    if (!stbl) throw new Error('Track ' + (index + 1) + ' has no sample table (stbl).');

    var stsz = kid(stbl, 'stsz'), stsc = kid(stbl, 'stsc'), stts = kid(stbl, 'stts');
    var chunk = chunkTableOf(stbl);
    if (!stsz || !stsc || !stts || !chunk) {
      throw new Error('Track ' + (index + 1) + ' has an incomplete sample table.');
    }

    var mdhd = kid(kid(trak, 'mdia'), 'mdhd');
    var mLay = mdhd ? headLayout(mdhd.payload) : null;

    var fixed = rd32(stsz.payload, 4);
    var count = rd32(stsz.payload, 8);
    if (!count) throw new Error('Track ' + (index + 1) + ' has no samples.');

    var i, j;
    var sizes = new Float64Array(count);
    if (fixed) { for (i = 0; i < count; i++) sizes[i] = fixed; }
    else { for (i = 0; i < count; i++) sizes[i] = rd32(stsz.payload, 12 + i * 4); }

    var nChunks = rd32(chunk.node.payload, 4);
    var chunkOff = new Float64Array(nChunks);
    for (i = 0; i < nChunks; i++) {
      chunkOff[i] = chunk.big ? rd64(chunk.node.payload, 8 + i * 8)
                              : rd32(chunk.node.payload, 8 + i * 4);
    }

    /* expand stsc into per-chunk sample count + description index */
    var spc = new Float64Array(nChunks);
    var desc = new Float64Array(nChunks);
    var nSc = rd32(stsc.payload, 4);
    for (i = 0; i < nSc; i++) {
      var first = rd32(stsc.payload, 8 + i * 12);
      var per = rd32(stsc.payload, 12 + i * 12);
      var dIdx = rd32(stsc.payload, 16 + i * 12);
      var next = (i + 1 < nSc) ? rd32(stsc.payload, 8 + (i + 1) * 12) : nChunks + 1;
      for (j = first; j < next && j <= nChunks; j++) { spc[j - 1] = per; desc[j - 1] = dIdx; }
    }

    /* per-sample source offset + description index */
    var sOff = new Float64Array(count);
    var sDesc = new Float64Array(count);
    var s = 0;
    for (i = 0; i < nChunks && s < count; i++) {
      var o = chunkOff[i];
      for (j = 0; j < spc[i] && s < count; j++) {
        sOff[s] = o; sDesc[s] = desc[i]; o += sizes[s]; s++;
      }
    }
    if (s !== count) {
      throw new Error('Track ' + (index + 1) + ': stsc/stco describe ' + s +
                      ' samples but stsz declares ' + count + '.');
    }

    /* decode time-to-sample */
    var dts = new Float64Array(count);
    var nTt = rd32(stts.payload, 4);
    var t = 0; s = 0;
    for (i = 0; i < nTt; i++) {
      var c = rd32(stts.payload, 8 + i * 8);
      var d = rd32(stts.payload, 12 + i * 8);
      for (j = 0; j < c && s < count; j++) { dts[s++] = t; t += d; }
    }
    while (s < count) dts[s++] = t;

    /* reorder depth = largest composition offset, in media ticks */
    var ctts = kid(stbl, 'ctts');
    var lead = 0;
    if (ctts) {
      var nCt = rd32(ctts.payload, 4);
      for (i = 0; i < nCt; i++) {
        var off = ctts.payload[0] === 1 ? rd32s(ctts.payload, 12 + i * 8)
                                        : rd32(ctts.payload, 12 + i * 8);
        if (off > lead) lead = off;
      }
    }

    return {
      trak: trak, stbl: stbl, index: index,
      handler: handlerOf(trak),
      timescale: mLay ? rd32(mdhd.payload, mLay.ts) : 0,
      mdhd: mdhd, mdhdLay: mLay,
      count: count, sizes: sizes, sampleOffsets: sOff, sampleDesc: sDesc,
      chunkCount: nChunks, chunkOffsets: chunkOff, spc: spc, desc: desc,
      dts: dts, lead: lead, big: chunk.big,
      totalBytes: (function () { var n = 0; for (var k = 0; k < count; k++) n += sizes[k]; return n; })(),
      newChunkOffsets: [], newSpc: [], newDesc: []
    };
  }

  // ── table writers ──────────────────────────────────────────────────────────
  function writeStsc(spc, desc) {
    var entries = [], i;
    for (i = 0; i < spc.length; i++) {
      var last = entries.length ? entries[entries.length - 1] : null;
      if (!last || last.n !== spc[i] || last.d !== desc[i]) {
        entries.push({ first: i + 1, n: spc[i], d: desc[i] });
      }
    }
    var p = new Uint8Array(8 + entries.length * 12);
    wr32(p, 4, entries.length);
    for (i = 0; i < entries.length; i++) {
      wr32(p, 8 + i * 12, entries[i].first);
      wr32(p, 12 + i * 12, entries[i].n);
      wr32(p, 16 + i * 12, entries[i].d || 1);
    }
    return p;
  }
  function writeStco(offsets, base, big) {
    var w = big ? 8 : 4;
    var p = new Uint8Array(8 + offsets.length * w);
    wr32(p, 4, offsets.length);
    for (var i = 0; i < offsets.length; i++) {
      if (big) wr64(p, 8 + i * 8, base + offsets[i]);
      else wr32(p, 8 + i * 4, base + offsets[i]);
    }
    return p;
  }
  /* Replace a track's chunk table, switching stco <-> co64 when needed. */
  function applyChunkTable(track, base, big) {
    var ct = chunkTableOf(track.stbl);
    ct.node.type = big ? 'co64' : 'stco';
    ct.node.payload = writeStco(track.newChunkOffsets, base, big);
    kid(track.stbl, 'stsc').payload = writeStsc(track.newSpc, track.newDesc);
  }

  // ── video timescale rescale ────────────────────────────────────────────────
  /* Multiplies the media timebase by an integer factor. Frame rate is
     unchanged because every duration in that timebase is scaled too. */
  function rescaleMedia(track, factor, log) {
    if (factor < 2) return 0;
    var mdhd = track.mdhd, lay = track.mdhdLay;
    if (!mdhd || !lay) return 0;

    var stts = kid(track.stbl, 'stts');
    var ctts = kid(track.stbl, 'ctts');
    var i, n;

    /* refuse the rescale rather than overflow a 32-bit field */
    var newTs = track.timescale * factor;
    var newDur = readDur(mdhd.payload, lay) * factor;
    if (newTs > U32_MAX || (lay.durW === 4 && newDur > U32_MAX)) return 0;
    n = rd32(stts.payload, 4);
    for (i = 0; i < n; i++) {
      if (rd32(stts.payload, 12 + i * 8) * factor > U32_MAX) return 0;
    }

    wr32(mdhd.payload, lay.ts, newTs);
    writeDur(mdhd.payload, lay, newDur);
    for (i = 0; i < n; i++) {
      wr32(stts.payload, 12 + i * 8, rd32(stts.payload, 12 + i * 8) * factor);
    }
    if (ctts) {
      n = rd32(ctts.payload, 4);
      for (i = 0; i < n; i++) {
        var o = ctts.payload[0] === 1 ? rd32s(ctts.payload, 12 + i * 8)
                                      : rd32(ctts.payload, 12 + i * 8);
        wr32(ctts.payload, 12 + i * 8, o * factor);
      }
    }
    /* elst.media_time is in media ticks; segment_duration is not */
    scaleElstMediaTime(track.trak, factor);

    log.push(track.handler + ' timescale ' + track.timescale + ' -> ' + newTs +
             ' (x' + factor + '); frame rate unchanged');
    track.timescale = newTs;
    return factor;
  }

  /* elst geometry: entry stride and the field offsets inside one entry */
  function elstGeom(p) {
    return p[0] === 1
      ? { stride: 20, seg: 0, segW: 8, media: 8, mediaW: 8 }
      : { stride: 12, seg: 0, segW: 4, media: 4, mediaW: 4 };
  }
  /* media_time of -1 marks an empty edit (a pure delay) — never a real time */
  function isEmptyEdit(p, o, w) {
    for (var i = 0; i < w; i++) if (p[o + i] !== 0xff) return false;
    return true;
  }

  function scaleElstMediaTime(trak, factor) {
    var edts = kid(trak, 'edts'); if (!edts) return;
    var elst = kid(edts, 'elst'); if (!elst) return;
    var p = elst.payload, n = rd32(p, 4), g = elstGeom(p), i;
    for (i = 0; i < n; i++) {
      var o = 8 + i * g.stride + g.media;
      if (isEmptyEdit(p, o, g.mediaW)) continue;
      if (g.mediaW === 8) wr64(p, o, rd64(p, o) * factor);
      else wr32(p, o, rd32s(p, o) * factor);
    }
  }

  /* Retime a cloned track's edit list for its new, longer media duration.
     Empty edits are left alone — their segment_duration is an A/V delay, not
     a span of media, so stretching one would desync the track. */
  function retimeElst(trak, mediaDuration, mediaTimescale, movieTimescale) {
    var edts = kid(trak, 'edts'); if (!edts) return;
    var elst = kid(edts, 'elst'); if (!elst) return;
    var p = elst.payload, n = rd32(p, 4), g = elstGeom(p), i;
    for (i = 0; i < n; i++) {
      var base = 8 + i * g.stride;
      if (isEmptyEdit(p, base + g.media, g.mediaW)) continue;
      var mediaTime = g.mediaW === 8 ? rd64(p, base + g.media) : rd32s(p, base + g.media);
      if (mediaTime < 0) mediaTime = 0;
      var seg = Math.ceil((mediaDuration - mediaTime) * movieTimescale / mediaTimescale);
      if (seg < 0) seg = 0;
      if (g.segW === 8) wr64(p, base + g.seg, seg); else wr32(p, base + g.seg, seg);
      return;                       // only the first real edit covers the tail
    }
  }

  // ── mvhd: version 1 with an unknown duration ──────────────────────────────
  function mvhdToV1(p) {
    if (p[0] === 1) return p;
    var out = new Uint8Array(p.length + 12);
    out[0] = 1; out[1] = p[1]; out[2] = p[2]; out[3] = p[3];
    /* creation (8) and modification (8) stay zero */
    wr32(out, 20, rd32(p, 12));          // timescale
    wr64(out, 24, rd32(p, 16));          // duration (widened, overwritten below)
    out.set(p.subarray(20), 32);         // rate .. nextTrackID
    return out;
  }

  // ── iTunes-style tool tag (replaces the source metadata) ──────────────────
  function buildTagUdta(tool) {
    var text = utf8(tool);
    var dataPayload = new Uint8Array(8 + text.length);
    wr32(dataPayload, 0, 1);             // well-known type 1 = UTF-8
    dataPayload.set(text, 8);
    var ilst = { type: 'ilst', children: [
      { type: '©too', children: [box('data', dataPayload)] }
    ] };
    /* version/flags(4) pre_defined(4) handler_type(4) reserved(12) name(1) */
    var hdlrPayload = new Uint8Array(25);
    hdlrPayload[8] = 0x6d; hdlrPayload[9] = 0x64;
    hdlrPayload[10] = 0x69; hdlrPayload[11] = 0x72;   // 'mdir'
    var metaBytes = concat([
      new Uint8Array(4),
      serialize(box('hdlr', hdlrPayload)),
      serialize(ilst)
    ]);
    return { type: 'udta', children: [box('meta', metaBytes)] };
  }

  // ── sample interleave plan ────────────────────────────────────────────────
  /* Reproduces the reference layout: one chunk per audio sample, with the
     video pointer running `lead` media ticks ahead of the audio clock.
     Returns null when the track mix isn't exactly one video + one audio, in
     which case the caller keeps the source interleave. */
  function planInterleave(video, audio) {
    var runs = [];
    var iv = 0, ia;
    for (ia = 0; ia < audio.count; ia++) {
      runs.push({ track: audio, first: ia, count: 1 });
      /* audio clock converted to video ticks, truncated, plus the reorder lead */
      var limit = Math.floor(audio.dts[ia] * video.timescale / audio.timescale) + video.lead;
      var n = 0;
      while (iv < video.count && video.dts[iv] < limit) { iv++; n++; }
      if (n) runs.push({ track: video, first: iv - n, count: n });
    }
    if (iv < video.count) runs.push({ track: video, first: iv, count: video.count - iv });
    return runs;
  }

  // ── main patch ─────────────────────────────────────────────────────────────
  /**
   * layout : { ftyp:{start,end}, moov:{start,end}, mdat:{start,end,hs}, fileSize }
   * moovBuf: Uint8Array holding the whole moov box (layout.moov.start..end)
   * return : { moovBytes, freeBytes, mdatHeaderBytes, ranges, dummyBytes, ... , log }
   */
  function build(layout, moovBuf) {
    var log = [];
    var tree = parseBoxes(moovBuf, 0, moovBuf.length);
    var moov = null, i, j;
    for (i = 0; i < tree.length; i++) if (tree[i].type === 'moov') moov = tree[i];
    if (!moov) throw new Error('The moov box could not be read.');

    var traks = kids(moov, 'trak');
    if (!traks.length) throw new Error('No tracks inside moov.');

    var mvhd = kid(moov, 'mvhd');
    if (!mvhd) throw new Error('The mvhd box could not be read.');
    var movieTimescale = rd32(mvhd.payload, headLayout(mvhd.payload).ts) || 1000;

    // 1. snapshot every track's sample tables
    var tracks = [];
    for (i = 0; i < traks.length; i++) tracks.push(readTrack(traks[i], i));

    var audio = null, video = null, audioCount = 0, videoCount = 0;
    for (i = 0; i < tracks.length; i++) {
      if (tracks[i].handler === 'soun') { audioCount++; if (!audio) audio = tracks[i]; }
      if (tracks[i].handler === 'vide') { videoCount++; if (!video) video = tracks[i]; }
    }
    if (!audio) {
      throw new Error('No audio track. This method needs audio as the source for the second track.');
    }

    var sampleCount = audio.count;
    var extra = sampleCount * (SAMPLE_MULTIPLIER - 1);
    var dummyBytesLen = extra * DUMMY_SAMPLE_BYTES;

    // 2. mdat geometry — original payload is rewritten sample by sample
    var origHs = layout.mdat.hs || 8;
    var origPayloadStart = layout.mdat.start + origHs;
    var origPayloadLen = (layout.mdat.end - layout.mdat.start) - origHs;
    var carried = 0;
    for (i = 0; i < tracks.length; i++) carried += tracks[i].totalBytes;

    var canInterleave = (videoCount === 1 && audioCount === 1 && tracks.length === 2 &&
                         carried === origPayloadLen);
    var payloadLen = (canInterleave ? carried : origPayloadLen) + audio.totalBytes + dummyBytesLen;

    /* 64-bit offsets once the file can't be addressed in 32 bits. The bound is
       deliberately generous — an unnecessary co64 is still valid. */
    var moovBound = moovBuf.length * 3 + 1048576;
    var big = (payloadLen + moovBound + 64) > U32_MAX;

    var mdatHs = (payloadLen + 8) > U32_MAX ? 16 : 8;
    var mdatSize = payloadLen + mdatHs;

    // 3. lay the new mdat out, collecting source byte ranges in output order
    var ranges = [];
    function pushRange(start, len) {
      if (!len) return;
      var last = ranges.length ? ranges[ranges.length - 1] : null;
      if (last && last.end === start) last.end = start + len;
      else ranges.push({ start: start, end: start + len });
    }

    var pos = 0;
    if (canInterleave) {
      var runs = planInterleave(video, audio);
      for (i = 0; i < runs.length; i++) {
        var r = runs[i], tk = r.track;
        tk.newChunkOffsets.push(pos);
        tk.newSpc.push(r.count);
        tk.newDesc.push(tk.sampleDesc[r.first]);
        for (j = 0; j < r.count; j++) {
          var s = r.first + j;
          pushRange(tk.sampleOffsets[s], tk.sizes[s]);
          pos += tk.sizes[s];
        }
      }
      for (i = 0; i < tracks.length; i++) {
        var seen = 0;
        for (j = 0; j < tracks[i].newSpc.length; j++) seen += tracks[i].newSpc[j];
        if (seen !== tracks[i].count) {
          throw new Error('Interleave lost samples on track ' + (i + 1) +
                          ' (' + seen + ' of ' + tracks[i].count + ').');
        }
      }
      log.push('re-interleaved 1:1 per audio frame — ' +
               audio.newChunkOffsets.length + ' audio + ' +
               video.newChunkOffsets.length + ' video chunks, ' +
               'video leading by ' + video.lead + ' media tick(s)');
    } else {
      /* keep the source interleave: copy the payload as one range and only
         shift the chunk offsets */
      pushRange(origPayloadStart, origPayloadLen);
      pos = origPayloadLen;
      for (i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        for (j = 0; j < t.chunkCount; j++) t.newChunkOffsets.push(t.chunkOffsets[j] - origPayloadStart);
        for (j = 0; j < t.chunkCount; j++) { t.newSpc.push(t.spc[j]); t.newDesc.push(t.desc[j]); }
      }
      log.push('source interleave kept (' +
               (tracks.length !== 2 ? tracks.length + ' tracks' :
                carried !== origPayloadLen ? 'mdat holds ' + (origPayloadLen - carried) + ' uncovered byte(s)' :
                videoCount + ' video / ' + audioCount + ' audio') + ')');
    }

    // 4. duplicated audio payload, then the dummy block — both inside mdat
    var dupChunkOffsets = [], dupSpc = [], dupDesc = [];
    var dupRelStart = pos;
    for (i = 0; i < sampleCount; i++) {
      dupChunkOffsets.push(pos);
      dupSpc.push(1);
      dupDesc.push(audio.sampleDesc[i]);
      pushRange(audio.sampleOffsets[i], audio.sizes[i]);
      pos += audio.sizes[i];
    }
    /* the dummies join the final chunk, directly behind the last real sample */
    dupSpc[dupSpc.length - 1] += extra;
    var dummyRelStart = pos;
    pos += dummyBytesLen;
    if (pos !== payloadLen) {
      throw new Error('mdat layout mismatch: planned ' + payloadLen + ', produced ' + pos + '.');
    }

    // 5. video timebase -> canonical units
    var factor = 0;
    if (video && video.timescale && video.timescale < VIDEO_TIMESCALE_TARGET) {
      factor = rescaleMedia(video, Math.floor(VIDEO_TIMESCALE_TARGET / video.timescale), log);
    }

    // 6. build the second audio track
    var maxId = 0;
    for (i = 0; i < tracks.length; i++) maxId = Math.max(maxId, trackId(tracks[i].trak));
    var newId = maxId + 1;

    var nt = cloneNode(audio.trak);
    setTrackId(nt, newId);
    var nStbl = stblOf(nt);
    var srcStbl = audio.stbl;

    /* stts: one extra entry — `extra` samples of 1 tick */
    var sStts = kid(srcStbl, 'stts');
    var oldN = rd32(sStts.payload, 4);
    var stts = new Uint8Array(8 + (oldN + 1) * 8);
    stts.set(sStts.payload.subarray(0, 8 + oldN * 8), 0);
    wr32(stts, 4, oldN + 1);
    wr32(stts, 8 + oldN * 8, extra);
    wr32(stts, 12 + oldN * 8, 1);
    kid(nStbl, 'stts').payload = stts;

    /* stsz: `extra` more entries of 8 bytes each */
    var sStsz = kid(srcStbl, 'stsz');
    var stsz = new Uint8Array(12 + (sampleCount + extra) * 4);
    wr32(stsz, 0, rd32(sStsz.payload, 0));
    wr32(stsz, 4, 0);
    wr32(stsz, 8, sampleCount + extra);
    for (i = 0; i < sampleCount; i++) wr32(stsz, 12 + i * 4, audio.sizes[i]);
    for (i = 0; i < extra; i++) wr32(stsz, 12 + (sampleCount + i) * 4, DUMMY_SAMPLE_BYTES);
    kid(nStbl, 'stsz').payload = stsz;

    /* mdhd.duration grows by `extra` ticks */
    var nMdhd = kid(kid(nt, 'mdia'), 'mdhd');
    var newMediaDuration = 0;
    if (nMdhd) {
      var nLay = headLayout(nMdhd.payload);
      newMediaDuration = readDur(nMdhd.payload, nLay) + extra;
      writeDur(nMdhd.payload, nLay, newMediaDuration);
    }

    /* tkhd: own duration, and an alternate_group of its own so players treat
       it as an additional track rather than a swap-in for the first one */
    var nTkhd = kid(nt, 'tkhd');
    if (nTkhd) {
      var tLay = tkhdLayout(nTkhd.payload);
      if (newMediaDuration && audio.timescale) {
        writeDur(nTkhd.payload, tLay,
                 Math.ceil(newMediaDuration * movieTimescale / audio.timescale));
      }
      wr16(nTkhd.payload, tLay.altGroup, (rd16(nTkhd.payload, tLay.altGroup) + 1) & 0xffff);
    }

    /* its edit list, retimed for the longer media */
    if (newMediaDuration && audio.timescale) {
      retimeElst(nt, newMediaDuration, audio.timescale, movieTimescale);
    }

    log.push('audio track #' + newId + ' built: ' + sampleCount + ' real samples + ' +
             extra + ' dummy = ' + (sampleCount + extra) + ' (x' + SAMPLE_MULTIPLIER + ')');
    log.push('audio payload duplicated (' + audio.totalBytes + ' bytes) + ' +
             dummyBytesLen + ' bytes of dummy samples, both inside mdat');

    /* insert right after the last trak */
    var lastTrakIdx = -1;
    for (i = 0; i < moov.children.length; i++) if (moov.children[i].type === 'trak') lastTrakIdx = i;
    moov.children.splice(lastTrakIdx + 1, 0, nt);

    // 7. mvhd -> version 1, duration unknown, nextTrackID bumped
    mvhd.payload = mvhdToV1(mvhd.payload);
    var mvLay = headLayout(mvhd.payload);
    zeroTimes(mvhd.payload, mvLay);
    fill(mvhd.payload, mvLay.dur, 8, 0xff);
    wr32(mvhd.payload, mvhd.payload.length - 4, newId + 1);
    log.push('mvhd -> version 1, duration declared unknown, nextTrackID ' + (newId + 1));

    // 8. zero every creation/modification stamp
    var allTraks = kids(moov, 'trak');
    for (i = 0; i < allTraks.length; i++) {
      var tk2 = kid(allTraks[i], 'tkhd');
      if (tk2) zeroTimes(tk2.payload, tkhdLayout(tk2.payload));
      var md2 = kid(kid(allTraks[i], 'mdia'), 'mdhd');
      if (md2) zeroTimes(md2.payload, headLayout(md2.payload));
    }

    // 9. replace the source metadata with one tool tag
    dropChild(moov, 'udta');
    dropChild(moov, 'meta');
    moov.children.push(buildTagUdta(TOOL_TAG));

    // 10. tables get their final shape now, with placeholder offsets, so the
    //     moov size settles before the real offsets are known
    for (i = 0; i < tracks.length; i++) applyChunkTable(tracks[i], 0, big);
    var ntTrack = { stbl: nStbl, newChunkOffsets: dupChunkOffsets, newSpc: dupSpc, newDesc: dupDesc };
    applyChunkTable(ntTrack, 0, big);

    // 11. new file layout: ftyp | moov | free | mdat
    var freeBytes = new Uint8Array(8);
    wr32(freeBytes, 0, 8);
    freeBytes[4] = 0x66; freeBytes[5] = 0x72; freeBytes[6] = 0x65; freeBytes[7] = 0x65; // 'free'

    var ftypSize = layout.ftyp ? (layout.ftyp.end - layout.ftyp.start) : 0;
    var moovSize = nodeSize(moov);
    var newMdatStart = ftypSize + moovSize + freeBytes.length;
    var payloadStart = newMdatStart + mdatHs;

    // 12. same tables, real offsets
    for (i = 0; i < tracks.length; i++) applyChunkTable(tracks[i], payloadStart, big);
    applyChunkTable(ntTrack, payloadStart, big);
    if (nodeSize(moov) !== moovSize) {
      throw new Error('moov size shifted while writing chunk offsets.');
    }

    var mdatHeaderBytes = new Uint8Array(mdatHs);
    if (mdatHs === 16) {
      wr32(mdatHeaderBytes, 0, 1);
      wr64(mdatHeaderBytes, 8, mdatSize);
    } else {
      wr32(mdatHeaderBytes, 0, mdatSize);
    }
    mdatHeaderBytes[4] = 0x6d; mdatHeaderBytes[5] = 0x64;
    mdatHeaderBytes[6] = 0x61; mdatHeaderBytes[7] = 0x74;                        // 'mdat'

    log.push('moov moved to the front (faststart) + 8-byte free box; mdat now ' +
             mdatSize + ' bytes' + (big ? ', 64-bit chunk offsets' : ''));

    // 13. dummy block
    var dummy = new Uint8Array(dummyBytesLen);
    for (i = 0; i < dummy.length; i++) dummy[i] = DUMMY_PATTERN[i % DUMMY_PATTERN.length];

    return {
      moovBytes: serialize(moov),
      freeBytes: freeBytes,
      mdatHeaderBytes: mdatHeaderBytes,
      ranges: ranges,
      dummyBytes: dummy,
      newMdatStart: newMdatStart,
      mdatSize: mdatSize,
      dupStart: payloadStart + dupRelStart,
      dummyStart: payloadStart + dummyRelStart,
      addedSamples: extra,
      newTrackId: newId,
      videoTimescale: video ? video.timescale : 0,
      videoTimescaleFactor: factor,
      reinterleaved: canInterleave,
      log: log
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
      var hs = 8;
      if (sz === 1) {
        if (head.length < 16) break;
        sz = rd64(head, 8);
        hs = 16;
      } else if (sz === 0) {
        sz = size - pos;
      }
      if (sz < hs) break;
      if (t === 'ftyp' || t === 'moov' || t === 'mdat') {
        layout[t] = { start: pos, end: pos + sz, hs: hs };
      }
      pos += sz;
    }
    if (!layout.moov) throw new Error('No moov box found — this is not a valid MP4/MOV file.');
    if (!layout.mdat) throw new Error('No mdat box found. Fragmented files (fMP4) are not supported yet.');
    if (!layout.ftyp) throw new Error('No ftyp box found.');
    return layout;
  }

  /** Assemble the result as a Blob without loading the video into memory. */
  function buildBlob(file, layout, res) {
    var parts = [
      file.slice(layout.ftyp.start, layout.ftyp.end),
      res.moovBytes,
      res.freeBytes,
      res.mdatHeaderBytes,
    ];
    for (var i = 0; i < res.ranges.length; i++) {
      parts.push(file.slice(res.ranges[i].start, res.ranges[i].end));
    }
    parts.push(res.dummyBytes);
    return new Blob(parts, { type: 'video/mp4' });
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
      VIDEO_TIMESCALE_TARGET: VIDEO_TIMESCALE_TARGET,
      TOOL_TAG: TOOL_TAG,
    },
  };
});
