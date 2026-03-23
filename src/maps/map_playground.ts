import {
    MeshBuilder,
    AbstractMesh,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    Vector3,
    ImportMeshAsync,
    IFontData,
    Mesh,
    Vector4,
    ShadowGenerator,
    Color4,
    Color3,
    StandardMaterial,
    BaseTexture,
    Texture,
    Material,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { Fonts as Fonts } from "../manager/fontmanager";
import earcut from "earcut";
import { attachBobbing } from "../utility/Bobbing";
import {
    ImportCustomModel,
    Vector3DegreesToRadians,
} from "../utility/UtilityFunctions";
import { attachCollisionScaleReaction } from "../utility/CollisionScaleReaction";
import data from "../data.json";

export type PlaygroundMapOptions = {
    /** Half-size of the playable area in world units (used for walls). */
    halfSize: number;
    wallHeight?: number;
    wallThickness?: number;
};

export function buildPlaygroundMap(
    scene: Scene,
    options: PlaygroundMapOptions,
    player: AbstractMesh,
    shadows: ShadowGenerator,
) {
    const meshes: AbstractMesh[] = [];

    const createHub = async () => {
        await ImportMeshAsync("/models/PortfolioMap.glb", scene).then(
            (result) => {
                //get shadow casters from the imported model
                const hubMeshes = result.meshes;
                for (const m of hubMeshes) {
                    if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                    m.receiveShadows = true;

                    if (!m.name.toLowerCase().includes("nocoll")) {
                        new PhysicsAggregate(
                            m,
                            PhysicsShapeType.MESH,
                            { mass: 0, restitution: 0.1, friction: 0.9 },
                            scene,
                        );
                    }

                    if (m.name.toLowerCase().includes("invis")) {
                        m.isVisible = false;
                    }
                }
            },
        );
    };

    const create3DText = (
        label: string,
        text: string,
        position: Vector3,
        rotation: Vector3,
        font: IFontData,
        size: number = 2,
        depth: number = 0.2,
    ) => {
        var createdText: Mesh = MeshBuilder.CreateText(
            label,
            text,
            font,
            { size: size, depth: depth },
            scene,
            earcut,
        );

        //convert degrees to radians for rotation
        rotation = rotation.multiply(
            new Vector3(Math.PI / 180, Math.PI / 180, Math.PI / 180),
        );

        createdText.position = position;
        createdText.rotation = rotation;

        shadows.addShadowCaster(createdText, true);
        // attachBobbing(createdText, { enabled: true, amplitude: 0.5, speed: 0.15 });

        return createdText;
    };

    const createDynamicCube = (
        name: string,
        size: number,
        position: Vector3,
        mass = 2,
    ) => {
        const cube = MeshBuilder.CreateBox(name, { size }, scene);
        cube.position = position;
        new PhysicsAggregate(
            cube,
            PhysicsShapeType.BOX,
            { mass, restitution: 0.2, friction: 0.8 },
            scene,
        );
        shadows.addShadowCaster(cube, true);
        return cube;
    };

    const createPillar = (position: Vector3) => {
        ImportCustomModel("Pillar", scene).then((result) => {
            result.meshes[0].position = position;
            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                new PhysicsAggregate(
                    m,
                    PhysicsShapeType.MESH,
                    { mass: 10, restitution: 0.1, friction: 0.9 },
                    scene,
                );

                m.renderOutline = true;
                m.outlineWidth = 0.05;
                m.outlineColor = new Color3(0, 0, 0);

                shadows.addShadowCaster(m, true);
            }
        });
    };

    const createHouse = (
        houseModel: string,
        position: Vector3,
        rotation: Vector3,
        scene: Scene,
        shadows: ShadowGenerator,
    ) => {
        ImportCustomModel(houseModel, scene).then((result) => {
            const model = result.meshes[0];
            model.position = position;
            model.rotation = Vector3DegreesToRadians(rotation);

            const material = new StandardMaterial(`mat_${houseModel}`, scene);
            material.diffuseColor = Color3.FromHexString("#b69b7f");
            // const diffuse = new Texture("/textures/checker.jpg", scene);
            // diffuse.vScale = -1;
            // material.diffuseTexture = diffuse;

            const ao = new Texture(`/textures/AO_${houseModel}.png`, scene);
            ao.vScale = -1;
            material.ambientTexture = ao;
            material.backFaceCulling = false;
            material.ambientTexture.scale(1);

            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                m.material = material;

                const aggregate = new PhysicsAggregate(
                    m,
                    PhysicsShapeType.MESH,
                    { mass: 0, restitution: 0.1, friction: 0.9 },
                    scene,
                );

                m.renderOutline = true;
                m.outlineWidth = 0.1;
                m.outlineColor = Color3.Black();

                shadows.getShadowMap().renderList?.push(m);
            }
        });
    };

    const createHallOfFame = () => {
        createPillar(new Vector3(-70, 0, 0));
        createPillar(new Vector3(-27.5, 0, -17.5));
        createPillar(new Vector3(-27.5, 0, 17.5));
        createPillar(new Vector3(-47, 0, 25));
        createPillar(new Vector3(-47, 0, -25));
        createPillar(new Vector3(-62.5, 0, -17.5));
        createPillar(new Vector3(-62.5, 0, 17.5));

        ImportCustomModel("GrandRing", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(-45, 0, 0);
            model.rotation = new Vector3(0, 0, 0);

            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                m.receiveShadows = true;
            }

            scene.onBeforeRenderObservable.add(() => {
                //framerate-independent rotation
                const deltaTime = scene.getEngine().getDeltaTime() / 16.6667; // normalize to 60fps
                model.rotation.y += 0.0005 * deltaTime;
            });
        });

        const title = create3DText(
            "hall_of_fame_title",
            data.featured_projects.display_name,
            new Vector3(-60, 10, 0),
            new Vector3(5, -90.0, 0),
            Fonts.GEIZER,
        );

        title.renderOutline = true;
        title.outlineWidth = 0.05;
        title.outlineColor = new Color3(0, 0, 0);

        title.material = new StandardMaterial("titleMat", scene);
        const color = 3;
        (title.material as StandardMaterial).diffuseColor = new Color3(
            color,
            color,
            color,
        );
        title.material.backFaceCulling = true;
    };

    const createSideProjects = () => {
        ImportCustomModel("SideProjRing", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(35, 0, -40);
            model.rotation = new Vector3(0, 0, 0);
            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                m.receiveShadows = false;

                scene.onBeforeRenderObservable.add(() => {
                    //framerate-independent rotation
                    const deltaTime =
                        scene.getEngine().getDeltaTime() / 16.6667;
                    model.rotation.y += 0.00015 * deltaTime;
                });
            }
        });

        createHouse(
            "House",
            new Vector3(30, 0, -65),
            new Vector3(0, 180, 0),
            scene,
            shadows,
        );
        createHouse(
            "House1",
            new Vector3(55, 0, -62),
            new Vector3(0, 70, 0),
            scene,
            shadows,
        );
        createHouse(
            "House1",
            new Vector3(5, 0, -40),
            new Vector3(0, 165, 0),
            scene,
            shadows,
        );
        createHouse(
            "House3",
            new Vector3(15, 0, -62),
            new Vector3(0, 210, 0),
            scene,
            shadows,
        );
        createHouse(
            "House3",
            new Vector3(63, 0, -42),
            new Vector3(0, 90, 0),
            scene,
            shadows,
        );

        const title = create3DText(
            "Village_of_Side_Projects_title",
            data.side_projects.display_name,
            new Vector3(35, 11, -53),
            new Vector3(5, 190, 0),
            Fonts.GEIZER,
        );

        attachBobbing(title, { enabled: true, amplitude: 1, speed: 0.25 });

        title.renderOutline = true;
        title.outlineWidth = 0.05;
        title.outlineColor = new Color3(0, 0, 0);

        title.material = new StandardMaterial("titleMat", scene);
        (title.material as StandardMaterial).diffuseColor =
            Color3.FromHexString("#d4c0aa").scale(2);
        title.material.backFaceCulling = true;
    };

    const createPrototypes = () => {
        ImportCustomModel("PrototypeRing", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(45, 0, 40);
            model.rotation = new Vector3(0, 0, 0);
            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                m.receiveShadows = false;
            }
        });

        const title = create3DText(
            "Prototypes_title",
            data.prototype_projects.display_name,
            new Vector3(45, 3, 37),
            new Vector3(0, 30, 180),
            Fonts.MUSTICA,
        );

        title.renderOutline = true;
        title.outlineWidth = 0.05;
        title.outlineColor = new Color3(0, 0, 0);

        title.material = new StandardMaterial("titleMat", scene);
        (title.material as StandardMaterial).diffuseColor =
            Color3.FromHexString("#ffffff").scale(1);
        title.material.backFaceCulling = true;

        new PhysicsAggregate(
            title,
            PhysicsShapeType.BOX,
            { mass: 20, restitution: 0.1, friction: 0.9 },
            scene,
        );

        const subtitle = create3DText(
            "Prototypes_title",
            "Forge Of",
            new Vector3(42, 3, 35),
            new Vector3(0, 30, 180),
            Fonts.MUSTICA,
        );

        subtitle.renderOutline = true;
        subtitle.outlineWidth = 0.05;
        subtitle.outlineColor = new Color3(0, 0, 0);

        subtitle.material = new StandardMaterial("titleMat", scene);
        (subtitle.material as StandardMaterial).diffuseColor =
            Color3.FromHexString("#ffffff").scale(1);
        subtitle.material.backFaceCulling = true;

        new PhysicsAggregate(
            subtitle,
            PhysicsShapeType.BOX,
            { mass: 20, restitution: 0.1, friction: 0.9 },
            scene,
        );
    };

    const createSpawnArea = () => {
        //get first and last name from data.json
        const { display_name } = data;
        const [firstName, lastName] = display_name.split(" ");

        const first_name = create3DText(
            firstName,
            firstName,
            new Vector3(15, 1, -15),
            new Vector3(0, -180, 0),
            Fonts.MUSTICA,
            4,
            0.5,
        );

        first_name.renderOutline = true;
        first_name.outlineWidth = 0.05;
        first_name.outlineColor = new Color3(0, 0, 0);

        shadows.addShadowCaster(first_name, true);

        new PhysicsAggregate(
            first_name,
            PhysicsShapeType.BOX,
            { mass: 20, restitution: 0.4, friction: 0.9 },
            scene,
        );

        const last_name = create3DText(
            lastName,
            lastName,
            new Vector3(-7, 1, -15),
            new Vector3(0, -180, 0),
            Fonts.MUSTICA,
            4,
            0.5,
        );

        last_name.renderOutline = true;
        last_name.outlineWidth = 0.05;
        last_name.outlineColor = new Color3(0, 0, 0);

        shadows.addShadowCaster(last_name, true);

        new PhysicsAggregate(
            last_name,
            PhysicsShapeType.BOX,
            { mass: 20, restitution: 0.4, friction: 0.9 },
            scene,
        );

        setTimeout(() => {
            const portfolio = create3DText(
                "Portfolio",
                "Portfolio",
                new Vector3(0, 7, 30),
                new Vector3(0, -180, 0),
                Fonts.MUSTICA,
                4,
                0.5,
            );

            portfolio.renderOutline = true;
            portfolio.outlineWidth = 0.05;
            portfolio.outlineColor = new Color3(0, 0, 0);

            shadows.addShadowCaster(portfolio, true);

            const portfolioPhysics = new PhysicsAggregate(
                portfolio,
                PhysicsShapeType.BOX,
                { mass: 10, restitution: 0.75, friction: 0.9 },
                scene,
            );

            portfolioPhysics.body.applyImpulse(
                new Vector3(0, 50, -500),
                portfolio.getAbsolutePosition().add(new Vector3(0, 3, 0)),
            );
        }, 1000);
    };

    createHub();

    createSpawnArea();

    createHallOfFame();

    createSideProjects();

    createPrototypes();

    // Dynamic cubes to knock around
    createDynamicCube("cube_1", 2, new Vector3(0, 1, 12), 3);
    createDynamicCube("cube_2", 2, new Vector3(4, 1, 14), 3);
    createDynamicCube("cube_3", 1.5, new Vector3(-6, 1, 10), 2);
    createDynamicCube("cube_4", 1.5, new Vector3(-8, 1, -2), 2);

    return meshes;
}
