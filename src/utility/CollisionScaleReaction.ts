import { AbstractMesh, PhysicsEventType, Scene, Vector3 } from "@babylonjs/core";

export type CollisionScaleReactionOptions = {
  /** Set false to disable */
  enabled?: boolean;

  /** Collisions below this impulse do nothing */
  impulseThreshold: number;
  /** Linear speed at which effect reaches full strength */
  speedForMax: number;

  /** Seconds for the whole effect (pop + settle back to 1) */
  durationSeconds?: number;
  /** Minimum time between triggers */
  cooldownSeconds?: number;

  /**
   * Max uniform scale add at strength=1.
   * Example 0.25 => peak scale 1.25
   */
  maxScaleAdd?: number;

  /** Portion of the animation spent going INTO the pop (0..1) */
  impactPortion?: number;
};

type BodyLike = {
  getCollisionObservable: () => {
    add: (cb: (ev: any) => void) => any;
    remove: (obs: any) => void;
  };
  getLinearVelocity: () => Vector3;
  setCollisionCallbackEnabled?: (enabled: boolean) => void;
};

const _easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const _easeInCubic = (t: number) => t * t * t;

/**
 * Attaches a simple uniform scale "pop" reaction to collision events.
 * Returns a disposer you can call to detach the behavior.
 */
export function attachCollisionScaleReaction(
  scene: Scene,
  mesh: AbstractMesh,
  body: BodyLike,
  options: CollisionScaleReactionOptions
) {
  if (options.enabled === false) {
    return () => {};
  }

  const durationSeconds = options.durationSeconds ?? 0.14;
  const cooldownSeconds = options.cooldownSeconds ?? 0.06;
  const maxScaleAdd = options.maxScaleAdd ?? 0.22;
  const impactPortion = Math.max(0.05, Math.min(0.95, options.impactPortion ?? 0.28));
  const impulseThreshold = options.impulseThreshold;
  const speedForMax = Math.max(0.001, options.speedForMax);

  let startMs = -1;
  let lastTriggerMs = -1;
  let strength = 0;

  body.setCollisionCallbackEnabled?.(true);

  const tickObs = scene.onBeforeRenderObservable.add(() => {
    if (startMs < 0) return;

    const now = performance.now();
    const t = (now - startMs) / (durationSeconds * 1000);
    if (t >= 1) {
      mesh.scaling.set(1, 1, 1);
      startMs = -1;
      strength = 0;
      return;
    }

    // Two-phase: quick pop, then settle to 1.
    let a = 0;
    if (t <= impactPortion) a = _easeOutCubic(t / impactPortion);
    else {
      const rt = (t - impactPortion) / (1 - impactPortion);
      a = 1 - _easeInCubic(rt);
    }

    const peak = 1 + maxScaleAdd * strength;
    const s = 1 + (peak - 1) * a;
    mesh.scaling.set(s, s, s);
  });

  const collisionObs = body.getCollisionObservable().add((ev: any) => {
    if (ev?.type !== PhysicsEventType.COLLISION_STARTED) return;
    const impulse = typeof ev?.impulse === "number" ? ev.impulse : 0;
    if (impulse < impulseThreshold) return;

    const now = performance.now();
    if (lastTriggerMs > 0 && now - lastTriggerMs < cooldownSeconds * 1000) return;

    const vel = body.getLinearVelocity();
    const speed = vel.length();
    strength = Math.max(0, Math.min(1, speed / speedForMax));

    startMs = now;
    lastTriggerMs = now;
  });

  return () => {
    scene.onBeforeRenderObservable.remove(tickObs);
    body.getCollisionObservable().remove(collisionObs);
    mesh.scaling.set(1, 1, 1);
  };
}

