import {
  MeshBuilder,
  AbstractMesh,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  Vector3,
} from "@babylonjs/core";

export type PlaygroundMapOptions = {
  /** Half-size of the playable area in world units (used for walls). */
  halfSize: number;
  wallHeight?: number;
  wallThickness?: number;
};

export function buildPlaygroundMap(scene: Scene, options: PlaygroundMapOptions) {
  const meshes: AbstractMesh[] = [];
  const wallHeight = options.wallHeight ?? 4;
  const wallThickness = options.wallThickness ?? 1;
  const halfSize = options.halfSize;

  const createStaticBox = (
    name: string,
    size: { width: number; height: number; depth: number },
    position: Vector3,
    rotation?: Vector3
  ) => {
    const box = MeshBuilder.CreateBox(name, size, scene);
    box.position = position;
    if (rotation) box.rotation = rotation;
    new PhysicsAggregate(
      box,
      PhysicsShapeType.BOX,
      { mass: 0, restitution: 0.1, friction: 0.9 },
      scene
    );
    meshes.push(box);
    return box;
  };

  const createDynamicCube = (
    name: string,
    size: number,
    position: Vector3,
    mass = 2
  ) => {
    const cube = MeshBuilder.CreateBox(name, { size }, scene);
    cube.position = position;
    new PhysicsAggregate(
      cube,
      PhysicsShapeType.BOX,
      { mass, restitution: 0.2, friction: 0.8 },
      scene
    );
    meshes.push(cube);
    return cube;
  };

  // Perimeter walls
  createStaticBox(
    "wall_n",
    { width: halfSize * 2, height: wallHeight, depth: wallThickness },
    new Vector3(0, wallHeight / 2, halfSize - wallThickness / 2)
  );
  createStaticBox(
    "wall_s",
    { width: halfSize * 2, height: wallHeight, depth: wallThickness },
    new Vector3(0, wallHeight / 2, -halfSize + wallThickness / 2)
  );
  createStaticBox(
    "wall_e",
    { width: wallThickness, height: wallHeight, depth: halfSize * 2 },
    new Vector3(halfSize - wallThickness / 2, wallHeight / 2, 0)
  );
  createStaticBox(
    "wall_w",
    { width: wallThickness, height: wallHeight, depth: halfSize * 2 },
    new Vector3(-halfSize + wallThickness / 2, wallHeight / 2, 0)
  );

  // Ramps (tilted static boxes)
  createStaticBox(
    "ramp_1",
    { width: 10, height: 1, depth: 6 },
    new Vector3(10, 0.5, 5),
    new Vector3(-Math.PI / 10, 0, Math.PI / 10)
  );
  createStaticBox(
    "ramp_2",
    { width: 12, height: 1, depth: 6 },
    new Vector3(-12, 0.5, -8),
    new Vector3(-Math.PI / 12, Math.PI / 4, 0)
  );

  // Dynamic cubes to knock around
  createDynamicCube("cube_1", 2, new Vector3(0, 1, 12), 3);
  createDynamicCube("cube_2", 2, new Vector3(4, 1, 14), 3);
  createDynamicCube("cube_3", 1.5, new Vector3(-6, 1, 10), 2);
  createDynamicCube("cube_4", 1.5, new Vector3(-8, 1, -2), 2);

  return meshes;
}

