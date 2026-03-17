import {
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core";

export type CollisionBurstOptions = {
  /** Collisions below this impulse do nothing */
  impulseThreshold: number;
  /**
   * Optional multiplier applied to the internally computed strength.
   * Useful to scale bursts by impact speed, etc.
   */
  strengthMultiplier?: number;
  /** Optional URL for particle texture */
  textureUrl?: string;
};

export function spawnCollisionBurst(
  scene: Scene,
  amount: number = 80,
  point: Vector3,
  impulse: number,
  options: CollisionBurstOptions
) {
  const textureUrl =
    options.textureUrl ?? "https://playground.babylonjs.com/textures/flare.png";

  const baseStrength = impulse / (options.impulseThreshold * 4);
  const strength = Math.min(
    1,
    baseStrength * (options.strengthMultiplier ?? 1)
  );

  const ps = new ParticleSystem("collisionBurst", amount, scene);
  ps.particleTexture = new Texture(textureUrl, scene);

  ps.emitter = point.clone();
  ps.color1 = new Color4(1, 0.9, 0.7, 1);
  ps.color2 = new Color4(1, 0.6, 0.2, 1);
  ps.colorDead = new Color4(0.2, 0.2, 0.2, 0);

  ps.minSize = 0.08;
  ps.maxSize = 0.25;
  ps.minLifeTime = 0.12;
  ps.maxLifeTime = 0.28;

  ps.emitRate = 0;
  ps.manualEmitCount = Math.floor(25 + 55 * strength);

  ps.direction1 = new Vector3(-1, 1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.minEmitPower = 1 + 3 * strength;
  ps.maxEmitPower = 2 + 6 * strength;
  ps.updateSpeed = 0.02;
  ps.targetStopDuration = 0.05;
  ps.disposeOnStop = true;

  ps.start();
  return ps;
}

