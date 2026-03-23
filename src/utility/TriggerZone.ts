import * as BABYLON from "@babylonjs/core";

// --- Event payload (like Unity's Collider info) ---
export interface TriggerEvent {
  triggerMesh: BABYLON.AbstractMesh; // The zone that was entered
  otherMesh: BABYLON.AbstractMesh; // The mesh that entered
  triggerPosition: BABYLON.Vector3; // World position of the trigger
  otherPosition: BABYLON.Vector3; // World position of the other mesh
  distance: number; // Distance between centers
  timestamp: number; // Time of event (ms)
}

export type TriggerCallback = (event: TriggerEvent) => void;

// --- Trigger component ---
export class TriggerZone {
  private actionManager: BABYLON.ActionManager;
  private enterCallbacks: TriggerCallback[] = [];
  private exitCallbacks: TriggerCallback[] = [];

  constructor(
    private triggerMesh: BABYLON.AbstractMesh,
    private watchedMeshes: BABYLON.AbstractMesh[],
    precise: boolean = false,
  ) {
    this.actionManager = new BABYLON.ActionManager(triggerMesh.getScene());
    triggerMesh.actionManager = this.actionManager;

    this.watchedMeshes = watchedMeshes || [];

    console.log(typeof this.watchedMeshes);

    //null check: if no targets provided, watch all meshes in the scene
    const filteredMeshes = this.watchedMeshes.length
      ? this.watchedMeshes
      : triggerMesh.getScene().meshes.filter((m) => m !== triggerMesh);

    // Register enter/exit for each watched mesh
    for (const target of filteredMeshes) {
      this.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
            parameter: { mesh: target, usePreciseIntersection: precise },
          },
          () => this.fireEnter(target),
        ),
      );

      this.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnIntersectionExitTrigger,
            parameter: { mesh: target, usePreciseIntersection: precise },
          },
          () => this.fireExit(target),
        ),
      );
    }
  }

  private buildEvent(other: BABYLON.AbstractMesh): TriggerEvent {
    const tPos = this.triggerMesh.getAbsolutePosition();
    const oPos = other.getAbsolutePosition();
    return {
      triggerMesh: this.triggerMesh,
      otherMesh: other,
      triggerPosition: tPos.clone(),
      otherPosition: oPos.clone(),
      distance: BABYLON.Vector3.Distance(tPos, oPos),
      timestamp: performance.now(),
    };
  }

  private fireEnter(other: BABYLON.AbstractMesh): void {
    const event = this.buildEvent(other);
    this.enterCallbacks.forEach((cb) => cb(event));
  }

  private fireExit(other: BABYLON.AbstractMesh): void {
    const event = this.buildEvent(other);
    this.exitCallbacks.forEach((cb) => cb(event));
  }

  onTriggerEnter(callback: TriggerCallback): this {
    this.enterCallbacks.push(callback);
    return this; // chainable
  }

  onTriggerExit(callback: TriggerCallback): this {
    this.exitCallbacks.push(callback);
    return this;
  }

  dispose(): void {
    this.actionManager.dispose();
    this.enterCallbacks = [];
    this.exitCallbacks = [];
  }
}
