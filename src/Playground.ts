import {
  Camera,
  Engine,
  FreeCamera,
  HavokPlugin,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
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

    // Simple lighting
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // Tunable player parameters (passed into Player)
    const ballMass = 1;
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

    const player = new Player(scene, ground, {
      spawnPoint,
      fallThresholdY: -5,
      ballMass,
      clickForce,
      collisionImpulseThreshold,
      ballDiameter: 1.5,
      collisionScaleReaction: {
        enabled: true,
        // Tune these to taste
        maxScaleAdd: 0.28, // peak scale = 1 + this
        durationSeconds: 0.16,
        impactPortion: 0.25,
        cooldownSeconds: 0.07,
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

    // Camera follow with linear interpolation (lerp)
    const cameraOffset = camera.position.subtract(Vector3.Zero());
    const followLerp = 0.1; // 0–1, higher = snappier follow

    // Let player snap the camera on respawn
    player.setCameraForRespawnSnap(camera, cameraOffset);

    buildPlaygroundMap(scene, { halfSize: 40 });

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