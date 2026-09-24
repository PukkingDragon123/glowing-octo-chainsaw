import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';

/** Shared, animated hologram uniforms (one set per showcase). */
export interface HoloUniforms {
  uTime: { value: number };
  /** World-space height of the bright sweep band. */
  uSweep: { value: number };
  /** Global brightness (flicker). */
  uGain: { value: number };
}

export function holoUniforms(): HoloUniforms {
  return { uTime: { value: 0 }, uSweep: { value: -100 }, uGain: { value: 1 } };
}

/**
 * Additive, unlit neon material with pixel-row scanlines that crawl upward, a bright sweep band in
 * world space and a global flicker gain. Works on plain and instanced meshes.
 */
export function holoMaterial(u: HoloUniforms, params: THREE.MeshBasicMaterialParameters = {}, opts: { scan?: number; sweep?: number } = {}): THREE.MeshBasicMaterial {
  const scan = opts.scan ?? 0.45;
  const sweep = opts.sweep ?? 0.8;
  const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...params });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uSweep = u.uSweep;
    shader.uniforms.uGain = u.uGain;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHoloY;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 holoW = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        holoW = instanceMatrix * holoW;
      #endif
      vHoloY = ( modelMatrix * holoW ).y;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSweep;\nuniform float uGain;\nvarying float vHoloY;')
      .replace(
        '#include <opaque_fragment>',
        `float holoRow = mod( floor( gl_FragCoord.y ) - floor( uTime * 10.0 ), 3.0 );
        float holoScan = holoRow < 1.0 ? ${(1 - scan).toFixed(3)} : 1.0;
        float holoSweep = ( 1.0 - smoothstep( 0.0, 0.13, abs( vHoloY - uSweep ) ) ) * ${sweep.toFixed(3)};
        outgoingLight = ( outgoingLight * holoScan + vec3( holoSweep ) ) * uGain;
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `volt-holo-${scan}-${sweep}`;
  return mat;
}

/** Mark a mesh as glow: skipped by the outline pass. */
export function glowLayer<T extends THREE.Object3D>(o: T): T {
  o.layers.set(LAYER_NO_OUTLINE);
  return o;
}
