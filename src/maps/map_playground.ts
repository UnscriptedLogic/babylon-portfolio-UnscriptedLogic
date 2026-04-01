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
    ActionManager,
    ExecuteCodeAction,
    ParticleSystem,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { Fonts as Fonts } from "../manager/fontmanager";
import earcut from "earcut";
import { attachBobbing } from "../utility/Bobbing";
import {
    EachLetterPhysics,
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

                    const material = new StandardMaterial(
                        `mat_${m.name}`,
                        scene,
                    );
                    material.diffuseColor = Color3.FromHexString("#58a86a");
                    // material.emissiveColor =
                    //     Color3.FromHexString("#ffffff").scale(0.1);

                    m.material = material;

                    material.backFaceCulling = false;

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
            material.diffuseColor = Color3.FromHexString("#f89752");
            material.emissiveColor =
                Color3.FromHexString("#ffffff").scale(0.05);
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
        // createHouse(
        //     "House3",
        //     new Vector3(63, 0, -42),
        //     new Vector3(0, 90, 0),
        //     scene,
        //     shadows,
        // );

        const title = create3DText(
            "Village_of_Side_Projects_title",
            data.side_projects.display_name,
            new Vector3(35, 12, -53),
            new Vector3(5, 190, 0),
            Fonts.GEIZER,
        );

        attachBobbing(title, { enabled: true, amplitude: 0.5, speed: 0.25 });

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

        EachLetterPhysics(
            "Click or Tap to move around",
            scene,
            new Vector3(45, 1, 15),
            new Vector3(0, 225, 0),
            earcut,
            new Vector3(1.05, 0, 1.05),
            {
                size: 2,
                depth: 0.5,
                spacing: -3.75,
                forEach(letter, index, mesh) {
                    mesh.renderOutline = true;
                    mesh.outlineWidth = 0.05;
                    mesh.outlineColor = new Color3(0, 0, 0);

                    mesh.material = new StandardMaterial("titleMat", scene);
                    (mesh.material as StandardMaterial).diffuseColor =
                        Color3.FromHexString("#ffffff").scale(1);
                    mesh.material.backFaceCulling = true;

                    new PhysicsAggregate(
                        mesh,
                        PhysicsShapeType.BOX,
                        { mass: 5, restitution: 0.1, friction: 0.9 },
                        scene,
                    );
                },
            },
        );
    };

    const createSpawnArea = () => {
        //get first and last name from data.json
        const { display_name } = data;
        const [firstName, lastName] = display_name.split(" ");

        const first_name = EachLetterPhysics(
            firstName,
            scene,
            new Vector3(35, 1, -15),
            new Vector3(0, -180, 0),
            earcut,
            new Vector3(0, 0, 0),
            {
                size: 4,
                depth: 1,
                spacing: -6.5,
                font: Fonts.MUSTICA,
                forEach: (letter, index, mesh) => {
                    mesh.renderOutline = true;
                    mesh.outlineWidth = 0.05;
                    mesh.outlineColor = new Color3(0, 0, 0);

                    shadows.addShadowCaster(mesh, true);

                    new PhysicsAggregate(
                        mesh,
                        PhysicsShapeType.BOX,
                        { mass: 10, restitution: 0.4, friction: 0.9 },
                        scene,
                    );
                },
            },
        );

        const last_name = EachLetterPhysics(
            lastName,
            scene,
            new Vector3(5, 1, -15),
            new Vector3(0, -180, 0),
            earcut,
            new Vector3(0, 0, 0),
            {
                size: 4,
                depth: 1,
                spacing: -6.25,
                font: Fonts.MUSTICA,
                forEach: (letter, index, mesh) => {
                    mesh.renderOutline = true;
                    mesh.outlineWidth = 0.05;
                    mesh.outlineColor = new Color3(0, 0, 0);

                    shadows.addShadowCaster(mesh, true);

                    new PhysicsAggregate(
                        mesh,
                        PhysicsShapeType.BOX,
                        { mass: 10, restitution: 0.4, friction: 0.9 },
                        scene,
                    );
                },
            },
        );

        const profession = EachLetterPhysics(
            data.profession,
            scene,
            new Vector3(-15, 1, 10),
            new Vector3(0, -90, 0),
            earcut,
            new Vector3(3, 0, 3),
            {
                size: 3,
                depth: 1,
                spacing: -5.5,
                font: Fonts.MUSTICA,
                forEach: (letter, index, mesh) => {
                    mesh.renderOutline = true;
                    mesh.outlineWidth = 0.05;
                    mesh.outlineColor = new Color3(0, 0, 0);

                    shadows.addShadowCaster(mesh, true);

                    new PhysicsAggregate(
                        mesh,
                        PhysicsShapeType.BOX,
                        { mass: 10, restitution: 0.4, friction: 0.9 },
                        scene,
                    );
                },
            },
        );

        // setTimeout(() => {
        //     const portfolio = create3DText(
        //         "Portfolio",
        //         "Portfolio",
        //         new Vector3(0, 7, 30),
        //         new Vector3(0, -180, 0),
        //         Fonts.MUSTICA,
        //         4,
        //         0.5,
        //     );

        //     portfolio.renderOutline = true;
        //     portfolio.outlineWidth = 0.05;
        //     portfolio.outlineColor = new Color3(0, 0, 0);

        //     shadows.addShadowCaster(portfolio, true);

        //     const portfolioPhysics = new PhysicsAggregate(
        //         portfolio,
        //         PhysicsShapeType.BOX,
        //         { mass: 10, restitution: 0.75, friction: 0.9 },
        //         scene,
        //     );

        //     portfolioPhysics.body.applyImpulse(
        //         new Vector3(0, 50, -500),
        //         portfolio.getAbsolutePosition().add(new Vector3(0, 3, 0)),
        //     );
        // }, 1000);
    };

    const createBasketballCourt = () => {
        const material = new StandardMaterial("courtMat", scene);

        //hollowgram blue with some emissive glow
        material.diffuseColor = Color3.FromHexString("#ffffff");
        material.specularColor = Color3.FromHexString("#000000");

        ImportCustomModel("BasketballCourt", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(-50, 1.5, 57);
            model.rotation = Vector3DegreesToRadians(new Vector3(0, 180, 0));

            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues
                m.material = material;

                attachBobbing(m, {
                    enabled: true,
                    amplitude: Math.random() * 0.2 + 0.25,
                    speed: Math.random() * 0.2 + 0.1,
                });

                shadows.addShadowCaster(m, true);
            }
        });

        ImportCustomModel("BasketballRing", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(-60, 5, 57);
            model.rotation = Vector3DegreesToRadians(new Vector3(0, 180, 0));

            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues

                m.material = material;
                shadows.addShadowCaster(m, true);

                new PhysicsAggregate(
                    m,
                    PhysicsShapeType.MESH,
                    { mass: 0, restitution: 0.5, friction: 0.9 },
                    scene,
                );

                m.isPickable = false;
            }

            //add a trigger box below the ring to detect when the ball goes through
            const triggerBox = MeshBuilder.CreateBox(
                "hoop_trigger",
                { width: 1, height: 0.5, depth: 1 },
                scene,
            );
            triggerBox.position = model.position.add(new Vector3(2, 0.5, 0));
            triggerBox.isVisible = false;

            //add particle effect for when the ball goes through the hoop
            const particleSystem = new ParticleSystem(
                "hoop_particles",
                2000,
                scene,
            );
            particleSystem.particleTexture = new Texture(
                "textures/star.png",
                scene,
            );
            particleSystem.emitter = triggerBox;
            particleSystem.minEmitBox = new Vector3(-0.5, 0, -0.5);
            particleSystem.maxEmitBox = new Vector3(0.5, 0, 0.5);
            particleSystem.color1 = Color4.FromHexString("#ffffff");
            particleSystem.color2 = Color4.FromHexString("#ffffff");
            particleSystem.minSize = 0.1;
            particleSystem.maxSize = 0.5;
            particleSystem.minLifeTime = 0.5;
            particleSystem.maxLifeTime = 1;
            particleSystem.emitRate = 1000;
            particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
            particleSystem.gravity = new Vector3(0, -25, 0);
            particleSystem.direction1 = new Vector3(-1, 1, -1);
            particleSystem.direction2 = new Vector3(1, 1, 1);
            particleSystem.minAngularSpeed = 0;
            particleSystem.maxAngularSpeed = Math.PI;
            particleSystem.minEmitPower = 5;
            particleSystem.maxEmitPower = 30;
            particleSystem.updateSpeed = 0.01;

            //fire the particle system once only
            triggerBox.actionManager = new ActionManager(scene);
            triggerBox.actionManager.registerAction(
                new ExecuteCodeAction(
                    {
                        trigger: ActionManager.OnIntersectionEnterTrigger,
                        parameter: { mesh: player },
                    },
                    () => {
                        particleSystem.start();
                    },
                ),
            );
            triggerBox.actionManager.registerAction(
                new ExecuteCodeAction(
                    {
                        trigger: ActionManager.OnIntersectionExitTrigger,
                        parameter: { mesh: player },
                    },
                    () => {
                        particleSystem.stop();
                    },
                ),
            );
        });

        ImportCustomModel("RoundRamp", scene).then((result) => {
            const model = result.meshes[0];
            model.position = new Vector3(-50, 0, 57);
            model.rotation = Vector3DegreesToRadians(new Vector3(0, 180, 0));

            const rampMat = new StandardMaterial("planeMat", scene);
            (rampMat as StandardMaterial).diffuseColor =
                Color3.FromHexString("#d2ab7a");

            for (const m of result.meshes) {
                if (m.getTotalVertices() <= 0) continue; // skip invisible/empty meshes that would cause physics issues
                m.material = rampMat;

                new PhysicsAggregate(
                    m,
                    PhysicsShapeType.MESH,
                    { mass: 0, restitution: 0.5, friction: 0.9 },
                    scene,
                );
            }
        });
    };

    createHub();

    createSpawnArea();

    createHallOfFame();

    createSideProjects();

    createPrototypes();

    createBasketballCourt();

    //scatter some random cubes for fun
    const anchorPoint = new Vector3(0, 10, 20);
    for (let i = 0; i < 10; i++) {
        const randomOffset = new Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10,
        );
        createDynamicCube(
            `cube_${i}`,
            Math.random() * 2 + 1,
            anchorPoint.add(randomOffset),
            1 + Math.random() * 4,
        );
    }

    return meshes;
}
