import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/UnrealBloomPass.js';

const canvas = document.querySelector('#webgl');

// ==============================
// 🎨 SCENE & CAMERA SETUP
// ==============================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 40);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5;

// ——— BLOOM ———
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1,   // Strength
    0.1,   // Radius
    0.15   // Threshold
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Lights
const light = new THREE.PointLight(0xffffff, 0);
light.position.set(5, 5, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

// ==============================
// 🎮 ORBIT PHYSICS — QUATERNION
// ==============================

// ── Tweak these ────────────────────────────────────────────────────────────────
const SLERP_FACTOR = 0.05;  // 0–1. Lower = floatier. Higher = snappier.
const SPEED_SCALE = 2.5;   // Orbit speed multiplier.
const MAX_ANGLE_PER_FRAME = 0.04;  // Hard cap on rotation per frame (radians).
const DEAD_ZONE = 0.04;  // Min cursor NDC distance from centre before orbit starts.
// ───────────────────────────────────────────────────────────────────────────────

const mouse = new THREE.Vector2(0, 0);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ── Quaternion state ──────────────────────────────────────────────────────────
const orbitQuat = new THREE.Quaternion();
const targetDeltaQuat = new THREE.Quaternion();
const slerpedQuat = new THREE.Quaternion();
const cameraOffset = camera.position.clone(); // (0, 0, 40)

const rawAxis = new THREE.Vector3();
const normalizedAxis = new THREE.Vector3();

// ==============================
// 🎬 LOAD GLTF + EMISSIVE BOOST
// ==============================
const loader = new GLTFLoader();
loader.load(
    'animation.glb',
    (gltf) => {
        const model = gltf.scene;
        model.scale.set(30 , 30 ,30 );
        model.traverse((child) => {
            if (child.isMesh && child.material.emissive) {
                child.material.emissiveIntensity = 1;
            }
        });
        scene.add(model);
    },
    undefined,
    (err) => console.error('GLB load error:', err)
);

// ==============================
// 🔍 SCROLL-TO-ZOOM
// ==============================

// ── Tweak these ────────────────────────────────────────────────────────────────
const ZOOM_MIN = 20;   // closest  (scroll = page bottom)
const ZOOM_MAX = 40;   // furthest (scroll = page top)
const PAGE_HEIGHT_VH = 500;  // total page height in vh units
// ───────────────────────────────────────────────────────────────────────────────

document.body.style.height = `${PAGE_HEIGHT_VH}vh`;

window.addEventListener('scroll', () => {
    // maxScroll is the exact number of pixels the user CAN scroll —
    // always precise, no ScrollTrigger rounding or lag
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const progress = Math.min(window.scrollY / maxScroll, 1.0); // 0 at top, 1 at bottom
    const targetDist = ZOOM_MAX - progress * (ZOOM_MAX - ZOOM_MIN);
    cameraOffset.setLength(targetDist);
});

// ==============================
// ⏱️ ANIMATION LOOP
// ==============================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    const dist = mouse.length();
    if (dist > DEAD_ZONE) {
        rawAxis.set(0, mouse.x, 0);
        normalizedAxis.copy(rawAxis).normalize();

        const angle = Math.min(dist * SPEED_SCALE * delta, MAX_ANGLE_PER_FRAME);
        targetDeltaQuat.setFromAxisAngle(normalizedAxis, angle);

        slerpedQuat.identity().slerp(targetDeltaQuat, SLERP_FACTOR);
        orbitQuat.premultiply(slerpedQuat);
        orbitQuat.normalize();
    }

    camera.position.copy(cameraOffset).applyQuaternion(orbitQuat);
    camera.lookAt(0, 0, 0);

    composer.render();
}

animate();

// ==============================
// 📐 WINDOW RESIZE
// ==============================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
