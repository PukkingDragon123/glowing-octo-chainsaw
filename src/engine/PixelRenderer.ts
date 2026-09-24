import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Objects on this layer render in color but are skipped by the outline (normal) pass: glass, particles, glow. */
export const LAYER_NO_OUTLINE = 1;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec4 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float isOrtho;
uniform float depthEdge;
uniform float normalEdge;
uniform float depthThreshold;
uniform float levels;
uniform float saturation;
uniform float vignette;
uniform float transition;
uniform float blockSize;
uniform vec3 transitionColor;
uniform float mosaic;
uniform float seed;
varying vec2 vUv;

float linDepth(float d) {
  if (isOrtho > 0.5) return mix(cameraNear, cameraFar, d);
  return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear));
}
float getDepth(vec2 uv) { return linDepth(texture2D(tDepth, uv).r); }
vec3 getNormal(vec2 uv) { return texture2D(tNormal, uv).rgb * 2.0 - 1.0; }

float neighborNormalEdge(vec2 uv, float depth, vec3 normal) {
  float depthDiff = getDepth(uv) - depth;
  vec3 nn = getNormal(uv);
  float normalDiff = dot(normal - nn, vec3(1.0, 1.0, 1.0));
  float normalIndicator = clamp(smoothstep(-0.01, 0.01, normalDiff), 0.0, 1.0);
  float depthIndicator = step(-0.02 * depth, depthDiff);
  return (1.0 - dot(normal, nn)) * depthIndicator * normalIndicator;
}

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 4x4 Bayer matrix, row-major
  if (i < 1.0) return 0.0/16.0; if (i < 2.0) return 8.0/16.0; if (i < 3.0) return 2.0/16.0; if (i < 4.0) return 10.0/16.0;
  if (i < 5.0) return 12.0/16.0; if (i < 6.0) return 4.0/16.0; if (i < 7.0) return 14.0/16.0; if (i < 8.0) return 6.0/16.0;
  if (i < 9.0) return 3.0/16.0; if (i < 10.0) return 11.0/16.0; if (i < 11.0) return 1.0/16.0; if (i < 12.0) return 9.0/16.0;
  if (i < 13.0) return 15.0/16.0; if (i < 14.0) return 7.0/16.0; if (i < 15.0) return 13.0/16.0; return 5.0/16.0;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = resolution.zw;
  vec2 cellCoord = floor(vUv * resolution.xy);
  if (mosaic > 1.0) cellCoord = floor(cellCoord / mosaic) * mosaic + floor(mosaic * 0.5);
  vec2 uv = (cellCoord + 0.5) * px;

  vec4 texel = texture2D(tDiffuse, uv);
  float depth = getDepth(uv);
  vec3 normal = getNormal(uv);

  float strength = 1.0;
  if (depthEdge > 0.0 || normalEdge > 0.0) {
    float diff = 0.0;
    diff += max(getDepth(uv + vec2(px.x, 0.0)) - depth, 0.0);
    diff += max(getDepth(uv - vec2(px.x, 0.0)) - depth, 0.0);
    diff += max(getDepth(uv + vec2(0.0, px.y)) - depth, 0.0);
    diff += max(getDepth(uv - vec2(0.0, px.y)) - depth, 0.0);
    float facing = clamp(normal.z, 0.0, 1.0);
    float thr = depthThreshold * depth * (1.0 + 5.0 * (1.0 - facing));
    float dei = step(thr, diff);

    float nei = 0.0;
    nei += neighborNormalEdge(uv + vec2(0.0, -px.y), depth, normal);
    nei += neighborNormalEdge(uv + vec2(0.0, px.y), depth, normal);
    nei += neighborNormalEdge(uv + vec2(-px.x, 0.0), depth, normal);
    nei += neighborNormalEdge(uv + vec2(px.x, 0.0), depth, normal);
    nei = step(0.12, nei);

    strength = dei > 0.0 ? (1.0 - depthEdge) : (1.0 + normalEdge * nei);
  }

  vec3 col = toSRGB(texel.rgb * strength);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, saturation), 0.0, 1.0);

  if (levels > 1.0) {
    float d = bayer4(cellCoord) - 0.5;
    col = floor(col * (levels - 1.0) + 0.5 + d * 0.9) / (levels - 1.0);
  }

  if (vignette > 0.0) {
    vec2 q = vUv - 0.5;
    float v = smoothstep(0.35, 0.85, length(q * vec2(1.25, 1.0)));
    col *= 1.0 - vignette * v;
  }

  if (transition > 0.0) {
    vec2 block = floor(cellCoord / blockSize);
    float h = hash12(block + seed);
    // add a diagonal sweep so the dissolve reads as a wipe
    float sweep = (block.x * blockSize * px.x + (1.0 - block.y * blockSize * px.y)) * 0.5;
    float t = transition * 1.6 - 0.3;
    if (h * 0.6 + sweep * 0.4 < t) col = transitionColor;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface PixelLook {
  depthEdge: number;
  normalEdge: number;
  depthThreshold: number;
  levels: number;
  saturation: number;
  vignette: number;
}

export const DEFAULT_LOOK: PixelLook = {
  depthEdge: 0.55,
  normalEdge: 0.28,
  depthThreshold: 0.012,
  levels: 0,
  saturation: 1.08,
  vignette: 0.28,
};

/**
 * Renders a scene at a fraction of the screen resolution, draws crisp pixel outlines from depth and
 * normals, then upscales with nearest-neighbour sampling so every "pixel" is an exact square.
 */
export class PixelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  pixelSize = 3;
  /** Low-res buffer size. */
  width = 1;
  height = 1;
  private cssW = 1;
  private cssH = 1;
  private beauty: THREE.WebGLRenderTarget;
  private normals: THREE.WebGLRenderTarget;
  private normalMat: THREE.MeshNormalMaterial;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private targetLines = 320;
  private minPixel = 1;
  private maxPixel = 6;
  readonly look: PixelLook = { ...DEFAULT_LOOK };
  transition = 0;
  mosaic = 1;
  transitionColor = new THREE.Color('#141b2d');
  private tmpColor = new THREE.Color();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.canvas = this.renderer.domElement;
    this.canvas.classList.add('pixel-canvas');
    container.appendChild(this.canvas);

    const makeTarget = (withDepth: boolean) => {
      const t = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType,
        depthBuffer: true,
      });
      if (withDepth) t.depthTexture = new THREE.DepthTexture(1, 1);
      return t;
    };
    this.beauty = makeTarget(true);
    this.normals = makeTarget(false);
    this.normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        isOrtho: { value: 0 },
        depthEdge: { value: 0 },
        normalEdge: { value: 0 },
        depthThreshold: { value: 0.01 },
        levels: { value: 0 },
        saturation: { value: 1 },
        vignette: { value: 0 },
        transition: { value: 0 },
        blockSize: { value: 6 },
        transitionColor: { value: new THREE.Color() },
        mosaic: { value: 1 },
        seed: { value: 0 },
      },
    });
    this.quad = new FullScreenQuad(this.material);
  }

  /** Choose the pixel size so the low-res image has roughly `lines` rows. */
  setTargetLines(lines: number, min = 1, max = 6) {
    this.targetLines = lines;
    this.minPixel = min;
    this.maxPixel = max;
    this.resize(this.cssW, this.cssH);
  }

  resize(cssW: number, cssH: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    const ps = THREE.MathUtils.clamp(Math.round(this.cssH / this.targetLines), this.minPixel, this.maxPixel);
    this.pixelSize = ps;
    this.width = Math.ceil(this.cssW / ps);
    this.height = Math.ceil(this.cssH / ps);
    this.renderer.setSize(this.width * ps, this.height * ps, true);
    this.beauty.setSize(this.width, this.height);
    this.normals.setSize(this.width, this.height);
    this.material.uniforms.resolution.value.set(this.width, this.height, 1 / this.width, 1 / this.height);
    this.material.uniforms.blockSize.value = Math.max(2, Math.round(this.height / 36));
  }

  get aspect() {
    return this.width / this.height;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    const r = this.renderer;
    const u = this.material.uniforms;
    const look = this.look;

    camera.layers.enable(0);
    camera.layers.enable(LAYER_NO_OUTLINE);
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.beauty);
    r.render(scene, camera);

    const outlines = look.depthEdge > 0 || look.normalEdge > 0;
    if (outlines) {
      const oldOverride = scene.overrideMaterial;
      const oldBg = scene.background;
      const oldFog = scene.fog;
      r.getClearColor(this.tmpColor);
      const oldAlpha = r.getClearAlpha();
      scene.overrideMaterial = this.normalMat;
      scene.background = null;
      scene.fog = null;
      camera.layers.disable(LAYER_NO_OUTLINE);
      r.setRenderTarget(this.normals);
      r.setClearColor(0x000000, 0);
      r.render(scene, camera);
      camera.layers.enable(LAYER_NO_OUTLINE);
      r.setClearColor(this.tmpColor, oldAlpha);
      scene.overrideMaterial = oldOverride;
      scene.background = oldBg;
      scene.fog = oldFog;
    }

    u.tDiffuse.value = this.beauty.texture;
    u.tDepth.value = this.beauty.depthTexture;
    u.tNormal.value = this.normals.texture;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.isOrtho.value = (camera as THREE.OrthographicCamera).isOrthographicCamera ? 1 : 0;
    u.depthEdge.value = look.depthEdge;
    u.normalEdge.value = look.normalEdge;
    u.depthThreshold.value = look.depthThreshold;
    u.levels.value = look.levels;
    u.saturation.value = look.saturation;
    u.vignette.value = look.vignette;
    u.transition.value = this.transition;
    u.transitionColor.value.copy(this.transitionColor);
    u.mosaic.value = this.mosaic;

    r.setRenderTarget(null);
    this.quad.render(r);
  }

  /** Grab the current frame as a PNG data URL (used for screenshots / sharing). */
  snapshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  newTransitionSeed() {
    this.material.uniforms.seed.value = Math.random() * 1000;
  }
}
