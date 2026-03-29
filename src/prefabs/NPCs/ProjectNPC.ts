import {
    ImportMeshAsync,
    ISceneLoaderAsyncResult,
    LensRenderingPipeline,
    Mesh,
    Scene,
    ShadowGenerator,
    Texture,
    UniversalCamera,
    Vector3,
    Color3,
} from "@babylonjs/core";
import { NPC, NPCSettings } from "../NPC";
import { BentoCell, createBentoLayout } from "../../utility/BentoBoxLayout";
import {
    ImportCustomModel,
    createDisplayTag,
    attachTriggerSphere,
    transitionToCamera,
    Vector3DegreesToRadians,
} from "../../utility/UtilityFunctions";
import { Player } from "../../player/Player";
import * as GUI from "@babylonjs/gui";

export type ProjectNPCSettings = NPCSettings & {
    npcName: string;
    modelName?: string;
    modelPosition: Vector3;
    modelRotation: Vector3;
    modelOutlineWidth?: number;
    textureName?: string;
    bentoImages?: BentoCell[];
    thumbnailImage?: string;
    description?: string;
    gameDescription?: string;
    gameUrl?: string;
    player: Player;
    camera: UniversalCamera;
    cameraOffset: Vector3;
    cameraTargetOffset?: Vector3;
    textBlockOffset?: Vector3;
    textBlockRotation?: Vector3;
    thumbnailOffset?: Vector3;
    thumbnailRotation?: Vector3;
    bentoOffset?: Vector3;
    bentoRotation?: Vector3;
};

export class ProjectNPC extends NPC {
    constructor(
        settings: ProjectNPCSettings,
        scene: Scene,
        shadowGenerator: ShadowGenerator,
    ) {
        super(settings, scene, shadowGenerator);

        ImportCustomModel(
            settings.modelName || "StupidFuckingFish",
            scene,
        ).then((result: ISceneLoaderAsyncResult) => {
            const npc_fishGame = new NPC(
                { npcName: settings.npcName },
                scene,
                shadowGenerator,
            );

            npc_fishGame.setModel(result.meshes, 1.5);
            npc_fishGame.setPosition(settings.modelPosition);
            npc_fishGame.setrotation(settings.modelRotation);
            const texture = new Texture(
                settings.textureName || "/textures/FishWithLegs.png",
                scene,
                true,
                true,
                Texture.NEAREST_SAMPLINGMODE,
            );
            texture.vScale = -1;
            texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
            npc_fishGame.setTexture(
                texture,
                new Color3(0, 0, 0),
                settings.modelOutlineWidth,
            );

            var displayTag = createDisplayTag(
                npc_fishGame.data.npcName,
                npc_fishGame.meshes[0],
                scene,
                { offset: new Vector3(0, -6, 0) },
            );

            //setup individual NPC camera
            var npcCam = new UniversalCamera(
                "npcCamera_" + npc_fishGame.data.npcName,
                npc_fishGame.meshes[0].position.add(settings.cameraOffset),
                scene,
            );
            npcCam.setTarget(
                npc_fishGame.meshes[0].position.add(
                    settings.cameraTargetOffset || new Vector3(0, 6, -10),
                ),
            );

            var timer: ReturnType<typeof setTimeout>;
            var escapeListener: (ev: KeyboardEvent) => void;
            var inspected = false;
            var meshesToToggleOnInspect: Mesh[] = [];
            attachTriggerSphere(
                npc_fishGame.meshes[0],
                [settings.player.getmesh()],
                scene,
                {
                    radius: 5,
                    onEnter: () => {
                        timer = setTimeout(() => {
                            inspected = true;

                            transitionToCamera(
                                npcCam,
                                npc_fishGame.meshes[0].position.add(
                                    new Vector3(0, 6, -8),
                                ),
                                1,
                            );
                            displayTag.isVisible = false;

                            settings.player.freeze();

                            ImportMeshAsync(
                                `/models/CurvedPlane.glb`,
                                scene,
                            ).then((res) => {
                                const root = res.meshes[0];
                                const plane = res.meshes[1] as Mesh;
                                meshesToToggleOnInspect.push(plane);
                                root.position =
                                    npc_fishGame.meshes[0].position.add(
                                        settings.bentoOffset ||
                                            new Vector3(6, 6.5, -7),
                                    );
                                root.scaling = new Vector3(2.5, 1.5, 1.5);

                                root.rotation = Vector3DegreesToRadians(
                                    settings.bentoRotation ||
                                        new Vector3(-5, 200, 0),
                                );

                                var advancedTexture =
                                    GUI.AdvancedDynamicTexture.CreateForMesh(
                                        plane,
                                        1024,
                                        1024,
                                    );

                                createBentoLayout(
                                    plane,
                                    settings.bentoImages || [
                                        {
                                            src: "/images/FishGame/Image1.png",
                                            colSpan: 2,
                                            rowSpan: 2,
                                        },
                                        {
                                            src: "/images/FishGame/Image2.png",
                                            colSpan: 2,
                                            rowSpan: 2,
                                        },
                                        {
                                            src: "/images/FishGame/DFG_Vid1.mp4",
                                            colSpan: 4,
                                            rowSpan: 4,
                                        },
                                        {
                                            src: "/images/FishGame/Image3.png",
                                            colSpan: 3,
                                            rowSpan: 3,
                                        },
                                        {
                                            src: "/images/FishGame/Image4.png",
                                            colSpan: 1,
                                            rowSpan: 1,
                                        },
                                        {
                                            src: "/images/FishGame/DFG_Vid2.mp4",
                                            colSpan: 3,
                                            rowSpan: 3,
                                        },
                                        {
                                            src: "/images/FishGame/Image5.png",
                                            colSpan: 2,
                                            rowSpan: 2,
                                        },
                                        {
                                            src: "/images/FishGame/Image6.png",
                                            colSpan: 1,
                                            rowSpan: 1,
                                        },
                                    ],
                                    {
                                        columns: 8,
                                        rows: 8,
                                        gap: 8,
                                        padding: 6,
                                        cornerRadius: 0,
                                        textureWidth: 1024,
                                        textureHeight: 1024,

                                        cellBorder: {
                                            color: "#ffddaa",
                                            thickness: 0,
                                            alpha: 0.25,
                                        },
                                        entrance: {
                                            durationMs: 380 * 4,
                                            staggerMs: 65 * 4,
                                            slidePixels: 44 * 4,
                                        },
                                        float: {
                                            amplitudePx: 4,
                                            periodMs: 3000,
                                            phaseOffsetMs: 350,
                                        },
                                    },
                                );
                            });

                            ImportMeshAsync(
                                "/models/CurvedPlane.glb",
                                scene,
                            ).then((res) => {
                                const root = res.meshes[0];
                                const infoPlane = res.meshes[1] as Mesh;
                                meshesToToggleOnInspect.push(infoPlane);
                                root.position =
                                    npc_fishGame.meshes[0].position.add(
                                        settings.textBlockOffset ||
                                            new Vector3(6.5, 1.75, -6.5),
                                    );
                                root.scaling = new Vector3(1, 1.1, 1).scale(2);

                                root.rotation = Vector3DegreesToRadians(
                                    settings.textBlockRotation ||
                                        new Vector3(0, 200, 0.5),
                                );

                                var advancedTexture =
                                    GUI.AdvancedDynamicTexture.CreateForMesh(
                                        infoPlane,
                                    );

                                //background colour
                                const rect = new GUI.Rectangle();
                                rect.width = "100%";
                                rect.height = "30%";
                                rect.background = "#171717";
                                rect.alpha = 0.5;
                                rect.cornerRadius = 6;

                                advancedTexture.addControl(rect);

                                const textBlock = new GUI.TextBlock();
                                textBlock.text =
                                    settings.description ||
                                    "This project serves as a personal reminder that the experience conveyed is often more valuable than the game itself. Made solely for the memes, this is my joke game that became my best performing game jam submission. Scoring 84th in a 500 submission game jam, this is my 'this did well somehow' project I will never forget.";
                                textBlock.fontFamily = "Mustica";
                                textBlock.fontSize = 30;
                                textBlock.color = "#ffffff";
                                textBlock.outlineWidth = 4;
                                textBlock.outlineColor = "#000000";
                                textBlock.textWrapping =
                                    GUI.TextWrapping.WordWrap;
                                textBlock.width = "100%";
                                textBlock.height = "100%";
                                var padding = 24;
                                textBlock.paddingTop = padding + "px";
                                textBlock.paddingRight = padding + "px";
                                textBlock.paddingBottom = padding + "px";
                                textBlock.paddingLeft = padding + "px";
                                textBlock.verticalAlignment =
                                    GUI.Control.VERTICAL_ALIGNMENT_TOP;

                                advancedTexture.addControl(textBlock);
                            });
                            ImportMeshAsync(
                                "/models/CurvedPlane.glb",
                                scene,
                            ).then((res) => {
                                const root = res.meshes[0];
                                const thumbnailPlane = res.meshes[1] as Mesh;
                                meshesToToggleOnInspect.push(thumbnailPlane);

                                root.position =
                                    npc_fishGame.meshes[0].position.add(
                                        settings.thumbnailOffset ||
                                            new Vector3(-2, 8, 0),
                                    );
                                root.rotation = Vector3DegreesToRadians(
                                    settings.thumbnailRotation ||
                                        new Vector3(0, 240, -2),
                                );
                                root.scaling = new Vector3(1, 1, 1).scale(1);

                                var advancedTexture =
                                    GUI.AdvancedDynamicTexture.CreateForMesh(
                                        thumbnailPlane,
                                    );

                                //background colour
                                const rect = new GUI.Rectangle();
                                rect.width = "100%";
                                rect.height = "100%";
                                rect.background = "#171717";
                                rect.alpha = 0.9;
                                rect.paddingRight = "12px";

                                //border radius
                                rect.cornerRadius = 12;

                                advancedTexture.addControl(rect);

                                //game thumbnail
                                const thumb = new GUI.Image();
                                thumb.source =
                                    settings.thumbnailImage ||
                                    "/images/FishGame/Thumbnail.png";

                                thumb.width = "100%";
                                thumb.height = "75%";
                                thumb.stretch = GUI.Image.STRETCH_UNIFORM;

                                thumb.verticalAlignment =
                                    GUI.Control.VERTICAL_ALIGNMENT_TOP;
                                thumb.horizontalAlignment =
                                    GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                                advancedTexture.addControl(thumb);

                                thumb.onPointerClickObservable.add(() => {
                                    window.open(
                                        settings.gameUrl ||
                                            "https://unscriptedlogic.itch.io/dumbass-fish-game",
                                        "_blank",
                                    );
                                });

                                //change cursor to show clickable
                                thumb.onPointerEnterObservable.add(() => {
                                    document.body.style.cursor = "pointer";

                                    //tint green when hovering
                                    rect.color = "#00ff00";
                                    rect.thickness = 16;
                                });
                                thumb.onPointerOutObservable.add(() => {
                                    document.body.style.cursor = "default";

                                    rect.color = "#171717";
                                    rect.thickness = 0;
                                });

                                //padding
                                const padding = 48;
                                thumb.paddingTop = `${padding + 78}px`;
                                thumb.paddingBottom = `${padding}px`;
                                thumb.paddingLeft = `${padding}px`;
                                thumb.paddingRight = `${padding}px`;

                                //Play The Game Text Header
                                const header = new GUI.TextBlock();
                                header.text = "Play The Game";
                                header.width = "80%";
                                header.height = "10%";
                                header.fontFamily = "Geizer";
                                header.fontSize = 80;
                                header.color = "#ffffff";
                                header.outlineWidth = 4;
                                header.outlineColor = "#000000";
                                header.paddingTop = `${padding}px`;
                                header.verticalAlignment =
                                    GUI.Control.VERTICAL_ALIGNMENT_TOP;
                                header.horizontalAlignment =
                                    GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

                                advancedTexture.addControl(header);

                                const textBlock = new GUI.TextBlock();
                                textBlock.text =
                                    settings.gameDescription ||
                                    "You're a fish that sells fish to fish people. Made with Blender, BlockBench and Unity for the Fishy Game Jam 2024";
                                textBlock.fontFamily = "Mustica";
                                textBlock.fontSize = 42;
                                textBlock.color = "#ffffff";
                                textBlock.outlineWidth = 4;
                                textBlock.outlineColor = "#000000";
                                textBlock.textWrapping =
                                    GUI.TextWrapping.WordWrap;
                                textBlock.width = "100%";
                                textBlock.height = "30%";
                                textBlock.paddingTop = `${padding}px`;
                                textBlock.paddingBottom = `${padding}px`;
                                textBlock.paddingLeft = `${padding}px`;
                                textBlock.paddingRight = `${padding}px`;
                                textBlock.verticalAlignment =
                                    GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

                                advancedTexture.addControl(textBlock);
                            });

                            //if the player presses escape while in the trigger, transition back to the main camera immediately
                            escapeListener = (ev: KeyboardEvent) => {
                                if (ev.key === "Escape") {
                                    transitionToCamera(
                                        settings.camera,
                                        settings.cameraOffset,
                                        1,
                                    );

                                    for (const mesh of meshesToToggleOnInspect) {
                                        mesh.dispose();
                                    }
                                    meshesToToggleOnInspect = [];

                                    displayTag.isVisible = true;
                                    inspected = false;
                                    window.removeEventListener(
                                        "keydown",
                                        escapeListener,
                                    );
                                    clearTimeout(timer);
                                }
                            };
                            window.addEventListener("keydown", escapeListener);
                        }, 1000);
                    },
                    onExit: () => {
                        clearTimeout(timer);

                        if (inspected) {
                            for (const mesh of meshesToToggleOnInspect) {
                                mesh.dispose();
                            }
                            meshesToToggleOnInspect = [];
                            displayTag.isVisible = true;
                            transitionToCamera(
                                settings.camera,
                                settings.cameraOffset,
                                1,
                            );
                            window.removeEventListener(
                                "keydown",
                                escapeListener,
                            );
                        }
                    },
                },
            );
        });
    }
}
