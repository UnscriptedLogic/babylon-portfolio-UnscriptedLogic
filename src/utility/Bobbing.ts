import { AbstractMesh, Scene } from "@babylonjs/core";

export type BobbingOptions = {
  /** Set false to disable the bobbing */
  enabled?: boolean;
  /** Amplitude of the bobbing motion (world units) */
  amplitude?: number;
  /** Speed of the bobbing (cycles per second) */
  speed?: number;
  /** Phase offset for the sine wave (radians) */
  phase?: number;
};

/**
 * Attaches a bobbing up and down motion to any mesh.
 * The mesh will oscillate vertically around its initial Y position.
 *
 * @param mesh The mesh to apply bobbing to
 * @param options Configuration options for the bobbing behavior
 * @returns A disposer function to stop the bobbing and clean up
 */
export function attachBobbing(
  mesh: AbstractMesh,
  options: BobbingOptions = {},
): () => void {
  const enabled = options.enabled ?? true;
  const amplitude = options.amplitude ?? 0.5;
  const speed = options.speed ?? 1;
  const phase = options.phase ?? 0;

  const scene = mesh.getScene();
  const engine = scene.getEngine();
  const initialY = mesh.position.y;
  let time = phase;

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!enabled) return;
    time += (engine.getDeltaTime() / 1000) * speed * 2 * Math.PI; // convert to seconds and apply speed
    mesh.position.y = initialY + Math.sin(time) * amplitude;
  });

  return () => {
    scene.onBeforeRenderObservable.remove(observer);
  };
}
