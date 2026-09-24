import * as THREE from 'three';

/**
 * Adds a hard-edged "painted" highlight to a toon material: the pixel-art glint on a glossy bead.
 * The glint is placed in object space (so un-rotated pieces all show it at the same upper-left spot,
 * whatever the camera does) and `strength.value` can be animated (0 = off, e.g. in scan mode).
 */
export function glossy<T extends THREE.MeshToonMaterial>(mat: T, strength: { value: number }, threshold = 0.93, dir = new THREE.Vector3(-0.42, 0.55, 0.72), tint = new THREE.Color('#ffffff')): T {
  dir = dir.clone().normalize();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGloss = strength;
    shader.uniforms.uGlossDir = { value: dir };
    shader.uniforms.uGlossTint = { value: tint };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlossN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvGlossN = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGloss;\nuniform vec3 uGlossDir;\nuniform vec3 uGlossTint;\nvarying vec3 vGlossN;')
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += uGlossTint * (uGloss * step(${threshold.toFixed(3)}, dot(normalize(vGlossN), uGlossDir)));\n#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'boba-gloss-' + threshold.toFixed(3) + dir.toArray().map((v) => v.toFixed(2)).join(',');
  return mat;
}
