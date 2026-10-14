"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFxLevel } from "@/components/fx/useFxLevel";
import styles from "./MorphField.module.css";

/**
 * Latar 3D landing: satu awan partikel yang BERUBAH BENTUK mengikuti section
 * yang sedang dilihat. Bentuk dipilih lewat atribut data-morph="<indeks>" pada
 * section (lihat app/page.tsx):
 *
 *   0  bola bernapas      — hero
 *   1  gulungan film      — showcase FPS
 *   2  gelombang timeline — alur kerja, fitur, cara mulai
 *   3  terowongan cepat   — harga, FAQ
 *   4  langit bintang     — penutup / wordmark
 *
 * Semua bentuk disimpan sebagai atribut posisi terpisah di SATU geometri, dan
 * shader mencampur dua bentuk yang berdekatan (satu draw call). Tiap partikel
 * berpindah dengan jeda acak sendiri, jadi transisinya terasa organik.
 *
 * Kanvas menempel di belakang seluruh halaman (z-index -1) dan sangat redup di
 * section yang banyak teks. Berhenti merender saat tab disembunyikan; tidak
 * dirender sama sekali di level "off".
 */

const SHAPES = 5;
// Kecerahan per bentuk: terang di hero & penutup, redup di section penuh teks.
const INTENSITY = [0.75, 0.55, 0.42, 0.32, 0.85];

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uSize;
uniform float uPixelRatio;
uniform float uIntensity;
uniform float uAngle;
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute vec3 aP4;
attribute float aRand;
varying float vAlpha;
${NOISE}

vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }

// Posisi bentuk ke-i, lengkap dengan geraknya sendiri.
vec3 shape(float i){
  if (i < 0.5) {                       // bola bernapas
    vec3 d = normalize(position);
    float n = snoise(d * 1.6 + vec3(uTime * 0.12));
    return rotY(position + d * n * 0.26, uAngle);
  }
  if (i < 1.5) return rotY(aP1, uAngle * 1.6);         // gulungan film berputar
  if (i < 2.5) {                       // gelombang timeline
    vec3 p = aP2;
    p.y += sin(p.x * 1.3 + uTime * 1.1) * 0.22 + sin(p.z * 2.1 - uTime * 0.8) * 0.12;
    return p;
  }
  if (i < 3.5) {                       // terowongan: partikel mengalir ke kamera
    vec3 p = aP3;
    p.z = mod(p.z + uTime * 1.4 + 9.0, 12.0) - 9.0;
    return p;
  }
  return rotY(aP4, uAngle * 0.35);     // langit bintang
}

void main(){
  float i0 = floor(uMorph);
  float f = uMorph - i0;
  // Jeda acak per partikel → perpindahan bentuk yang organik
  float k = smoothstep(0.0, 1.0, clamp(f * 1.6 - aRand * 0.6, 0.0, 1.0));
  vec3 a = shape(i0);
  vec3 b = shape(min(i0 + 1.0, ${SHAPES - 1}.0));
  vec3 p = mix(a, b, k);
  // sedikit pusaran di tengah transisi
  float swirl = sin(k * 3.14159) * (0.25 + aRand * 0.5);
  p += normalize(vec3(-p.z, 0.3, p.x) + 1e-4) * swirl;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.55 + aRand * 0.9) * uPixelRatio * (1.0 / -mv.z);
  // minimal ~2.5px: titik lebih kecil "melompat" per piksel saat bergerak
  // pelan. Titik yang diperbesar diredupkan sebanding supaya total cahayanya
  // tetap sama (tidak membuat awan jadi silau).
  float minS = 2.5 * uPixelRatio;
  gl_PointSize = max(sz, minS);
  float comp = min(1.0, (sz * sz) / (minS * minS));
  float depth = smoothstep(-11.0, -2.0, mv.z);
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 50.0);
  vAlpha = uIntensity * mix(0.12, 1.0, depth) * (0.5 + 0.5 * aRand) * twinkle * comp;
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vec3(1.0), a * a * vAlpha);
}`;

function buildShapes(n: number) {
  const P = Array.from({ length: SHAPES }, () => new Float32Array(n * 3));
  const rand = new Float32Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tilt = 1.15, ct = Math.cos(tilt), st = Math.sin(tilt);
  const gridW = Math.ceil(Math.sqrt(n * 2));
  for (let i = 0; i < n; i++) {
    rand[i] = Math.random();
    const o = i * 3;

    // 0 — bola (fibonacci)
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    const j = 1.55 * (0.96 + Math.random() * 0.08);
    P[0][o] = Math.cos(th) * r * j; P[0][o + 1] = y * j; P[0][o + 2] = Math.sin(th) * r * j;

    // 1 — gulungan film: cincin luar + lubang sprocket + jari-jari, dimiringkan
    let x1 = 0, y1 = 0, z1 = 0;
    const u = Math.random() * Math.PI * 2, kind = Math.random();
    if (kind < 0.62) {          // pita cincin
      const R = 1.75 + (Math.random() - 0.5) * 0.18;
      x1 = Math.cos(u) * R; z1 = Math.sin(u) * R; y1 = (Math.random() - 0.5) * 0.12;
    } else if (kind < 0.8) {    // lingkar dalam
      const R = 0.45 + Math.random() * 0.06;
      x1 = Math.cos(u) * R; z1 = Math.sin(u) * R; y1 = (Math.random() - 0.5) * 0.08;
    } else {                    // 6 jari-jari
      const spoke = Math.floor(Math.random() * 6) * (Math.PI / 3);
      const R = 0.5 + Math.random() * 1.2;
      x1 = Math.cos(spoke) * R; z1 = Math.sin(spoke) * R; y1 = (Math.random() - 0.5) * 0.06;
    }
    P[1][o] = x1; P[1][o + 1] = y1 * ct - z1 * st; P[1][o + 2] = y1 * st + z1 * ct;

    // 2 — bidang gelombang (seperti timeline/waveform dilihat miring)
    const gx = i % gridW, gz = Math.floor(i / gridW);
    P[2][o] = (gx / gridW - 0.5) * 11 + (Math.random() - 0.5) * 0.05;
    P[2][o + 1] = -1.25;
    P[2][o + 2] = (gz / (n / gridW)) * -9 + 2.2;

    // 3 — terowongan
    const a3 = Math.random() * Math.PI * 2, R3 = 2.3 + (Math.random() - 0.5) * 0.35;
    P[3][o] = Math.cos(a3) * R3; P[3][o + 1] = Math.sin(a3) * R3; P[3][o + 2] = Math.random() * 12 - 9;

    // 4 — langit bintang (cangkang tebal)
    const v = Math.random() * 2 - 1, w = Math.random() * Math.PI * 2, rr = 3 + Math.pow(Math.random(), 0.6) * 5;
    const s4 = Math.sqrt(1 - v * v);
    P[4][o] = Math.cos(w) * s4 * rr; P[4][o + 1] = v * rr * 0.7; P[4][o + 2] = Math.sin(w) * s4 * rr - 2;
  }
  return { P, rand };
}

export default function MorphField() {
  const level = useFxLevel();
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (level === "off") return;
    const el = mount.current;
    if (!el) return;
    const full = level === "full";
    const count = full ? 16000 : 6000;
    const dpr = Math.min(window.devicePixelRatio || 1, full ? 1.5 : 1.25);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // tanpa WebGL: latar CSS saja
    }
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const baseZ = 5.3;
    camera.position.set(0, 0, baseZ);

    const { P, rand } = buildShapes(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(P[0], 3));
    for (let k = 1; k < SHAPES; k++) geo.setAttribute(`aP${k}`, new THREE.BufferAttribute(P[k], 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    const uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uSize: { value: 20 },
      uPixelRatio: { value: dpr },
      uIntensity: { value: INTENSITY[0] },
      uAngle: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = baseZ * (w / h < 0.8 ? 1.45 : 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    if (full) addEventListener("pointermove", onMove, { passive: true });

    // Section penentu bentuk. Didaftar ulang sesekali (section demo bisa
    // muncul belakangan setelah data admin termuat).
    let sections: HTMLElement[] = [];
    const collect = () => { sections = Array.from(document.querySelectorAll<HTMLElement>("[data-morph]")); };
    collect();
    const recollect = setInterval(collect, 2500);

    // Target bentuk = bentuk section yang melewati 55% tinggi layar, dicampur
    // halus selama 60% tinggi layar pertama section itu masuk.
    const morphTarget = () => {
      const c = innerHeight * 0.55;
      let t = sections.length ? Number(sections[0].dataset.morph) : 0;
      for (const s of sections) {
        const top = s.getBoundingClientRect().top;
        if (top >= c) break;
        const k = Number(s.dataset.morph);
        const f = Math.min(1, (c - top) / (innerHeight * 0.6));
        t = t + (k - t) * f;
      }
      return t;
    };

    let raf = 0, morph = morphTarget(), prev = performance.now();
    uniforms.uMorph.value = morph;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (document.hidden) return;
      uniforms.uTime.value += dt;
      uniforms.uAngle.value += dt * 0.08;
      // dihaluskan berbasis waktu → sama halusnya di 60 Hz maupun 120 Hz
      morph += (morphTarget() - morph) * (1 - Math.exp(-dt * 3.2));
      uniforms.uMorph.value = morph;
      const i0 = Math.floor(morph), f = morph - i0;
      uniforms.uIntensity.value = INTENSITY[i0] + (INTENSITY[Math.min(SHAPES - 1, i0 + 1)] - INTENSITY[i0]) * f;
      const ease = 1 - Math.exp(-dt * 2.4);
      cx += (tx - cx) * ease; cy += (ty - cy) * ease;
      camera.position.x = cx * 0.35;
      camera.position.y = -cy * 0.25;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    loop();
    el.dataset.ready = "1";

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(recollect);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete el.dataset.ready;
    };
  }, [level]);

  return <div ref={mount} className={styles.field} aria-hidden="true" />;
}
