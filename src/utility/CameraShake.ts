import { Observable, Scene, Vector3 } from "@babylonjs/core";

export type CameraShakeOptions = {
  enabled?: boolean;
  /** Position shake amplitude in world units at strength=1 */
  maxOffset?: number;
  /** How quickly trauma decays per second */
  decayPerSecond?: number;
  /** Minimum time between kicks (seconds) */
  cooldownSeconds?: number;
};

export type CameraShakeController = {
  /** Trigger a shake (strength 0..1) */
  kick: (strength01: number) => void;
  /** Current offset to add to camera position/target */
  getOffset: () => Vector3;
  /** For convenience, emits every frame after update */
  onOffsetUpdated: Observable<Vector3>;
  dispose: () => void;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function randSigned() {
  return Math.random() * 2 - 1;
}

/**
 * Lightweight camera shake controller.
 * Apply `getOffset()` to camera position (and optionally target) each frame.
 */
export function createCameraShake(
  scene: Scene,
  options: CameraShakeOptions = {}
): CameraShakeController {
  const enabled = options.enabled ?? true;
  const maxOffset = options.maxOffset ?? 0.18;
  const decayPerSecond = options.decayPerSecond ?? 2.4;
  const cooldownSeconds = options.cooldownSeconds ?? 0.05;

  let trauma = 0;
  let lastKickMs = -1;

  const offset = new Vector3();
  const onOffsetUpdated = new Observable<Vector3>();

  const obs = scene.onBeforeRenderObservable.add(() => {
    if (!enabled) {
      offset.setAll(0);
      return;
    }

    const dt = scene.getEngine().getDeltaTime() / 1000;
    trauma = Math.max(0, trauma - decayPerSecond * dt);

    // Use trauma^2 for nicer easing (tiny shakes stay tiny).
    const t = trauma * trauma;
    offset.set(
      randSigned() * maxOffset * t,
      randSigned() * maxOffset * t,
      randSigned() * maxOffset * t
    );
    onOffsetUpdated.notifyObservers(offset);
  });

  const kick = (strength01: number) => {
    if (!enabled) return;
    const now = performance.now();
    if (lastKickMs > 0 && now - lastKickMs < cooldownSeconds * 1000) {
      return;
    }
    lastKickMs = now;
    trauma = clamp01(Math.max(trauma, strength01));
  };

  const dispose = () => {
    scene.onBeforeRenderObservable.remove(obs);
    onOffsetUpdated.clear();
  };

  return { kick, getOffset: () => offset, onOffsetUpdated, dispose };
}

