import {
    AbstractMesh,
    ActionManager,
    Animation,
    Camera,
    CircleEase,
    Color3,
    EasingFunction,
    ExecuteCodeAction,
    ExponentialEase,
    IFontData,
    ImportMeshAsync,
    MeshBuilder,
    PowerEase,
    QuinticEase,
    Scene,
    UniversalCamera,
    Vector3,
} from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { Interpolation, Tween } from "@tweenjs/tween.js";
import { Fonts } from "../manager/fontmanager";

export const ImportCustomModel = async (fileName: string, scene: Scene) => {
    const result = ImportMeshAsync(
        `../public/models/Mesh_${fileName}.glb`,
        scene,
    );
    return result;
};

export const degreesToRadians = (degrees: number) => {
    return (degrees * Math.PI) / 180;
};

export const Vector3DegreesToRadians = (vec: Vector3) => {
    return new Vector3(
        degreesToRadians(vec.x),
        degreesToRadians(vec.y),
        degreesToRadians(vec.z),
    );
};

export type displayTagConfig = {
    font?: string;
    size?: number;
    offset?: Vector3;
};

export const createDisplayTag = (
    name: string,
    anchor: AbstractMesh,
    scene: Scene,
    config?: displayTagConfig,
) => {
    var plane = MeshBuilder.CreatePlane(
        "namePlane",
        { width: 16, height: 16 },
        scene,
    );

    config.font = config.font ? config.font : "Mustica";
    config.size = config.size ? config.size : 60;
    config.offset = config.offset ? config.offset : new Vector3(0, 4, 0);

    var advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(plane);

    var textBlock = new GUI.TextBlock();
    textBlock.text = name;
    textBlock.fontSize = config.size;
    textBlock.fontFamily = config.font;
    textBlock.fontWeight = "bold";
    textBlock.color = "#ffffff";
    textBlock.outlineWidth = 4;
    textBlock.outlineColor = "#000000";

    advancedTexture.addControl(textBlock);
    plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    plane.setParent(anchor, false);
    plane.position = Vector3.Zero().add(config.offset);
    plane.rotation = Vector3DegreesToRadians(Vector3.Zero());

    return plane;
};

export type TriggerSphereConfig = {
    radius?: number;
    onEnter?: () => void;
    onExit?: () => void;
};

export const attachTriggerSphere = (
    mesh: AbstractMesh,
    targets: AbstractMesh[] | undefined,
    scene: Scene,
    config?: TriggerSphereConfig,
) => {
    const radius = config?.radius ?? 2;
    const triggerSphere = MeshBuilder.CreateSphere(
        `${mesh.name}_triggerSphere`,
        { diameter: radius * 2 },
        scene,
    );

    triggerSphere.isVisible = false;
    triggerSphere.setParent(mesh, false);
    triggerSphere.position = Vector3.Zero();

    triggerSphere.actionManager = new ActionManager(scene);
    for (let i = 0; i < targets.length; i++) {
        const element = targets[i];
        triggerSphere.actionManager.registerAction(
            new ExecuteCodeAction(
                {
                    trigger: ActionManager.OnIntersectionEnterTrigger,
                    parameter: { mesh: element, usePreciseIntersection: true },
                },
                () => {
                    config?.onEnter && config.onEnter();
                },
            ),
        );

        triggerSphere.actionManager.registerAction(
            new ExecuteCodeAction(
                {
                    trigger: ActionManager.OnIntersectionExitTrigger,
                    parameter: { mesh: element, usePreciseIntersection: true },
                },
                () => {
                    config?.onExit && config.onExit();
                },
            ),
        );
    }
};

export const transitionToCamera = (
    newCam: UniversalCamera,
    target: Vector3 = Vector3.Zero(),
    durationSec: number,
) => {
    const scene = newCam.getScene();
    const activeCam = scene.activeCamera as UniversalCamera;

    scene.activeCamera = newCam;
    const originalLocation = newCam.position.clone();
    const originalRotation = newCam.rotation.clone();

    const ease = new CircleEase();
    ease.setEasingMode(CircleEase.EASINGMODE_EASEINOUT);

    const posAnim = new Animation(
        "cameraTransition",
        "position",
        60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
    );

    posAnim.setKeys([
        { frame: 0, value: activeCam.position.clone() },
        { frame: durationSec * 60, value: originalLocation },
    ]);
    posAnim.setEasingFunction(ease);

    const rotAnim = new Animation(
        "camRot",
        "rotation",
        60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
    );

    rotAnim.setKeys([
        { frame: 0, value: activeCam.rotation.clone() },
        { frame: durationSec * 60, value: originalRotation },
    ]);
    rotAnim.setEasingFunction(ease);
    scene.beginDirectAnimation(
        newCam,
        [posAnim, rotAnim], // pass both animations together
        0,
        durationSec * 60,
        false,
        1,
        () => {},
    );
};

export type EachLetterPhysicsConfig = {
    size?: number;
    depth?: number;
    spacing?: number;
    font?: IFontData;
    forEach?: (letter: string, index: number, mesh: AbstractMesh) => void;
};

export const EachLetterPhysics = (
    text: string,
    scene: Scene,
    position: Vector3,
    rotation: Vector3,
    earcut: any,
    config?: EachLetterPhysicsConfig,
) => {
    const letters = text.split("");
    const letterMeshes: AbstractMesh[] = [];

    letters.forEach((letter, index) => {
        const letterMesh = MeshBuilder.CreateText(
            `letter_${letter}_${index}`,
            letter,
            config?.font ?? Fonts.MUSTICA,
            { size: config?.size ?? 0.5, depth: config?.depth ?? 0.1 },
            scene,
            earcut,
        );
        letterMesh.position = position.add(
            new Vector3(
                index * ((config?.size ?? 0.5) + (config?.spacing ?? 0)) * 1.2,
                0,
                0,
            ),
        );
        letterMesh.rotation = Vector3DegreesToRadians(rotation);
        letterMeshes.push(letterMesh);

        if (config?.forEach) {
            config.forEach(letter, index, letterMesh);
        }
    });
    return letterMeshes;
};
