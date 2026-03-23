import {
    ActionManager,
    Camera,
    CascadedShadowGenerator,
    Color3,
    DirectionalLight,
    Engine,
    ExecuteCodeAction,
    FreeCamera,
    HavokPlugin,
    HemisphericLight,
    ISceneLoaderAsyncResult,
    LensRenderingPipeline,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    ShadowGenerator,
    SSAO2RenderingPipeline,
    SSAORenderingPipeline,
    Texture,
    Vector3,
} from "@babylonjs/core";
import { buildPlaygroundMap } from "./maps/map_playground";
import { Player } from "./player/Player";
import { createCameraShake } from "./utility/CameraShake";
import { NPC } from "./prefabs/NPC";
import { addTag } from "./utility/EntityTag";
import { EntityTags } from "./utility/EntityTags";
import {
    attachTriggerSphere,
    createDisplayTag,
    ImportCustomModel,
} from "./utility/UtilityFunctions";

var playgroundScene = function (
    engine: Engine,
    canvas: HTMLCanvasElement,
    hk: HavokPlugin,
) {
    var scene = new Scene(engine);

    const distanceXZ = 24;
    const heightY = Math.SQRT2 * distanceXZ; // ensures 45° down tilt toward target

    const camera = new FreeCamera(
        "orthoIsoCamera",
        new Vector3(distanceXZ, heightY, distanceXZ),
        scene,
    );
    camera.setTarget(Vector3.Zero());

    var depthOffield = new LensRenderingPipeline(
        "lens",
        {
            edge_blur: 1,
            chromatic_aberration: 1,
            distortion: 1,
            dof_focus_distance: 40,
            dof_aperture: 2.0, // set this very high for tilt-shift effect
            // grain_amount: 1.0,
            dof_pentagon: true,
            dof_gain: 1.0,
            dof_threshold: 1.0,
            dof_darken: 0.25,
        },
        scene,
        1,
        [camera],
    );

    // Gentle purple/orange lighting + soft shadows
    const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
    fill.intensity = 0.5;
    fill.diffuse = new Color3(0.8, 0.76, 0.95);
    fill.groundColor = new Color3(0.72, 0.62, 0.78);
    fill.specular = new Color3(0.06, 0.06, 0.07);

    const key = new DirectionalLight(
        "key",
        // More side-lit so shadows read from the isometric camera.
        new Vector3(-0.9, -1, 0.05),
        scene,
    );
    key.position = new Vector3(34, 38, -6);
    key.intensity = 1;
    key.diffuse = new Color3(1.0, 0.78, 0.62); // softer warm key
    key.specular = new Color3(0.15, 0.12, 0.1);

    const shadows = new ShadowGenerator(1024, key);
    shadows.useBlurExponentialShadowMap = true;
    // More defined (less blurry) while still soft.
    // shadows.blurKernel = 16;
    shadows.depthScale = 60;
    shadows.setDarkness(0); // a bit more defined

    // Tunable player parameters (passed into Player)
    const ballMass = 10;
    const clickForce = 10;
    const collisionImpulseThreshold = 2.5;

    // Ground and ball with Havok physics
    // Enable physics with gravity
    scene.enablePhysics(new Vector3(0, -25, 0), hk);

    // Spawn point for the player (tunable)
    const spawnPoint = new Vector3(0, 5, 0);

    // Ground (static)
    const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 1000, height: 1000 },
        scene,
    );
    ground.isVisible = false; // hide the ground mesh; we can still see its shadow and it will interact with physics

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
            color: new Color3(0.1, 0.06, 0.16),
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
        { mass: 0, restitution: 0.2, friction: 1 },
        scene,
    );

    // Shadows: player casts
    shadows.addShadowCaster(player.ball, true);

    // Camera follow with linear interpolation (lerp)
    const cameraOffset = camera.position.subtract(Vector3.Zero());
    const followLerp = 0.1; // 0–1, higher = snappier follow

    // Let player snap the camera on respawn
    player.setCameraForRespawnSnap(camera, cameraOffset);

    // Tiny impact camera shake (toggleable)
    const cameraShake = createCameraShake(scene, {
        enabled: true,
        maxOffset: 0.5,
        decayPerSecond: 1,
        cooldownSeconds: 0.05,
    });

    player.onImpactObservable.add((ev) => {
        // keep it subtle; strength already 0..1 from speed scaling
        cameraShake.kick(ev.strength * 0.6);
    });

    const mapMeshes = buildPlaygroundMap(
        scene,
        { halfSize: 40 },
        player.getmesh(),
        shadows,
    );

    // testNPC.enablePhsyics(0);
    ImportCustomModel("StupidFuckingFish", scene).then(
        (result: ISceneLoaderAsyncResult) => {
            const npc_fishGame = new NPC(
                { npcName: "Dumbass Fish Game" },
                scene,
                shadows,
            );

            npc_fishGame.setModel(result.meshes, 1.5);
            npc_fishGame.setPosition({ x: 17, y: 0, z: -40 });
            npc_fishGame.setrotation({ x: 0, y: -90, z: 0 });
            const texture = new Texture(
                "/textures/FishWithLegs.png",
                scene,
                true,
                true,
                Texture.NEAREST_SAMPLINGMODE,
            );
            texture.vScale = -1;
            texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
            npc_fishGame.setTexture(texture);

            createDisplayTag(
                npc_fishGame.data.npcName,
                npc_fishGame.meshes[0],
                scene,
                { offset: new Vector3(0, -6, 0) },
            );

            var timer: ReturnType<typeof setTimeout>;
            attachTriggerSphere(
                npc_fishGame.meshes[0],
                [player.getmesh()],
                scene,
                {
                    radius: 6,
                    onEnter: () => {
                        console.log("Entered!");

                        timer = setTimeout(() => {
                            alert(
                                "Congratulations! You found the secret fish game easter egg! 🐟🎮",
                            );

                            //stop the player from all movement for quality of life
                            player.aggregate.body.setLinearVelocity(
                                new Vector3(0, 0, 0),
                            );
                            player.aggregate.body.setAngularVelocity(
                                new Vector3(0, 0, 0),
                            );
                        }, 1000);
                    },
                    onExit: () => {
                        console.log("Exit!");

                        clearTimeout(timer);
                    },
                },
            );
        },
    );

    // ImportCustomModel()

    scene.onBeforeRenderObservable.add(() => {
        player.update();

        const targetPos = player.position;
        const desiredPos = targetPos.add(cameraOffset);

        camera.position = Vector3.Lerp(camera.position, desiredPos, followLerp);
        const shakeOffset = cameraShake.getOffset();
        camera.position.addInPlace(shakeOffset);
        camera.setTarget(
            Vector3.Lerp(camera.getTarget(), targetPos, followLerp),
        );
    });

    return scene;
};

export default playgroundScene;
