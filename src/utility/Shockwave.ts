import {
  Color3,
  Engine,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Scene,
  Vector3,
  Quaternion,
} from "@babylonjs/core";

export type ImpactShockwaveOptions = {
  /** 0..1 intensity, typically scaled from impact speed */
  strength: number;
  /** Lifetime in seconds */
  durationSeconds?: number;
  /** Ring color */
  color?: Color3;
  /** Small offset to avoid z-fighting */
  normalOffset?: number;
  /**
   * Starting radius (world units). This is the visible size at spawn.
   * Bigger values = more "oomph" immediately.
   */
  startRadius?: number;
  /**
   * Base end radius (world units) at strength = 0.
   * This is added to `endRadiusStrengthAdd * strength`.
   */
  endRadiusBase?: number;
  /** Additional end radius (world units) when strength = 1 */
  endRadiusStrengthAdd?: number;
  /**
   * Base alpha multiplier at strength = 0 (before fade curve).
   * Useful to make the ring more/less visible overall.
   */
  alphaBase?: number;
  /** Additional alpha multiplier when strength = 1 (before fade curve) */
  alphaStrengthAdd?: number;
  /**
   * Fade curve exponent. Higher = stays visible longer then drops faster.
   * (Applied as `alpha *= (1 - easedT)^fadePower`)
   */
  fadePower?: number;
};

function _safeUpForNormal(normal: Vector3) {
  const up = Vector3.Up();
  if (Math.abs(Vector3.Dot(normal, up)) > 0.98) {
    return Vector3.Right();
  }
  return up;
}

function _createRingTexture(scene: Scene) {
  const size = 256;
  const dt = new DynamicTexture("shockwaveRingTex", { width: size, height: size }, scene, true);
  dt.hasAlpha = true;

  const ctx = dt.getContext();
  // Clear
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Soft ring: inner fade -> bright band -> outer fade
  const rOuter = size * 0.44;
  const rBand = size * 0.40;
  const rInner = size * 0.34;

  const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
  grad.addColorStop(0.0, "rgba(255,255,255,0.00)");
  grad.addColorStop((rBand - rInner) / (rOuter - rInner), "rgba(255,255,255,0.65)");
  grad.addColorStop((rBand - rInner) / (rOuter - rInner) + 0.06, "rgba(255,255,255,0.15)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.00)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  dt.update();
  return dt;
}

/**
 * Spawns a 2D shockwave ring aligned to `normal` and animated (scale + fade).
 * Intended to be cheap: a single disc mesh + dynamic texture reused per spawn.
 */
export function spawnImpactShockwave(
  scene: Scene,
  point: Vector3,
  normal: Vector3,
  options: ImpactShockwaveOptions
) {
  const strength = Math.max(0, Math.min(1, options.strength));
  const durationSeconds = options.durationSeconds ?? 0.26;
  const color = options.color ?? new Color3(1, 0.85, 0.55);
  const normalOffset = options.normalOffset ?? 0.03;

  // Size tuning (world units). Defaults are intentionally "big".
  const startRadius = options.startRadius ?? 1.2;
  const endRadiusBase = options.endRadiusBase ?? 4.5;
  const endRadiusStrengthAdd = options.endRadiusStrengthAdd ?? 7.5;

  // Visibility tuning
  const alphaBase = options.alphaBase ?? 0.55;
  const alphaStrengthAdd = options.alphaStrengthAdd ?? 0.55;
  const fadePower = options.fadePower ?? 1.6;

  const dir = normal.lengthSquared() > 1e-6 ? normal.normalizeToNew() : Vector3.Up();

  const ring = MeshBuilder.CreateDisc(
    "impactShockwave",
    { radius: 1, tessellation: 64 },
    scene
  );

  ring.isPickable = false;
  ring.position.copyFrom(point.add(dir.scale(normalOffset)));
  ring.rotationQuaternion = Quaternion.FromLookDirectionLH(dir, _safeUpForNormal(dir));

  // Material
  const mat = new StandardMaterial("impactShockwaveMat", scene);
  const tex = _createRingTexture(scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = color;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.useAlphaFromDiffuseTexture = true;
  mat.alphaMode = Engine.ALPHA_ADD;
  mat.alpha = 0.95;
  ring.material = mat;

  // Animation
  const start = performance.now();
  const minScale = Math.max(1e-3, startRadius);
  const maxScale = Math.max(minScale, endRadiusBase + endRadiusStrengthAdd * strength);
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  const obs = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const t = (now - start) / (durationSeconds * 1000);
    if (t >= 1) {
      scene.onBeforeRenderObservable.remove(obs);
      ring.dispose(false, true);
      tex.dispose();
      mat.dispose();
      return;
    }

    const e = easeOut(t);
    const s = minScale + (maxScale - minScale) * e;
    ring.scaling.set(s, s, s);

    // Fade quickly near the end, stronger impacts start brighter
    const fade = 1 - e;
    mat.alpha = (alphaBase + alphaStrengthAdd * strength) * Math.pow(fade, fadePower);
  });

  return ring;
}

