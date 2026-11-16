import { loadGLB } from './gltf-node.mjs';
import * as THREE from 'three';
const v = (o)=>o.getWorldPosition(new THREE.Vector3());
for (const id of process.argv.slice(2)) {
  const g = await loadGLB(`assets/anims/cmu/${id}.glb`);
  const clip = g.animations[0]; const mixer = new THREE.AnimationMixer(g.scene); mixer.clipAction(clip).play();
  const N = g.scene; const get = n=>N.getObjectByName(n);
  let out=[];
  for (let t=0; t<clip.duration; t+=0.15) {
    mixer.setTime(t); N.updateMatrixWorld(true);
    const hip=v(get('hip')), lf=v(get('lFoot')), rf=v(get('rFoot')), lh=v(get('lHand')), rh=v(get('rHand')), ch=v(get('chest'));
    const floor=Math.min(lf.y,rf.y);
    const kick = Math.max(lf.y,rf.y)-floor; // foot raise
    const reach = Math.max(new THREE.Vector2(lh.x-ch.x,lh.z-ch.z).length(), new THREE.Vector2(rh.x-ch.x,rh.z-ch.z).length());
    out.push(`${t.toFixed(1)}:${(kick|0)}/${(reach|0)}/${(hip.y-floor|0)}`);
  }
  console.log(id, clip.duration.toFixed(1)+'s'); console.log(out.join(' '));
}
