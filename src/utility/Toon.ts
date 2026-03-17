import {
  AbstractMesh,
  Color3,
  DirectionalLight,
  Effect,
  Scene,
  ShaderMaterial,
  Vector3,
} from "@babylonjs/core";

export type ToonMaterialOptions = {
  /** If provided, uses this directional light's direction for shading */
  lightName?: string;

  baseColor?: Color3;
  shadeColor?: Color3;

  /** Number of bands (2..6) */
  steps?: number;
  /** How sharp the band transitions are (bigger = sharper) */
  hardness?: number;

  /** Rim light strength (0..1) */
  rimStrength?: number;
  /** Rim exponent (bigger = thinner rim) */
  rimPower?: number;
  /** Rim color */
  rimColor?: Color3;
};

const VERTEX = `
precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;

// Uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Varyings
varying vec3 vNormalW;
varying vec3 vPosW;

void main(void) {
  vec4 worldPos = world * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(mat3(world) * normal);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

varying vec3 vNormalW;
varying vec3 vPosW;

uniform vec3 cameraPosition;
uniform vec3 lightDirW;   // direction *from surface to light* (normalized)

uniform vec3 baseColor;
uniform vec3 shadeColor;
uniform vec3 rimColor;

uniform float steps;
uniform float hardness;
uniform float rimStrength;
uniform float rimPower;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

void main(void) {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(lightDirW);
  float ndl = saturate(dot(N, L));

  // Quantize into bands with controllable edge hardness.
  float s = max(2.0, steps);
  float q = floor(ndl * s) / (s - 1.0);
  // Sharpen edges
  float t = pow(q, hardness);

  vec3 col = mix(shadeColor, baseColor, t);

  // Rim (Fresnel-ish)
  vec3 V = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - saturate(dot(N, V)), max(0.01, rimPower));
  col += rimColor * rim * rimStrength;

  gl_FragColor = vec4(col, 1.0);
}
`;

function _getLightDir(scene: Scene, lightName?: string) {
  if (lightName) {
    const l = scene.getLightByName(lightName);
    if (l && (l as any).direction) {
      const dl = l as DirectionalLight;
      // DirectionalLight.direction points from light toward scene.
      // We want direction from surface TO light, so negate.
      return dl.direction.normalizeToNew().scale(-1);
    }
  }
  // Fallback: a gentle "top-left" light
  return new Vector3(0.5, 1, 0.3).normalize();
}

export function createToonMaterial(
  scene: Scene,
  name: string,
  options: ToonMaterialOptions = {}
) {
  // Register shader code
  Effect.ShadersStore[`${name}VertexShader`] = VERTEX;
  Effect.ShadersStore[`${name}FragmentShader`] = FRAGMENT;

  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: name, fragment: name },
    {
      attributes: ["position", "normal"],
      uniforms: [
        "world",
        "worldViewProjection",
        "cameraPosition",
        "lightDirW",
        "baseColor",
        "shadeColor",
        "rimColor",
        "steps",
        "hardness",
        "rimStrength",
        "rimPower",
      ],
    }
  );

  const baseColor = options.baseColor ?? new Color3(0.92, 0.78, 0.70);
  const shadeColor = options.shadeColor ?? new Color3(0.18, 0.10, 0.22);
  const rimColor = options.rimColor ?? new Color3(0.85, 0.6, 1.0);

  mat.setColor3("baseColor", baseColor);
  mat.setColor3("shadeColor", shadeColor);
  mat.setColor3("rimColor", rimColor);
  mat.setFloat("steps", options.steps ?? 3);
  mat.setFloat("hardness", options.hardness ?? 1.35);
  mat.setFloat("rimStrength", options.rimStrength ?? 0.18);
  mat.setFloat("rimPower", options.rimPower ?? 2.2);

  // Update light dir each frame (in case you tweak light direction live)
  const obs = scene.onBeforeRenderObservable.add(() => {
    mat.setVector3("lightDirW", _getLightDir(scene, options.lightName));
  });

  // Dispose hook
  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(obs);
  });

  return mat;
}

export type ApplyToonOptions = ToonMaterialOptions & {
  /**
   * If provided, meshes for which this returns false will be skipped.
   * Useful to avoid overwriting VFX materials.
   */
  filter?: (mesh: AbstractMesh) => boolean;
};

/**
 * Convenience: create one toon material and apply it to many meshes.
 */
export function applyToonMaterialToMeshes(
  scene: Scene,
  name: string,
  meshes: AbstractMesh[],
  options: ApplyToonOptions = {}
) {
  const { filter, ...matOptions } = options;
  const mat = createToonMaterial(scene, name, matOptions);

  for (const m of meshes) {
    if (!m) continue;
    if (filter && !filter(m)) continue;
    m.material = mat;
  }

  return mat;
}

