import { AbstractMesh, PhysicsEventType, Scene, Vector3 } from "@babylonjs/core";

export type CollisionSquashStretchOptions = {
  /** Set false to disable */
  enabled?: boolean;

  /** Collisions below this impulse do nothing */
  impulseThreshold: number;
  /** Linear speed at which effect reaches full strength */
  speedForMax: number;

  /** Seconds for the whole effect (squash + rebound back to 1) */
  durationSeconds?: number;
  /** Minimum time between triggers to avoid jitter on sliding contacts */
  cooldownSeconds?: number;

  /** Max stretch along the chosen axis at strength=1 (0.25 => 1.25x) */
  maxStretch?: number;
  /** Max squash on the other two axes at strength=1 (0.18 => 0.82x) */
  maxSquash?: number;

  /** Portion of the animation spent going INTO the squash (0..1) */
  impactPortion?: number;
};

type BodyLike = {
  getCollisionObservable: () => { add: (cb: (ev: any) => void) => any; remove: (obs: any) => void };
  getLinearVelocity: () => Vector3;
  setCollisionCallbackEnabled?: (enabled: boolean) => void;
};

function _pickAxisFromDirection(dir: Vector3): "x" | "y" | "z" {
  const ax = Math.abs(dir.x);
  const ay = Math.abs(dir.y);
  const az = Math.abs(dir.z);
  if (ay >= ax && ay >= az) return "y";
  if (ax >= az) return "x";
  return "z";
}

const _easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const _easeInCubic = (t: number) => t * t * t;

/**
 * Attaches a "rubber" squash & stretch reaction to collision events.
 * Works with Havok bodies exposed through Babylon's `PhysicsAggregate.body`.
 *
 * Returns a disposer you can call to detach the behavior.
 */
export function attachCollisionSquashStretch(
  scene: Scene,
  mesh: AbstractMesh,
  body: BodyLike,
  options: CollisionSquashStretchOptions
) {
  if (options.enabled === false) {
    return () => {};
  }

  const durationSeconds = options.durationSeconds ?? 0.18;
  const cooldownSeconds = options.cooldownSeconds ?? 0.06;
  const maxStretch = options.maxStretch ?? 0.28;
  const maxSquash = options.maxSquash ?? 0.18;
  const impactPortion = Math.max(0.05, Math.min(0.95, options.impactPortion ?? 0.33));
  const impulseThreshold = options.impulseThreshold;
  const speedForMax = Math.max(0.001, options.speedForMax);

  let squashStartMs = -1;
  let lastTriggerMs = -1;
  let squashAxis: "x" | "y" | "z" = "y";
  let squashStrength = 0;

  body.setCollisionCallbackEnabled?.(true);

  const tickObs = scene.onBeforeRenderObservable.add(() => {
    if (squashStartMs < 0) {
      return;
    }

    const now = performance.now();
    const t = (now - squashStartMs) / (durationSeconds * 1000);
    if (t >= 1) {
      mesh.scaling.set(1, 1, 1);
      squashStartMs = -1;
      squashStrength = 0;
      return;
    }

    // Two-phase: quick impact squash, then rebound back to 1.
    let a = 0;
    if (t <= impactPortion) {
      a = _easeOutCubic(t / impactPortion);
    } else {
      const rt = (t - impactPortion) / (1 - impactPortion);
      a = 1 - _easeInCubic(rt);
    }

    const s = squashStrength;
    const stretch = 1 + maxStretch * s * a;
    const squash = 1 - maxSquash * s * a;

    let sx = squash;
    let sy = squash;
    let sz = squash;
    if (squashAxis === "x") sx = stretch;
    else if (squashAxis === "y") sy = stretch;
    else sz = stretch;

    mesh.scaling.set(sx, sy, sz);
  });

  const collisionObs = body.getCollisionObservable().add((ev: any) => {
    if (ev?.type !== PhysicsEventType.COLLISION_STARTED) {
      return;
    }
    const impulse = typeof ev?.impulse === "number" ? ev.impulse : 0;
    if (impulse < impulseThreshold) {
      return;
    }

    const now = performance.now();
    if (lastTriggerMs > 0 && now - lastTriggerMs < cooldownSeconds * 1000) {
      return;
    }

    const vel = body.getLinearVelocity();
    const speed = vel.length();
    const strength = Math.max(0, Math.min(1, speed / speedForMax));

    squashAxis = speed > 1e-3 ? _pickAxisFromDirection(vel) : "y";
    squashStrength = strength;
    squashStartMs = now;
    lastTriggerMs = now;
  });

  return () => {
    scene.onBeforeRenderObservable.remove(tickObs);
    body.getCollisionObservable().remove(collisionObs);
    mesh.scaling.set(1, 1, 1);
  };
}

