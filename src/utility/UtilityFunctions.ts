import {
    AbstractMesh,
    ActionManager,
    Color3,
    ExecuteCodeAction,
    ImportMeshAsync,
    MeshBuilder,
    Scene,
    Vector3,
} from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

export const ImportCustomModel = async (fileName: string, scene: Scene) => {
    const result = ImportMeshAsync(`/models/Mesh_${fileName}.glb`, scene);
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
