import {
  AbstractMesh,
  ActionManager,
  ExecuteCodeAction,
  Mesh,
  MeshBuilder,
  Scene,
  SetValueAction,
} from "@babylonjs/core";
import { Mat_OverlapRegion } from "../materials/Mat_OverlapRegion";
import {
  TriggerCallback,
  TriggerEvent,
  TriggerZone,
} from "../utility/TriggerZone";

export type OverlapRegionOptions = {
  diameter?: number;
  height?: number;
  targets?: AbstractMesh[];
  onEnter?: TriggerCallback;
  onExit?: TriggerCallback;
};

export class OverlapRegion {
  public readonly mesh: Mesh;
  targets: AbstractMesh[];

  constructor(scene: Scene, options: OverlapRegionOptions) {
    this.mesh = MeshBuilder.CreateCylinder(
      "overlapRegion",
      {
        diameter: options.diameter ?? 1,
        height: options.height ?? 1,
        cap: Mesh.NO_CAP,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    );

    //flip the cylinder upside down because the texture is designed to be viewed from below
    this.mesh.rotation.x = Math.PI;
    this.mesh.material = Mat_OverlapRegion();

    // Make sure the region doesn't interfere with physics (e.g. by being a trigger volume)
    this.mesh.checkCollisions = false;
    this.mesh.isPickable = false;

    const trigger = new TriggerZone(this.mesh, this.targets, true)
      .onTriggerEnter((e) => {
        this.OnTriggerEnter(e);
      })
      .onTriggerExit((e) => {
        this.OnTriggerExit(e);
      });
  }

  OnTriggerEnter(e: TriggerEvent) {}
  OnTriggerExit(e: TriggerEvent) {}
}
