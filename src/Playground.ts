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
    ImportMeshAsync,
    ISceneLoaderAsyncResult,
    LensRenderingPipeline,
    Mesh,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    ShadowGenerator,
    SSAO2RenderingPipeline,
    SSAORenderingPipeline,
    StandardMaterial,
    Texture,
    UniversalCamera,
    Vector3,
} from "@babylonjs/core";
import { buildPlaygroundMap } from "./maps/map_playground";
import { Player } from "./player/Player";
import { createCameraShake } from "./utility/CameraShake";
import { NPC } from "./prefabs/NPC";
import { addTag } from "./utility/EntityTag";
import { EntityTags } from "./utility/EntityTags";
import * as GUI from "@babylonjs/gui";
import {
    attachTriggerSphere,
    createDisplayTag,
    ImportCustomModel,
    transitionToCamera,
    Vector3DegreesToRadians,
} from "./utility/UtilityFunctions";

import { createBentoLayout } from "./utility/BentoBoxLayout";
import { ProjectNPC } from "./prefabs/NPCs/ProjectNPC";
import { attachBobbing } from "./utility/Bobbing";

var playgroundScene = function (
    engine: Engine,
    canvas: HTMLCanvasElement,
    hk: HavokPlugin,
) {
    var scene = new Scene(engine);

    const distanceXZ = 24;
    const heightY = Math.SQRT2 * distanceXZ; // ensures 45° down tilt toward target

    const camera = new UniversalCamera(
        "orthoIsoCamera",
        new Vector3(distanceXZ, heightY, distanceXZ),
        scene,
    );
    camera.setTarget(Vector3.Zero());

    // var depthOffield = new LensRenderingPipeline(
    //     "lens",
    //     {
    //         edge_blur: 1,
    //         chromatic_aberration: 1,
    //         distortion: 1,
    //         dof_focus_distance: 40,
    //         dof_aperture: 2.0, // set this very high for tilt-shift effect
    //         // grain_amount: 1.0,
    //         dof_pentagon: true,
    //         dof_gain: 1.0,
    //         dof_threshold: 1.0,
    //         dof_darken: 0.25,
    //     },
    //     scene,
    //     1,
    //     [camera],
    // );

    // Gentle purple/orange lighting + soft shadows
    const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
    fill.intensity = 0.5;
    fill.diffuse = new Color3(0.8, 0.76, 0.95);
    fill.groundColor = new Color3(0.9, 0.7, 0.5);
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
    ground.isVisible = false;

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

    const npcs: ProjectNPC[] = [];

    const npc_fishGame = new ProjectNPC(
        {
            npcName: "Dumbass Fish Game",
            modelPosition: new Vector3(17, 0, -45),
            modelRotation: new Vector3(0, -90, 0),
            player,
            camera,
            cameraOffset: new Vector3(13, 3, 13),
            onTriggerEnter: () => {
                hideAllExcept(npc_fishGame);
            },

            onTriggerExit: () => {
                showAll();
            },
        },
        scene,
        shadows,
    );

    const npc_vizion = new ProjectNPC(
        {
            npcName: "Vizion",
            modelName: "Vizion",
            textureName: "/textures/Vizion.png",
            modelPosition: new Vector3(35, 0.5, -50),
            modelRotation: new Vector3(0, 15, 0),
            player,
            camera,
            cameraOffset: new Vector3(10, 3, 13),
            gameUrl: "https://unscriptedlogic.itch.io/vizion",
            gameDescription:
                "To see is to have the information, to hear is to have the step ahead. To execute, now that's up to you. A game created for the Mix and Game Jam 2020.",
            description:
                "Vizion was my first step into the world of shaders, learning about the Z-index, stencils and depth passes. The dark magic that elevates visuals to a different dimension. This game was centered around this 1 shader that I learned how to make and just went with it. The horror aspect of the game is, little to none. At the most you'll be slightly unsettled by the audio. It was a fun experiment and I'm glad I made it.",
            textBlockOffset: new Vector3(5.25, 1.75, -5.25),
            thumbnailImage: "/images/Vizion/Thumbnail.png",
            bentoImages: [
                { src: "/images/Vizion/Video2.mp4", colSpan: 3, rowSpan: 3 },
                { src: "/images/Vizion/Image1.jpg", colSpan: 1, rowSpan: 1 },
                { src: "/images/Vizion/Image2.jpg", colSpan: 2, rowSpan: 2 },
                { src: "/images/Vizion/Video1.mp4", colSpan: 5, rowSpan: 5 },
                { src: "/images/Vizion/Image3.jpg", colSpan: 3, rowSpan: 3 },
                { src: "/images/Vizion/Image4.jpg", colSpan: 2, rowSpan: 2 },
            ],
            onTriggerEnter: () => {
                console.log("Entered Vizion trigger");
                hideAllExcept(npc_vizion);
            },

            onTriggerExit: () => {
                showAll();
            },
        },
        scene,
        shadows,
    );
    const npc_memoryLooper = new ProjectNPC(
        {
            npcName: "Memory Looper",
            modelName: "MemoryLooper",
            textureName: "/textures/MemoryLooper.png",
            modelPosition: new Vector3(50, 0.5, -47),
            modelRotation: new Vector3(0, 0, 0),
            player,
            camera,
            cameraOffset: new Vector3(3, 3, 18),
            cameraTargetOffset: new Vector3(4, 6, 0),
            gameUrl: "https://unscriptedlogic.itch.io/memory-looper",
            gameDescription:
                "It seems like we've been here before. Shall we help each other out? A game created using Blender and Unity for the Mini Jam 2020.",
            description:
                "Memory Looper was a fun one. The core mechanic is simple. You hit a spark that starts recording your actions and memorizes them. Then replays them in real time. You can use this to solve puzzles that require multiple actions at once. The game is a bit rough around the edges but I'm proud of the core mechanic and how the levels turned out. Just ignore the scattered cringy notes I left around the levels. I was in a very different headspace back then.",
            textBlockOffset: new Vector3(8, 1.75, -4),
            textBlockRotation: new Vector3(0, 170, 0.5),
            bentoOffset: new Vector3(8, 8.5, -4),
            bentoRotation: new Vector3(-5, 170, 0),
            thumbnailOffset: new Vector3(-3, 8, -3),
            thumbnailRotation: new Vector3(0, 210, 0),
            thumbnailImage: "/images/MemoryLooper/Thumbnail.png",
            bentoImages: [
                {
                    src: "/images/MemoryLooper/Image1.png",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/MemoryLooper/Video2.mp4",
                    colSpan: 3,
                    rowSpan: 3,
                },
                {
                    src: "/images/MemoryLooper/Image2.png",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/MemoryLooper/Image3.png",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/MemoryLooper/Image4.png",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/MemoryLooper/Video1.mp4",
                    colSpan: 4,
                    rowSpan: 4,
                },
            ],
            onTriggerEnter: () => {
                hideAllExcept(npc_memoryLooper);
            },

            onTriggerExit: () => {
                showAll();
            },
        },
        scene,
        shadows,
    );
    const npc_unnamedtd = new ProjectNPC(
        {
            npcName: "Unnamed TD",
            modelName: "UnnamedTD",
            modelOutlineWidth: 0.05,
            textureName: "/textures/UnnamedTD.png",
            modelPosition: new Vector3(-44, 0.5, -14),
            modelRotation: new Vector3(0, 180, 0),
            player,
            camera,
            thumbnailRotation: new Vector3(0, 230, 0),
            bentoOffset: new Vector3(6, 7.5, -7),
            cameraOffset: new Vector3(13, 3, 13),
            gameUrl: "https://unscriptedlogic.itch.io/unnamed-tower-defence",
            gameDescription:
                "What if the maps on a tower defense game was procedurally generated? A game created using Blender and Unity",
            description:
                "I hold this project dear in my heart as one of my earliest best games. A simple tower defence game with procedurally generated maps and balance just the way I like it. It was originally made of a school project about utilizing Microsoft Azure but I loved making it so much that I kept on adding way more visually and mechanically. If there's any project I am proud of, it's this one.",
            thumbnailImage: "/images/unnamedtd/Thumbnail.png",
            bentoImages: [
                { src: "/images/unnamedtd/Image1.png", colSpan: 2, rowSpan: 2 },
                { src: "/images/unnamedtd/Video2.mp4", colSpan: 4, rowSpan: 4 },
                { src: "/images/unnamedtd/Image2.png", colSpan: 2, rowSpan: 2 },
                { src: "/images/unnamedtd/Image3.png", colSpan: 2, rowSpan: 2 },
                { src: "/images/unnamedtd/Video1.mp4", colSpan: 3, rowSpan: 3 },
                { src: "/images/unnamedtd/Image4.png", colSpan: 2, rowSpan: 2 },
            ],
        },
        scene,
        shadows,
        {
            freezeWorldMatrix: false,
        },
    );

    const npc_momentumMayhem = new ProjectNPC(
        {
            npcName: "Momentum Mayhem",
            modelName: "Momentum",
            modelOutlineWidth: 0.025,
            textureName: "/textures/Momentum.png",
            modelPosition: new Vector3(-46, 0.5, 13),
            modelRotation: new Vector3(0, 180, 0),
            player,
            camera,
            thumbnailRotation: new Vector3(0, 230, 0),
            bentoOffset: new Vector3(6, 6, -7),
            cameraOffset: new Vector3(13, 3, 13),
            gameUrl:
                "https://store.steampowered.com/app/3051110/Momentum_Mayhem/?beta=0",
            gameDescription:
                "A casual 2.5D physics oriented game about building unorthodox contraptions to solve puzzles with a variety of items at disposal. Made with Blender and Unity.",
            description:
                "My take on the old game 'The Incredible Machine'. If there's one thing this project's taught me, it was game design. What the core juice of a game is and how to build around it. Up until before this project, I've always followed an instinct of what a game should have for it to be fun and while that is a good thing to have, it's also important to fundamentally identify in concrete terms what your game is and fill in the gaps with your instincts.",
            thumbnailImage: "/images/Momentum/Thumbnail.jpg",
            bentoImages: [
                { src: "/images/Momentum/Video3.mp4", colSpan: 2, rowSpan: 2 },
                { src: "/images/Momentum/Image2.jpg", colSpan: 2, rowSpan: 2 },
                { src: "/images/Momentum/Image1.jpg", colSpan: 2, rowSpan: 2 },
                { src: "/images/Momentum/Video4.mp4", colSpan: 2, rowSpan: 2 },
                { src: "/images/Momentum/Video1.mp4", colSpan: 3, rowSpan: 3 },
                { src: "/images/Momentum/Video2.mp4", colSpan: 4, rowSpan: 4 },
            ],
            onTriggerEnter: () => {
                hideAllExcept(npc_momentumMayhem);
            },

            onTriggerExit: () => {
                showAll();
            },
        },
        scene,
        shadows,
    );

    const npc_autoPetRacers = new ProjectNPC(
        {
            npcName: "Auto Pet Racers",
            modelName: "AutoPetRacers",
            modelOutlineWidth: 0.025,
            textureName: "/textures/AutoPetRacers.png",
            modelPosition: new Vector3(-54, 0.5, 0),
            modelRotation: new Vector3(0, 170, 0),
            player,
            camera,
            cameraOffset: new Vector3(20, 3, 5),
            cameraTargetOffset: new Vector3(0, 6, -5),
            gameUrl:
                "https://store.steampowered.com/app/4135220/Auto_Pet_Racers/",
            gameDescription:
                "A 2.5D pet racing simulator where you train your pets to run fast and hit hard. Build their speed to outrun the pack or train their wisdom to proc abilities that debuff others..",
            description:
                "The surreal moment of watching a youtube video of people enjoying your own game cannot be explained. I learned how to use UE5 and their blueprint and GamePlay Tag systems. I learned to find pitfalls in my game design, to draft up decision trees and find out what they might want. I learned to balance with excel sheets. I learned a lot about what I like to put in my games and what I want to avoid. A burnout project turned passion and success.",
            thumbnailImage: "/images/AutoPetRacers/Thumbnail.jpg",
            thumbnailOffset: new Vector3(-2, 8.5, 4),
            thumbnailRotation: new Vector3(0, 280, 0),
            bentoOffset: new Vector3(4.5, 6, -7.5),
            bentoRotation: new Vector3(0, 230, 0),
            textBlockRotation: new Vector3(0, 230, 0),
            textBlockOffset: new Vector3(4.5, 1.75, -7.5),
            bentoImages: [
                {
                    src: "/images/AutoPetRacers/Video3.mp4",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/AutoPetRacers/Image2.jpg",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/AutoPetRacers/Image3.jpg",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/AutoPetRacers/Video2.mp4",
                    colSpan: 4,
                    rowSpan: 4,
                },
                {
                    src: "/images/AutoPetRacers/Image4.jpg",
                    colSpan: 2,
                    rowSpan: 2,
                },
                {
                    src: "/images/AutoPetRacers/Video1.mp4",
                    colSpan: 3,
                    rowSpan: 3,
                },
            ],
            onTriggerEnter: () => {
                hideAllExcept(npc_autoPetRacers);
            },

            onTriggerExit: () => {
                showAll();
            },
        },
        scene,
        shadows,
    );

    npcs.push(
        npc_fishGame,
        npc_vizion,
        npc_memoryLooper,
        npc_unnamedtd,
        npc_momentumMayhem,
        npc_autoPetRacers,
    );

    const hideAllExcept = (npcToShow: ProjectNPC) => {
        for (const npc of npcs) {
            npc.setVisibility(npc === npcToShow);
        }
    };

    const showAll = () => {
        for (const npc of npcs) {
            npc.setVisibility(true);
        }
    };

    ImportCustomModel("maxwell", scene).then(
        (result: ISceneLoaderAsyncResult) => {
            const maxwell = result.meshes[0] as Mesh;
            maxwell.position = new Vector3(72, 2, -75);
            maxwell.rotation = Vector3DegreesToRadians(new Vector3(0, 45, 0));
            maxwell.scaling = new Vector3(1, 1, 1).scale(0.2);
            maxwell.renderOutline = true;
            maxwell.outlineWidth = 0.05;

            shadows.addShadowCaster(maxwell);

            attachBobbing(maxwell, {
                enabled: true,
                amplitude: 0.5,
                speed: 0.5,
            });

            //perpetual spinning rotation
            scene.onBeforeRenderObservable.add(() => {
                maxwell.rotation.y += 0.015;
            });
        },
    );

    //optimzations
    scene.autoClear = false; // Color buffer
    scene.autoClearDepthAndStencil = false; // Depth and stencil, obviously
    scene.blockMaterialDirtyMechanism = true;

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
