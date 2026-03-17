import {
  Camera,
  Color3,
  DirectionalLight,
  Engine,
  FreeCamera,
  HavokPlugin,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { buildPlaygroundMap } from "./maps/map_playground";
import { Player } from "./player/Player";

var playgroundScene = function (engine: Engine, canvas: HTMLCanvasElement, hk: HavokPlugin) {
    var scene = new Scene(engine);

    const distanceXZ = 12;
    const heightY = Math.SQRT2 * distanceXZ; // ensures 45° down tilt toward target

    const camera = new FreeCamera(
      "orthoIsoCamera",
      new Vector3(distanceXZ, heightY, distanceXZ),
      scene
    );
    camera.setTarget(Vector3.Zero());

    // Gentle purple/orange lighting + soft shadows
    const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
    fill.intensity = 0.5;
    // Slight tint (subtle, not overpowering)
    fill.diffuse = new Color3(0.80, 0.76, 0.95);
    fill.groundColor = new Color3(0.72, 0.62, 0.78);
    fill.specular = new Color3(0.06, 0.06, 0.07);

    const key = new DirectionalLight(
      "key",
      // More side-lit so shadows read from the isometric camera.
      new Vector3(-0.9, -1, 0.05),
      scene
    );
    key.position = new Vector3(34, 38, -6);
    key.intensity = 0.95;
    key.diffuse = new Color3(1.0, 0.78, 0.62); // softer warm key
    key.specular = new Color3(0.15, 0.12, 0.10);

    const shadows = new ShadowGenerator(2048, key);
    shadows.useBlurExponentialShadowMap = true;
    // More defined (less blurry) while still soft.
    shadows.blurKernel = 16;
    shadows.depthScale = 60;
    shadows.setDarkness(0.25); // a bit more defined

    // Tunable player parameters (passed into Player)
    const ballMass = 10;
    const clickForce = 14;
    const collisionImpulseThreshold = 2.5;

    // Ground and ball with Havok physics
    // Enable physics with gravity
    scene.enablePhysics(new Vector3(0, -25, 0), hk);

    // Spawn point for the player (tunable)
    const spawnPoint = new Vector3(0, 10, 0);

    // Ground (static)
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 80, height: 80 },
      scene
    );
    ground.receiveShadows = true;

    const player = new Player(scene, ground, {
      spawnPoint,
      fallThresholdY: -5,
      ballMass,
      clickForce,
      collisionImpulseThreshold,
      ballDiameter: 1.5,
      toon: {
        enabled: true,
        lightName: "key",
        steps: 3,
        hardness: 1.45,
        rimStrength: 0.16,
        rimPower: 2.2,
      },
      outline: {
        enabled: true,
        width: 0.045,
        color: new Color3(0.10, 0.06, 0.16),
      },
      collisionScaleReaction: {
        enabled: true,
        // Tune these to taste
        maxScaleAdd: 0.28, // peak scale = 1 + this
        durationSeconds: 0.16,
        impactPortion: 0.25,
        cooldownSeconds: 0.07,
      },
      speedTrail: {
        enabled: true,
        speedOn: 9,
        speedOff: 7,
        speedForMax: 18,
        followRotation: false,
        ribbonVertical: true,
        // Particles are now an accent; the ribbon is the main read.
        particlesEnabled: true,
        emitRateMax: 180,
        sizeMin: 0.06,
        sizeMax: 0.14,
        lifeMin: 0.05,
        lifeMax: 0.1,
        spread: 0.55,
        backwardPowerMax: 8.5,

        ribbonEnabled: true,
        ribbonWidth: 1.1,
        ribbonLength: 85,
        ribbonAlpha: 0.85,
      },
      // The original axis-based squash/stretch is still available too:
      // collisionSquashStretch: { enabled: true, maxStretch: 0.35, maxSquash: 0.22 },
    });

    // Physics aggregates
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.BOX,
      { mass: 0, restitution: 0.2 },
      scene
    );

    // Shadows: player casts
    shadows.addShadowCaster(player.ball, true);

    // Camera follow with linear interpolation (lerp)
    const cameraOffset = camera.position.subtract(Vector3.Zero());
    const followLerp = 0.1; // 0–1, higher = snappier follow

    // Let player snap the camera on respawn
    player.setCameraForRespawnSnap(camera, cameraOffset);

    const mapMeshes = buildPlaygroundMap(scene, { halfSize: 40 });
    for (const m of mapMeshes) {
      m.receiveShadows = true;
      shadows.addShadowCaster(m, true);
    }

    scene.onBeforeRenderObservable.add(() => {
      player.update();

      const targetPos = player.position;
      const desiredPos = targetPos.add(cameraOffset);

      camera.position = Vector3.Lerp(camera.position, desiredPos, followLerp);
      camera.setTarget(
        Vector3.Lerp(camera.getTarget(), targetPos, followLerp)
      );
    });

    // Optional: attach controls if you still want mouse focus, but keep the camera static.
    // camera.attachControl(canvas, true);

    return scene;
};

export default playgroundScene