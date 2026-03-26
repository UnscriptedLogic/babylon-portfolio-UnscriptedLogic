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

    //NPCs
    // ImportCustomModel("StupidFuckingFish", scene).then(
    //     (result: ISceneLoaderAsyncResult) => {
    //         const npc_fishGame = new NPC(
    //             { npcName: "Dumbass Fish Game" },
    //             scene,
    //             shadows,
    //         );

    //         npc_fishGame.setModel(result.meshes, 1.5);
    //         npc_fishGame.setPosition({ x: 17, y: 0, z: -40 });
    //         npc_fishGame.setrotation({ x: 0, y: -90, z: 0 });
    //         const texture = new Texture(
    //             "/textures/FishWithLegs.png",
    //             scene,
    //             true,
    //             true,
    //             Texture.NEAREST_SAMPLINGMODE,
    //         );
    //         texture.vScale = -1;
    //         texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    //         npc_fishGame.setTexture(texture);

    //         var displayTag = createDisplayTag(
    //             npc_fishGame.data.npcName,
    //             npc_fishGame.meshes[0],
    //             scene,
    //             { offset: new Vector3(0, -6, 0) },
    //         );

    //         //setup individual NPC camera
    //         var fishCamera = new UniversalCamera(
    //             "npcCamera",
    //             new Vector3(32, 3, -30),
    //             scene,
    //         );
    //         fishCamera.setTarget(
    //             npc_fishGame.meshes[0].position.add(new Vector3(0, 6, -10)),
    //         );

    //         var timer: ReturnType<typeof setTimeout>;
    //         var escapeListener: (ev: KeyboardEvent) => void;
    //         var inspected = false;
    //         var meshesToToggleOnInspect: Mesh[] = [];
    //         attachTriggerSphere(
    //             npc_fishGame.meshes[0],
    //             [player.getmesh()],
    //             scene,
    //             {
    //                 radius: 5,
    //                 onEnter: () => {
    //                     timer = setTimeout(() => {
    //                         inspected = true;

    //                         transitionToCamera(
    //                             fishCamera,
    //                             npc_fishGame.meshes[0].position.add(
    //                                 new Vector3(0, 6, -8),
    //                             ),
    //                             1,
    //                         );
    //                         displayTag.isVisible = false;

    //                         player.freeze();

    //                         ImportMeshAsync(
    //                             `/models/CurvedPlane.glb`,
    //                             scene,
    //                         ).then((res) => {
    //                             const root = res.meshes[0];
    //                             const plane = res.meshes[1] as Mesh;
    //                             meshesToToggleOnInspect.push(plane);
    //                             root.position =
    //                                 npc_fishGame.meshes[0].position.add(
    //                                     new Vector3(6, 6.5, -7),
    //                                 );
    //                             root.scaling = new Vector3(2.5, 1.5, 1.5);

    //                             root.rotation = Vector3DegreesToRadians(
    //                                 new Vector3(-5, 200, 0),
    //                             );

    //                             var advancedTexture =
    //                                 GUI.AdvancedDynamicTexture.CreateForMesh(
    //                                     plane,
    //                                     1024,
    //                                     1024,
    //                                 );

    //                             createBentoLayout(
    //                                 plane,
    //                                 [
    //                                     {
    //                                         src: "/images/FishGame/Image1.png",
    //                                         colSpan: 2,
    //                                         rowSpan: 2,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/Image2.png",
    //                                         colSpan: 2,
    //                                         rowSpan: 2,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/DFG_Vid1.mp4",
    //                                         colSpan: 4,
    //                                         rowSpan: 4,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/Image3.png",
    //                                         colSpan: 3,
    //                                         rowSpan: 3,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/Image4.png",
    //                                         colSpan: 1,
    //                                         rowSpan: 1,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/DFG_Vid2.mp4",
    //                                         colSpan: 3,
    //                                         rowSpan: 3,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/Image5.png",
    //                                         colSpan: 2,
    //                                         rowSpan: 2,
    //                                     },
    //                                     {
    //                                         src: "/images/FishGame/Image6.png",
    //                                         colSpan: 1,
    //                                         rowSpan: 1,
    //                                     },
    //                                 ],
    //                                 {
    //                                     columns: 8,
    //                                     rows: 8,
    //                                     gap: 8,
    //                                     padding: 6,
    //                                     cornerRadius: 0,
    //                                     textureWidth: 1024,
    //                                     textureHeight: 1024,

    //                                     cellBorder: {
    //                                         color: "#ffddaa",
    //                                         thickness: 0,
    //                                         alpha: 0.25,
    //                                     },
    //                                     entrance: {
    //                                         durationMs: 380 * 4,
    //                                         staggerMs: 65 * 4,
    //                                         slidePixels: 44 * 4,
    //                                     },
    //                                     float: {
    //                                         amplitudePx: 4,
    //                                         periodMs: 3000,
    //                                         phaseOffsetMs: 350,
    //                                     },
    //                                 },
    //                             );
    //                         });

    //                         ImportMeshAsync(
    //                             "/models/CurvedPlane.glb",
    //                             scene,
    //                         ).then((res) => {
    //                             const root = res.meshes[0];
    //                             const infoPlane = res.meshes[1] as Mesh;
    //                             meshesToToggleOnInspect.push(infoPlane);
    //                             root.position =
    //                                 npc_fishGame.meshes[0].position.add(
    //                                     new Vector3(6.5, 1.75, -6.5),
    //                                 );
    //                             root.scaling = new Vector3(1, 1.1, 1).scale(2);

    //                             root.rotation = Vector3DegreesToRadians(
    //                                 new Vector3(0, 200, 0.5),
    //                             );

    //                             var advancedTexture =
    //                                 GUI.AdvancedDynamicTexture.CreateForMesh(
    //                                     infoPlane,
    //                                 );

    //                             //background colour
    //                             const rect = new GUI.Rectangle();
    //                             rect.width = "100%";
    //                             rect.height = "25%";
    //                             rect.background = "#171717";
    //                             rect.alpha = 0.5;
    //                             rect.cornerRadius = 6;

    //                             advancedTexture.addControl(rect);

    //                             const textBlock = new GUI.TextBlock();
    //                             textBlock.text =
    //                                 "This project serves as a personal reminder that the experience conveyed is often more valuable than the game itself. Made solely for the memes, this is my joke game that became my best performing game jam submission. Scoring 84th in a 500 submission game jam, this is my 'this did well somehow' project I will never forget.";
    //                             textBlock.fontFamily = "Mustica";
    //                             textBlock.fontSize = 30;
    //                             textBlock.color = "#ffffff";
    //                             textBlock.outlineWidth = 4;
    //                             textBlock.outlineColor = "#000000";
    //                             textBlock.textWrapping =
    //                                 GUI.TextWrapping.WordWrap;
    //                             textBlock.width = "100%";
    //                             textBlock.height = "100%";
    //                             var padding = 24;
    //                             textBlock.paddingTop = padding + "px";
    //                             textBlock.paddingRight = padding + "px";
    //                             textBlock.paddingBottom = padding + "px";
    //                             textBlock.paddingLeft = padding + "px";
    //                             textBlock.verticalAlignment =
    //                                 GUI.Control.VERTICAL_ALIGNMENT_TOP;

    //                             advancedTexture.addControl(textBlock);
    //                         });
    //                         ImportMeshAsync(
    //                             "/models/CurvedPlane.glb",
    //                             scene,
    //                         ).then((res) => {
    //                             const root = res.meshes[0];
    //                             const thumbnailPlane = res.meshes[1] as Mesh;
    //                             meshesToToggleOnInspect.push(thumbnailPlane);

    //                             root.position =
    //                                 npc_fishGame.meshes[0].position.add(
    //                                     new Vector3(-2, 8, 0),
    //                                 );
    //                             root.rotation = Vector3DegreesToRadians(
    //                                 new Vector3(0, 240, -2),
    //                             );
    //                             root.scaling = new Vector3(1, 1, 1).scale(1);

    //                             var advancedTexture =
    //                                 GUI.AdvancedDynamicTexture.CreateForMesh(
    //                                     thumbnailPlane,
    //                                 );

    //                             //background colour
    //                             const rect = new GUI.Rectangle();
    //                             rect.width = "100%";
    //                             rect.height = "100%";
    //                             rect.background = "#171717";
    //                             rect.alpha = 0.9;
    //                             rect.paddingRight = "12px";

    //                             //border radius
    //                             rect.cornerRadius = 12;

    //                             advancedTexture.addControl(rect);

    //                             //game thumbnail
    //                             const thumb = new GUI.Image();
    //                             thumb.source = "/images/FishGame/Thumbnail.png";

    //                             thumb.width = "100%";
    //                             thumb.height = "75%";
    //                             thumb.stretch = GUI.Image.STRETCH_UNIFORM;

    //                             thumb.verticalAlignment =
    //                                 GUI.Control.VERTICAL_ALIGNMENT_TOP;
    //                             thumb.horizontalAlignment =
    //                                 GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    //                             advancedTexture.addControl(thumb);

    //                             thumb.onPointerClickObservable.add(() => {
    //                                 window.open(
    //                                     "https://unscriptedlogic.itch.io/dumbass-fish-game",
    //                                     "_blank",
    //                                 );
    //                             });

    //                             //change cursor to show clickable
    //                             thumb.onPointerEnterObservable.add(() => {
    //                                 document.body.style.cursor = "pointer";

    //                                 //tint green when hovering
    //                                 rect.color = "#00ff00";
    //                                 rect.thickness = 16;
    //                             });
    //                             thumb.onPointerOutObservable.add(() => {
    //                                 document.body.style.cursor = "default";

    //                                 rect.color = "#171717";
    //                                 rect.thickness = 0;
    //                             });

    //                             //padding
    //                             const padding = 48;
    //                             thumb.paddingTop = `${padding + 78}px`;
    //                             thumb.paddingBottom = `${padding}px`;
    //                             thumb.paddingLeft = `${padding}px`;
    //                             thumb.paddingRight = `${padding}px`;

    //                             //Play The Game Text Header
    //                             const header = new GUI.TextBlock();
    //                             header.text = "Play The Game";
    //                             header.width = "80%";
    //                             header.height = "10%";
    //                             header.fontFamily = "Geizer";
    //                             header.fontSize = 80;
    //                             header.color = "#ffffff";
    //                             header.outlineWidth = 4;
    //                             header.outlineColor = "#000000";
    //                             header.paddingTop = `${padding}px`;
    //                             header.verticalAlignment =
    //                                 GUI.Control.VERTICAL_ALIGNMENT_TOP;
    //                             header.horizontalAlignment =
    //                                 GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

    //                             advancedTexture.addControl(header);

    //                             const textBlock = new GUI.TextBlock();
    //                             textBlock.text =
    //                                 "You're a fish that sells fish to fish people. Made with Blender, BlockBench and Unity for the Fishy Game Jam 2024";
    //                             textBlock.fontFamily = "Mustica";
    //                             textBlock.fontSize = 42;
    //                             textBlock.color = "#ffffff";
    //                             textBlock.outlineWidth = 4;
    //                             textBlock.outlineColor = "#000000";
    //                             textBlock.textWrapping =
    //                                 GUI.TextWrapping.WordWrap;
    //                             textBlock.width = "100%";
    //                             textBlock.height = "30%";
    //                             textBlock.paddingTop = `${padding}px`;
    //                             textBlock.paddingBottom = `${padding}px`;
    //                             textBlock.paddingLeft = `${padding}px`;
    //                             textBlock.paddingRight = `${padding}px`;
    //                             textBlock.verticalAlignment =
    //                                 GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

    //                             advancedTexture.addControl(textBlock);
    //                         });

    //                         //if the player presses escape while in the trigger, transition back to the main camera immediately
    //                         escapeListener = (ev: KeyboardEvent) => {
    //                             if (ev.key === "Escape") {
    //                                 transitionToCamera(camera, cameraOffset, 1);

    //                                 for (const mesh of meshesToToggleOnInspect) {
    //                                     mesh.dispose();
    //                                 }
    //                                 meshesToToggleOnInspect = [];

    //                                 displayTag.isVisible = true;
    //                                 inspected = false;
    //                                 window.removeEventListener(
    //                                     "keydown",
    //                                     escapeListener,
    //                                 );
    //                                 clearTimeout(timer);
    //                             }
    //                         };
    //                         window.addEventListener("keydown", escapeListener);
    //                     }, 1000);
    //                 },
    //                 onExit: () => {
    //                     clearTimeout(timer);

    //                     if (inspected) {
    //                         for (const mesh of meshesToToggleOnInspect) {
    //                             mesh.dispose();
    //                         }
    //                         meshesToToggleOnInspect = [];
    //                         displayTag.isVisible = true;
    //                         transitionToCamera(camera, cameraOffset, 1);
    //                         window.removeEventListener(
    //                             "keydown",
    //                             escapeListener,
    //                         );
    //                     }
    //                 },
    //             },
    //         );
    //     },
    // );

    const npc_fishGame = new ProjectNPC(
        {
            npcName: "Dumbass Fish Game",
            modelPosition: new Vector3(17, 0, -45),
            modelRotation: new Vector3(0, -90, 0),
            player,
            camera,
            cameraOffset: new Vector3(13, 3, 13),
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
            cameraOffset: new Vector3(13, 3, 13),
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
        },
        scene,
        shadows,
    );

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
