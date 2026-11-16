import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLIPS } from './anims';

export interface Assets {
  clips: Map<string, THREE.AnimationClip>;
  env: Map<string, THREE.Object3D>;
  tex: Map<string, THREE.Texture>;
  sfx: Map<string, AudioBuffer>;
}

export const ENV_MODELS = ['tree_oak', 'tree_pineRoundA', 'tree_default', 'tree_fat', 'fence_simple', 'rock_largeA', 'rock_largeC',
  'rock_tallA', 'rock_smallA', 'plant_bushLarge', 'plant_bush', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'grass_large',
  'mushroom_redGroup', 'stone_largeA'];
const SFX = ['impactPunch_medium_000', 'impactPunch_medium_001', 'impactPunch_heavy_000', 'impactPunch_heavy_001', 'impactSoft_medium_000',
  'impactPlate_light_000', 'impactWood_heavy_000', 'impactSoft_heavy_000', 'click_002', 'confirmation_001', 'select_001', 'back_001', 'bong_001'];
const TEX = ['spark_05', 'star_06', 'circle_05', 'magic_03', 'smoke_04', 'slash_03', 'light_01', 'twirl_02'];

export async function loadAssets(onProgress: (p: number) => void, audio?: AudioContext): Promise<Assets> {
  const loader = new GLTFLoader();
  const total = ENV_MODELS.length + TEX.length + SFX.length; let done = 0;
  const tick = () => onProgress(++done / total);
  const clips = CLIPS;
  const env = new Map<string, THREE.Object3D>();
  await Promise.all(ENV_MODELS.map((m) => loader.loadAsync(`env/${m}.glb`).then((g) => { g.scene.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); env.set(m, g.scene); tick(); })));
  const tex = new Map<string, THREE.Texture>();
  const tl = new THREE.TextureLoader();
  await Promise.all(TEX.map((t) => tl.loadAsync(`vfx/${t}.png`).then((x) => { x.colorSpace = THREE.SRGBColorSpace; tex.set(t, x); tick(); })));
  const sfx = new Map<string, AudioBuffer>();
  await Promise.all(SFX.map(async (s) => {
    try { if (audio) { const b = await (await fetch(`sfx/${s}.ogg`)).arrayBuffer(); sfx.set(s, await audio.decodeAudioData(b)); } } catch { /* audio optional */ }
    tick();
  }));
  return { clips, env, tex, sfx };
}
