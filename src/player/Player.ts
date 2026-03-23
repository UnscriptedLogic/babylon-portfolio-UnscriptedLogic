import {
    AbstractMesh,
    FreeCamera,
    MeshBuilder,
    Observable,
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
import { spawnImpactShockwave } from "../utility/Shockwave";
import {
    attachCollisionSquashStretch,
    CollisionSquashStretchOptions,
} from "../utility/CollisionSquashStretch";
import {
    attachCollisionScaleReaction,
    CollisionScaleReactionOptions,
} from "../utility/CollisionScaleReaction";
import { attachSpeedTrail, SpeedTrailOptions } from "../utility/SpeedTrail";
import { Color3 } from "@babylonjs/core";
import { createToonMaterial, ToonMaterialOptions } from "../utility/Toon";
import { EntityTag } from "../utility/EntityTag";

export type PlayerOptions = {
    spawnPoint: Vector3;
    fallThresholdY: number;
    ballMass: number;
    clickForce: number;
    collisionImpulseThreshold: number;
    /** Linear speed at which collision particles reach full strength */
    collisionSpeedForMaxParticles?: number;
    ballDiameter?: number;

    /**
     * Collision squash & stretch (visual only) to make the ball feel rubbery.
     * Strength scales with impact speed.
     */
    collisionSquashStretch?: Partial<CollisionSquashStretchOptions> & {
        /** Set false to disable */
        enabled?: boolean;
    };

    /**
     * Collision scale reaction (visual only) for quick testing / alternative feel.
     * This is a uniform "pop" scale, not axis-based squash/stretch.
     */
    collisionScaleReaction?: Partial<CollisionScaleReactionOptions> & {
        /** Set false to disable */
        enabled?: boolean;
    };

    /** Stylized trail that turns on above a speed threshold */
    speedTrail?: Partial<SpeedTrailOptions> & {
        /** Set false to disable */
        enabled?: boolean;
    };

    /** Toon/cel shading for the player ball */
    toon?: Partial<ToonMaterialOptions> & { enabled?: boolean };

    /** Built-in Babylon outline to help the ball pop */
    outline?: {
        enabled?: boolean;
        color?: Color3;
        /** Typical range ~0.01–0.08 depending on scene scale */
        width?: number;
    };
};

export type PlayerImpactEvent = {
    point: Vector3;
    normal: Vector3;
    impulse: number;
    speed: number;
    /** 0..1 */
    strength: number;
};

export class Player {
    public readonly ball: ReturnType<typeof MeshBuilder.CreateSphere>;
    public readonly aggregate: PhysicsAggregate;
    public readonly onImpactObservable = new Observable<PlayerImpactEvent>();

    public tags?: string[][];

    private readonly _scene: Scene;
    private readonly _options: PlayerOptions;
    private readonly _ground: AbstractMesh;
    private _camera?: FreeCamera;
    private _cameraOffset?: Vector3;
    private _disposeSquashStretch?: () => void;
    private _disposeScaleReaction?: () => void;
    private _disposeSpeedTrail?: () => void;

    constructor(scene: Scene, ground: AbstractMesh, options: PlayerOptions) {
        this._scene = scene;
        this._ground = ground;
        this._options = options;

        this.ball = MeshBuilder.CreateSphere(
            "player_ball",
            { diameter: options.ballDiameter ?? 1.5, segments: 32 },
            scene,
        );
        this.ball.position.copyFrom(options.spawnPoint);
        this._wireToonMaterial();
        this._wireOutline();

        this.aggregate = new PhysicsAggregate(
            this.ball,
            PhysicsShapeType.SPHERE,
            { mass: options.ballMass, restitution: 0.5, friction: 0.7 },
            scene,
        );

        this.aggregate.body.setAngularDamping(2);

        this._wireCollisionParticles();
        // NOTE: swapped to scale reaction for testing as requested.
        // You can switch back by calling `_wireCollisionSquashStretchUtility()` instead.
        this._wireCollisionScaleReactionUtility();
        this._wireSpeedTrailUtility();
        this._wireClickToMove();
    }

    getmesh(): AbstractMesh {
        return this.ball;
    }
    private _wireToonMaterial() {
        const cfg = this._options.toon;
        if (cfg?.enabled === false) {
            return;
        }

        // const mat = createToonMaterial(this._scene, "playerToon", {
        //   lightName: cfg?.lightName ?? "key",
        //   baseColor: cfg?.baseColor ?? new Color3(0.95, 0.82, 0.72),
        //   shadeColor: cfg?.shadeColor ?? new Color3(0.2, 0.12, 0.26),
        //   steps: cfg?.steps ?? 3,
        //   hardness: cfg?.hardness ?? 1.45,
        //   rimStrength: cfg?.rimStrength ?? 0.16,
        //   rimPower: cfg?.rimPower ?? 2.2,
        //   rimColor: cfg?.rimColor ?? new Color3(0.85, 0.6, 1.0),
        // });

        // this.ball.material = mat;
    }

    private _wireOutline() {
        const cfg = this._options.outline;
        if (cfg?.enabled === false) {
            return;
        }

        this.ball.renderOutline = true;
        this.ball.outlineColor = cfg?.color ?? new Color3(0.1, 0.06, 0.16);
        this.ball.outlineWidth = cfg?.width ?? 0.04;
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
        this.aggregate.body.setTargetTransform(
            spawnPoint,
            Quaternion.Identity(),
        );
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

            const speedForMax =
                this._options.collisionSpeedForMaxParticles ?? 15;
            const speed = this.aggregate.body.getLinearVelocity().length();
            const speedMultiplier = Math.min(
                1,
                speed / Math.max(0.001, speedForMax),
            );

            const impactPoint = ev.point ?? this.ball.position;
            const normalFromEvent: Vector3 | undefined =
                (ev as any).normal ??
                (ev as any).contactNormal ??
                (ev as any).collisionNormal;

            // Fallback: approximate normal from ball -> impact point direction.
            const fallbackNormal = impactPoint
                .subtract(this.ball.position)
                .normalize()
                .scale(-1);

            const impactNormal =
                normalFromEvent && normalFromEvent.lengthSquared() > 1e-6
                    ? normalFromEvent
                    : fallbackNormal.lengthSquared() > 1e-6
                      ? fallbackNormal
                      : Vector3.Up();

            spawnCollisionBurst(this._scene, 80, impactPoint, ev.impulse, {
                impulseThreshold: this._options.collisionImpulseThreshold,
                strengthMultiplier: speedMultiplier,
            });

            // 2D shockwave ring aligned to impact normal; scales with speed.
            spawnImpactShockwave(this._scene, impactPoint, impactNormal, {
                strength: speedMultiplier,
                durationSeconds: 0.3,
                endRadiusBase: 3,
                fadePower: 2,
            });

            this.onImpactObservable.notifyObservers({
                point: impactPoint.clone(),
                normal: impactNormal.clone(),
                impulse: ev.impulse,
                speed,
                strength: speedMultiplier,
            });
        });
    }

    private _wireCollisionSquashStretchUtility() {
        const cfg = this._options.collisionSquashStretch;
        if (cfg?.enabled === false) {
            return;
        }

        const impulseThreshold =
            cfg?.impulseThreshold ?? this._options.collisionImpulseThreshold;
        const speedForMax =
            cfg?.speedForMax ??
            this._options.collisionSpeedForMaxParticles ??
            15;

        this._disposeSquashStretch = attachCollisionSquashStretch(
            this._scene,
            this.ball,
            this.aggregate.body as any,
            {
                impulseThreshold,
                speedForMax,
                durationSeconds: cfg?.durationSeconds,
                cooldownSeconds: cfg?.cooldownSeconds,
                maxStretch: cfg?.maxStretch,
                maxSquash: cfg?.maxSquash,
                impactPortion: cfg?.impactPortion,
                enabled: cfg?.enabled,
            },
        );
    }

    private _wireCollisionScaleReactionUtility() {
        const cfg = this._options.collisionScaleReaction;
        if (cfg?.enabled === false) {
            return;
        }

        const impulseThreshold =
            cfg?.impulseThreshold ?? this._options.collisionImpulseThreshold;
        const speedForMax =
            cfg?.speedForMax ??
            this._options.collisionSpeedForMaxParticles ??
            15;

        this._disposeScaleReaction = attachCollisionScaleReaction(
            this._scene,
            this.ball,
            this.aggregate.body as any,
            {
                impulseThreshold,
                speedForMax,
                durationSeconds: cfg?.durationSeconds,
                cooldownSeconds: cfg?.cooldownSeconds,
                maxScaleAdd: cfg?.maxScaleAdd,
                impactPortion: cfg?.impactPortion,
                enabled: cfg?.enabled,
            },
        );
    }

    private _wireSpeedTrailUtility() {
        const cfg = this._options.speedTrail;
        if (cfg?.enabled === false) {
            return;
        }

        const speedOn = cfg?.speedOn ?? 10;
        const speedOff = cfg?.speedOff ?? speedOn * 0.8;
        const speedForMax = cfg?.speedForMax ?? Math.max(speedOn, 1) * 1.6;

        const handle = attachSpeedTrail(
            this._scene,
            this.ball,
            () => this.aggregate.body.getLinearVelocity(),
            {
                enabled: cfg?.enabled,
                speedOn,
                speedOff,
                speedForMax,
                emitRateMin: cfg?.emitRateMin,
                emitRateMax: cfg?.emitRateMax,
                sizeMin: 0.05,
                sizeMax: 0.4,
                lifeMin: 0.1,
                lifeMax: 0.25,
                spread: cfg?.spread,
                backwardPowerMax: cfg?.backwardPowerMax,
                textureUrl: cfg?.textureUrl,
                color1: cfg?.color1,
                color2: cfg?.color2,
                colorDead: cfg?.colorDead,
                ribbonWidth: 0.75,
            },
        );

        this._disposeSpeedTrail = handle.dispose;
    }

    private _wireClickToMove() {
        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
                return;
            }

            const pick = this._scene.pick(
                this._scene.pointerX,
                this._scene.pointerY,
                (mesh) => mesh === this._ground,
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
            const forceMagnitude =
                // this._options.clickForce * this._options.ballMass * distance;
                this._options.clickForce * this._options.ballMass * distance;
            const force = dirNorm.scale(forceMagnitude);

            this.aggregate.body.applyForce(force, this.ball.position);
        });
    }
}
