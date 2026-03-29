import {
    AbstractMesh,
    ActionManager,
    Color3,
    ExecuteCodeAction,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsBody,
    PhysicsEventType,
    PhysicsMotionType,
    PhysicsShapeSphere,
    PhysicsShapeType,
    Scene,
    ShadowGenerator,
    StandardMaterial,
    Tags,
    Texture,
    Vector3,
} from "@babylonjs/core";
import {
    addTag,
    EntityTag,
    removeTag,
    tagKey,
    tagKeys,
} from "../utility/EntityTag";
import * as GUI from "@babylonjs/gui";
import { EntityTags } from "../utility/EntityTags";
import { Vector3DegreesToRadians } from "../utility/UtilityFunctions";
import { Entity } from "../utility/Entity";
import { Fonts } from "../manager/fontmanager";
import { createToonMaterial } from "../utility/Toon";

export type NPCSettings = { npcName: string };

export class NPC implements Entity {
    data: NPCSettings;
    tags: EntityTag[];
    meshes: AbstractMesh[];
    scene: Scene;
    shadowGenerator: ShadowGenerator;

    constructor(
        settings: NPCSettings,
        scene: Scene,
        shadowGenerator: ShadowGenerator,
    ) {
        this.tags = [];

        this.data = settings;
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.meshes = this.loadMesh(scene, shadowGenerator);
    }

    loadMesh(
        scene: Scene,
        shadowGenerator: ShadowGenerator,
        scale: number = 1,
    ): AbstractMesh[] {
        if (this.meshes == null) {
            this.meshes = [];
        }

        for (let i = 0; i < this.meshes.length; i++) {
            const element = this.meshes[i];

            if (element.getTotalVertices() <= 0) continue;
            element.scaling = new Vector3(scale, scale, scale);
            shadowGenerator.addShadowCaster(element);
        }

        return this.meshes;
    }

    enablePhsyics(mass: number = 0) {
        for (const mesh of this.meshes) {
            if (mesh.getTotalVertices() <= 0) continue;

            new PhysicsAggregate(
                mesh,
                PhysicsShapeType.BOX,
                { mass: mass, restitution: 0.2, friction: 1 },
                this.scene,
            );
        }
    }

    setModel(abstractMeshes: AbstractMesh[], scale: number = 1) {
        this.meshes = abstractMeshes;

        this.loadMesh(this.scene, this.shadowGenerator, scale);
    }

    setTexture(
        texture: Texture,
        outlineColor: Color3 = new Color3(0, 0, 0),
        outlineWidth?: number,
    ) {
        for (const mesh of this.meshes) {
            if (mesh.getTotalVertices() <= 0) continue;

            const material = new StandardMaterial(
                mesh.name + "_material",
                this.scene,
            );
            material.diffuseTexture = texture;
            material.diffuseTexture.updateSamplingMode(
                Texture.NEAREST_SAMPLINGMODE,
            );
            mesh.material = material;

            mesh.renderOutline = true;
            mesh.outlineWidth = outlineWidth ?? 0.1;
            mesh.outlineColor = outlineColor;
        }
    }

    setPosition(position: { x: number; y: number; z: number }) {
        this.meshes[0].position = new Vector3(
            position.x,
            position.y,
            position.z,
        );
    }

    setrotation(rotation: { x: number; y: number; z: number }) {
        this.meshes[0].rotation = Vector3DegreesToRadians(
            new Vector3(rotation.x, rotation.y, rotation.z),
        );
    }

    addTag(tag: string) {
        addTag(this, tag);

        this.tagNotifyUpdate();
    }

    removeTag(tag: string) {
        removeTag(this, tag);

        this.tagNotifyUpdate();
    }

    tagNotifyUpdate(): void {}
}
