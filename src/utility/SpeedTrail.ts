import {
  Color3,
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
  Engine,
  AbstractMesh,
  DynamicTexture,
  StandardMaterial,
  MeshBuilder,
  Quaternion,
} from "@babylonjs/core";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";

export type SpeedTrailOptions = {
  /** Set false to disable */
  enabled?: boolean;

  /** Enable/disable the particle accent layer */
  particlesEnabled?: boolean;
  /** Enable/disable the flat ribbon layer */
  ribbonEnabled?: boolean;

  /**
   * Speed at which the trail begins ramping in.
   * (Kept as `speedOn` for backwards compatibility with earlier config.)
   */
  speedOn: number;
  /**
   * Optional: speed at which the trail should be fully faded out.
   * If provided lower than `speedOn`, it creates a gentle fade band instead of abrupt toggles.
   */
  speedOff?: number;

  /** Speed at which trail reaches full intensity */
  speedForMax: number;

  /** Base emit rate at strength=0 (usually 0) */
  emitRateMin?: number;
  /** Emit rate at strength=1 */
  emitRateMax?: number;

  /** Particle size range (world units) */
  sizeMin?: number;
  sizeMax?: number;

  /** Lifetime range (seconds) */
  lifeMin?: number;
  lifeMax?: number;

  /** How far particles spray from the trail axis */
  spread?: number;

  /** How fast particles shoot backward at strength=1 */
  backwardPowerMax?: number;

  /** Texture URL (defaults to Babylon flare) */
  textureUrl?: string;

  /** Colors (additive/glowy by default) */
  color1?: Color4;
  color2?: Color4;
  colorDead?: Color4;

  /** Ribbon width (world units) */
  ribbonWidth?: number;
  /** Ribbon length (segments; bigger = longer trail) */
  ribbonLength?: number;
  /** Ribbon emissive color */
  ribbonColor?: Color3;
  /** Ribbon alpha multiplier (final alpha still scales with speed strength) */
  ribbonAlpha?: number;
  /** Ribbon texture resolution along length */
  ribbonTextureWidth?: number;
  ribbonTextureHeight?: number;

  /**
   * If true, the trail will follow the generator's rotation.
   * Default false: rotation is ignored so rolling objects don't "twist" the trail.
   */
  followRotation?: boolean;

  /**
   * If true (default), orient the ribbon so its "width axis" is vertical (Y).
   * This makes the trail read like a vertical slice behind the object.
   */
  ribbonVertical?: boolean;
};

export type SpeedTrailHandle = {
  particleSystem: ParticleSystem;
  ribbon?: TrailMesh;
  dispose: () => void;
};

function _createRibbonGradientTexture(
  scene: Scene,
  width: number,
  height: number
) {
  const dt = new DynamicTexture(
    "speedTrailRibbonTex",
    { width, height },
    scene,
    true
  );
  dt.hasAlpha = true;
  const ctx = dt.getContext();

  // Left (head) -> right (tail) alpha gradient with a bright core.
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0.0, "rgba(255,255,255,0.0)");
  grad.addColorStop(0.10, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.35)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  dt.update();
  return dt;
}

/**
 * Attaches a stylized speed-based trail to a mesh.
 * You provide a velocity getter so this works for physics or manual motion.
 */
export function attachSpeedTrail(
  scene: Scene,
  mesh: AbstractMesh,
  getVelocity: () => Vector3,
  options: SpeedTrailOptions
): SpeedTrailHandle {
  if (options.enabled === false) {
    const ps = new ParticleSystem("speedTrail_disabled", 1, scene);
    ps.dispose();
    return { particleSystem: ps, dispose: () => {} };
  }

  const particlesEnabled = options.particlesEnabled ?? true;
  const ribbonEnabled = options.ribbonEnabled ?? true;
  const followRotation = options.followRotation ?? false;
  const ribbonVertical = options.ribbonVertical ?? true;

  const speedOn = Math.max(0, options.speedOn);
  // If not set, fade begins at 0 (always smoothly ramps).
  const speedOff = Math.max(0, options.speedOff ?? 0);
  const speedForMax = Math.max(0.001, options.speedForMax);

  const emitRateMin = options.emitRateMin ?? 0;
  // Default toned down so the ribbon can "own" the look.
  const emitRateMax = options.emitRateMax ?? 220;
  const sizeMin = options.sizeMin ?? 0.06;
  const sizeMax = options.sizeMax ?? 0.16;
  const lifeMin = options.lifeMin ?? 0.12;
  const lifeMax = options.lifeMax ?? 0.28;
  const spread = options.spread ?? 0.4;
  const backwardPowerMax = options.backwardPowerMax ?? 6.5;

  const textureUrl =
    options.textureUrl ?? "https://playground.babylonjs.com/textures/flare.png";

  // Anchor mesh that follows position only (keeps trail independent of rolling rotation).
  const anchor = MeshBuilder.CreateSphere(
    "speedTrailAnchor",
    { diameter: 0.001, segments: 4 },
    scene
  );
  anchor.isPickable = false;
  anchor.isVisible = false;
  anchor.rotationQuaternion = Quaternion.Identity();

  const ps = new ParticleSystem("speedTrail", 2000, scene);
  ps.emitter = anchor;
  ps.emitRate = 1;
  ps.updateSpeed = 0.01;
  ps.disposeOnStop = false;

  if (particlesEnabled) {
    ps.particleTexture = new Texture(textureUrl, scene);

    // Flashy, stylized defaults (additive glow)
    ps.color1 = options.color1 ?? new Color4(1, 1, 1.0, 0.75);
    ps.color2 = options.color2 ?? new Color4(1.0, 1, 1, 0.75);
    ps.colorDead = options.colorDead ?? new Color4(0.05, 0.05, 0.05, 0);

    ps.minSize = sizeMin;
    ps.maxSize = sizeMax;
    ps.minLifeTime = lifeMin;
    ps.maxLifeTime = lifeMax;

    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    (ps as any).alphaMode = Engine.ALPHA_ADD;
    ps.start();
  }

  let ribbon: TrailMesh | undefined;
  let ribbonMat: StandardMaterial | undefined;
  let ribbonTex: DynamicTexture | undefined;

  if (ribbonEnabled) {
    const ribbonWidth = options.ribbonWidth ?? 1.0;
    const ribbonLength = Math.max(10, Math.floor(options.ribbonLength ?? 20));
    ribbon = new TrailMesh(
      "speedTrailRibbon",
      anchor,
      scene,
      {
        diameter: ribbonWidth,
        length: ribbonLength,
        segments: ribbonLength,
        sections: 2,
        doNotTaper: false,
        autoStart: true,
      } as any
    );
    ribbon.isPickable = false;

    ribbonTex = _createRibbonGradientTexture(
      scene,
      options.ribbonTextureWidth ?? 256,
      options.ribbonTextureHeight ?? 8
    );

    ribbonMat = new StandardMaterial("speedTrailRibbonMat", scene);
    ribbonMat.diffuseTexture = ribbonTex;
    ribbonMat.useAlphaFromDiffuseTexture = true;
    ribbonMat.disableLighting = true;
    ribbonMat.backFaceCulling = false;
    ribbonMat.emissiveColor = options.ribbonColor ?? new Color3(0.55, 0.95, 1.0);
    ribbonMat.alpha = options.ribbonAlpha ?? 0.75;
    ribbonMat.alphaMode = Engine.ALPHA_ADD;
    ribbon.material = ribbonMat;
  }

  // We'll steer direction each frame based on velocity.
  const tmpVel = new Vector3();
  const tmpDir = new Vector3();
  const tmpRight = new Vector3();
  const tmpUp = new Vector3();
  const tmpPos = new Vector3();
  let disposed = false;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const smoothstep01 = (t: number) => t * t * (3 - 2 * t);

  const updateObs = scene.onBeforeRenderObservable.add(() => {
    if (disposed) return;

    // Follow position but ignore rotation unless explicitly enabled.
    tmpPos.copyFrom(mesh.getAbsolutePosition());
    anchor.position.copyFrom(tmpPos);
    if (!followRotation) {
      anchor.rotationQuaternion = anchor.rotationQuaternion ?? Quaternion.Identity();
      if (ribbonVertical) {
        // Rotate so the 2-section TrailMesh ribbon aligns vertically (Y axis).
        // (Rotation around Z puts the ribbon's width along Y instead of X.)
        anchor.rotationQuaternion.copyFrom(Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2));
      } else {
        anchor.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
      }
      anchor.rotation.set(0, 0, 0);
      anchor.scaling.set(1, 1, 1);
    }

    tmpVel.copyFrom(getVelocity());
    const speed = tmpVel.length();

    // Gentle ramp with no hard on/off.
    // - Below speedOff => ~0
    // - Around speedOn => starts to become visible
    // - At speedForMax => full intensity
    const fadeBandStart = Math.min(speedOff, speedOn);
    const fadeBandEnd = Math.max(speedOff, speedOn);
    const fadeT =
      fadeBandEnd > fadeBandStart
        ? clamp01((speed - fadeBandStart) / (fadeBandEnd - fadeBandStart))
        : speed >= speedOn
          ? 1
          : 0;

    const maxT = clamp01(speed / speedForMax);
    const strength = smoothstep01(maxT) * smoothstep01(fadeT);

    if (particlesEnabled) {
      // Emit rate + particle size scale with speed.
      ps.emitRate = emitRateMin + (emitRateMax - emitRateMin) * strength;
      ps.minSize = sizeMin * (0.9 + 0.7 * strength);
      ps.maxSize = sizeMax * (0.9 + 0.9 * strength);
    }

    if (ribbonMat) {
      const baseAlpha = options.ribbonAlpha ?? 0.75;
      ribbonMat.alpha = baseAlpha * strength;
    }

    // Push particles opposite motion direction, with a tight cone to keep it "straight".
    if (speed > 1e-4) {
      tmpDir.copyFrom(tmpVel).scaleInPlace(-1 / speed);
    } else {
      tmpDir.set(0, 1, 0);
    }

    const base = tmpDir.scale(backwardPowerMax * (0.25 + 0.75 * strength));

    // Build an orthonormal frame around the base direction so spread is perpendicular
    // (prevents the "spiral" / overly volumetric look).
    const upCandidate = Math.abs(Vector3.Dot(tmpDir, Vector3.Up())) > 0.98 ? Vector3.Right() : Vector3.Up();
    Vector3.CrossToRef(tmpDir, upCandidate, tmpRight);
    if (tmpRight.lengthSquared() < 1e-6) {
      tmpRight.set(1, 0, 0);
    } else {
      tmpRight.normalize();
    }
    Vector3.CrossToRef(tmpRight, tmpDir, tmpUp);
    if (tmpUp.lengthSquared() < 1e-6) tmpUp.set(0, 1, 0);
    else tmpUp.normalize();

    if (particlesEnabled) {
      const cone = spread * (0.25 + 0.75 * strength);
      ps.direction1 = base.add(tmpRight.scale(cone)).add(tmpUp.scale(cone));
      ps.direction2 = base.add(tmpRight.scale(-cone)).add(tmpUp.scale(-cone));
    }
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.onBeforeRenderObservable.remove(updateObs);
    if (particlesEnabled) {
      ps.stop();
    }
    ps.dispose();
    anchor.dispose(false, true);
    ribbon?.dispose(false, true);
    ribbonTex?.dispose();
    ribbonMat?.dispose();
  };

  return { particleSystem: ps, ribbon, dispose };
}

