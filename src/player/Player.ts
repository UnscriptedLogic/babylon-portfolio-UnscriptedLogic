import {
  AbstractMesh,
  FreeCamera,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsEventType,
  PhysicsPrestepType,
  PhysicsShapeType,
  PointerEventTypes,
  Quaternion,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { spawnCollisionBurst } from "../utility/Particles";

export type PlayerOptions = {
  spawnPoint: Vector3;
  fallThresholdY: number;
  ballMass: number;
  clickForce: number;
  collisionImpulseThreshold: number;
  /** Linear speed at which collision particles reach full strength */
  collisionSpeedForMaxParticles?: number;
  ballDiameter?: number;
};

export class Player {
  public readonly ball: ReturnType<typeof MeshBuilder.CreateSphere>;
  public readonly aggregate: PhysicsAggregate;

  private readonly _scene: Scene;
  private readonly _options: PlayerOptions;
  private readonly _ground: AbstractMesh;
  private _camera?: FreeCamera;
  private _cameraOffset?: Vector3;

  constructor(scene: Scene, ground: AbstractMesh, options: PlayerOptions) {
    this._scene = scene;
    this._ground = ground;
    this._options = options;

    this.ball = MeshBuilder.CreateSphere(
      "player_ball",
      { diameter: options.ballDiameter ?? 1.5, segments: 32 },
      scene
    );
    this.ball.position.copyFrom(options.spawnPoint);

    this.aggregate = new PhysicsAggregate(
      this.ball,
      PhysicsShapeType.SPHERE,
      { mass: options.ballMass, restitution: 0.15, friction: 0.9 },
      scene
    );

    this._wireCollisionParticles();
    this._wireClickToMove();
  }

  /**
   * Optionally provide a camera; it will snap to the ball on respawn.
   * Smooth follow is still expected to be handled outside this class.
   */
  public setCameraForRespawnSnap(camera: FreeCamera, cameraOffset: Vector3) {
    this._camera = camera;
    this._cameraOffset = cameraOffset.clone();
  }

  public get position() {
    return this.ball.position;
  }

  /** Call every frame */
  public update() {
    this._ensureAboveFallThreshold();
  }

  private _ensureAboveFallThreshold() {
    if (this.ball.position.y >= this._options.fallThresholdY) {
      return;
    }

    const spawnPoint = this._options.spawnPoint;

    // Teleport the physics body back to spawn (keeps simulation healthy)
    this.aggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
    this.aggregate.body.setTargetTransform(spawnPoint, Quaternion.Identity());
    this.aggregate.body.setLinearVelocity(Vector3.Zero());
    this.aggregate.body.setAngularVelocity(Vector3.Zero());
    this.aggregate.body.setPrestepType(PhysicsPrestepType.ACTION);

    // Sync visual immediately
    this.ball.position.copyFrom(spawnPoint);

    // Optional camera snap
    if (this._camera && this._cameraOffset) {
      this._camera.position.copyFrom(spawnPoint.add(this._cameraOffset));
      this._camera.setTarget(spawnPoint);
    }
  }

  private _wireCollisionParticles() {
    this.aggregate.body.setCollisionCallbackEnabled(true);
    this.aggregate.body.getCollisionObservable().add((ev) => {
      if (ev.type !== PhysicsEventType.COLLISION_STARTED) {
        return;
      }
      if (ev.impulse < this._options.collisionImpulseThreshold) {
        return;
      }

      const speedForMax = this._options.collisionSpeedForMaxParticles ?? 15;
      const speed = this.aggregate.body.getLinearVelocity().length();
      const speedMultiplier = Math.min(1, speed / Math.max(0.001, speedForMax));

      spawnCollisionBurst(
        this._scene,
        80,
        ev.point ?? this.ball.position,
        ev.impulse,
        {
          impulseThreshold: this._options.collisionImpulseThreshold,
          strengthMultiplier: speedMultiplier,
        }
      );
    });
  }

  private _wireClickToMove() {
    this._scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
        return;
      }

      const pick = this._scene.pick(
        this._scene.pointerX,
        this._scene.pointerY,
        (mesh) => mesh === this._ground
      );
      if (!pick || !pick.hit || !pick.pickedPoint) {
        return;
      }

      const target = pick.pickedPoint;

      // Only move in XZ plane; keep Y driven by physics
      const direction = target.subtract(this.ball.position);
      direction.y = 0;

      const distance = direction.length();
      if (distance < 1e-2) {
        return;
      }

      const dirNorm = direction.scale(1 / distance);
      const forceMagnitude = this._options.clickForce * this._options.ballMass * distance;
      const force = dirNorm.scale(forceMagnitude);

      this.aggregate.body.applyForce(force, this.ball.position);
    });
  }
}

