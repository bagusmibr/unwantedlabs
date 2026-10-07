"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFxLevel } from "./useFxLevel";
import styles from "./fx.module.css";

/**
 * Bola partikel monokrom (Three.js, satu draw call).
 *  - permukaannya "bernapas" dengan noise 3D di GPU
 *  - kamera condong mengikuti mouse
 *  - saat halaman digulir, partikel pecah menyebar dan memudar
 *
 * Hemat daya: berhenti merender saat tidak terlihat atau tab disembunyikan,
 * jumlah partikel & DPR diturunkan di level "lite", tidak dirender sama
 * sekali di level "off". Semua sumber daya GPU dibuang saat unmount.
 */

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
uniform float uScroll;
uniform float uSize;
uniform float uPixelRatio;
uniform float uIntensity;
attribute float aRand;
varying float vAlpha;
${NOISE}
void main(){
  vec3 dir = normalize(position);
  float n = snoise(dir * 1.6 + vec3(uTime * 0.12));
  float n2 = snoise(dir * 4.0 - vec3(uTime * 0.2));
  // napas permukaan
  vec3 p = position + dir * (n * 0.28 + n2 * 0.06);
  // pecah saat scroll: tiap partikel terbang sejauh acak
  p += dir * uScroll * (1.5 + aRand * 4.5);
  p.y += uScroll * aRand * 1.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.55 + aRand * 0.9) * (1.0 + n * 0.35);
  gl_PointSize = size * uPixelRatio * (1.0 / -mv.z);
  // sisi belakang bola lebih redup → kesan kedalaman
  float depth = smoothstep(-6.5, -2.2, mv.z);
  vAlpha = uIntensity * mix(0.1, 1.0, depth) * (0.55 + 0.45 * (n * 0.5 + 0.5)) * (1.0 - uScroll * 0.85);
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  // smoothstep dengan edge0 > edge1 hasilnya undefined di GLSL (di beberapa
  // GPU selalu 0) — jadi dibalik secara eksplisit.
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  a *= a;
  gl_FragColor = vec4(vec3(1.0), a * vAlpha);
}`;

function fibonacciSphere(count: number, radius: number) {
  const pos = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    // sedikit acak supaya tidak tampak seperti pola mesin
    const jitter = radius * (0.96 + Math.random() * 0.08);
    pos[i * 3] = Math.cos(th) * r * jitter;
    pos[i * 3 + 1] = y * jitter;
    pos[i * 3 + 2] = Math.sin(th) * r * jitter;
    rand[i] = Math.random();
  }
  return { pos, rand };
}

export default function ParticleField({
  className = "",
  variant = "hero",
}: {
  className?: string;
  /** hero = besar di tengah; ambient = lebih kecil, lebih pelan, di pojok */
  variant?: "hero" | "ambient";
}) {
  const level = useFxLevel();
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (level === "off") return;
    const el = mount.current;
    if (!el) return;

    const full = level === "full";
    const ambient = variant === "ambient";
    const count = ambient ? (full ? 6000 : 2500) : (full ? 16000 : 6000);
    const dpr = Math.min(window.devicePixelRatio || 1, full ? 1.75 : 1.25);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // WebGL tidak tersedia — biarkan latar CSS saja.
    }
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const baseZ = ambient ? 5.6 : 5.3;
    camera.position.set(0, 0, baseZ);

    const { pos, rand } = fibonacciSphere(count, ambient ? 1.35 : 1.55);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSize: { value: ambient ? 18 : 20 },
      uPixelRatio: { value: dpr },
      // Hero di belakang teks: cukup redup supaya teks tetap terbaca.
      uIntensity: { value: ambient ? 0.6 : 0.85 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // di layar sempit, mundurkan kamera supaya bola tidak terpotong
      camera.position.z = baseZ * (w / h < 0.8 ? 1.45 : 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // mouse → target rotasi; diikuti dengan inersia di loop
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    if (full) addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    const clock = new THREE.Clock();
    let raf = 0;
    let scrollT = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      uniforms.uTime.value += dt * (ambient ? 0.6 : 1);
      if (!ambient) {
        const target = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
        scrollT += (target - scrollT) * 0.08;
        uniforms.uScroll.value = scrollT;
      }
      cx += (tx - cx) * 0.04;
      cy += (ty - cy) * 0.04;
      points.rotation.y += dt * (ambient ? 0.04 : 0.07);
      points.rotation.x = cy * 0.25;
      points.rotation.z = -cx * 0.12;
      camera.position.x = cx * 0.35;
      camera.position.y = -cy * 0.25;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    loop();
    el.dataset.ready = "1";

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete el.dataset.ready;
    };
  }, [level, variant]);

  return <div ref={mount} className={`${styles.particles} ${className}`} aria-hidden="true" />;
}
