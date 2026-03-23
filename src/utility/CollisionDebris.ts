import {
  AbstractMesh,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsPrestepType,
  PhysicsShapeType,
  Quaternion,
  Scene,
  Vector3,
} from "@babylonjs/core";

export type CollisionDebrisOptions = {
  /** Set false to disable */
  enabled?: boolean;

  /** Maximum active debris at once (pool size) */
  poolSize?: number;

  /** Max cubes to spawn per impact at strength=1 */
  maxSpawnPerImpact?: number;
  /** Minimum cubes to spawn when enabled */
  minSpawnPerImpact?: number;

  /** Cube size range (world units) */
  sizeMin?: number;
  sizeMax?: number;

  /** Cube mass range */
  massMin?: number;
  massMax?: number;

  /** How far from impact point to scatter spawn positions */
  scatterRadius?: number;

  /** Base upward/normal impulse */
  launchSpeedMin?: number;
  launchSpeedMax?: number;

  /** Extra random lateral speed */
  lateralSpeed?: number;

  /** Lifetime in seconds before cube is recycled */
  lifetimeSeconds?: number;

  /** Cooldown between impacts (seconds) */
  cooldownSeconds?: number;
};

export type CollisionDebrisSpawner = {
  spawn: (impactPoint: Vector3, impactNormal: Vector3, strength01: number) => void;
  dispose: () => void;
};

type PooledCube = {
  mesh: Mesh;
  agg: PhysicsAggregate;
  killAtMs: number;
  alive: boolean;
};

function _randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function _randomInUnitSphere(out: Vector3) {
  // Rejection sampling
  while (true) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;
    const d = x * x + y * y + z * z;
    if (d > 1 || d < 1e-6) continue;
    out.set(x, y, z);
    return out;
  }
}

function _safeNormal(n: Vector3) {
  return n.lengthSquared() > 1e-6 ? n.normalizeToNew() : Vector3.Up();
}

/**
 * Creates a pooled debris spawner (physics cubes) for collision impacts.
 * This is much more performant than creating/disposing bodies each collision.
 *
 * Notes on feasibility (mobile):
 * - Keep `poolSize` small (e.g. 12–24)
 * - Keep `maxSpawnPerImpact` low
 * - Prefer short `lifetimeSeconds`
 */
export function createCollisionDebrisSpawner(
  scene: Scene,
  options: CollisionDebrisOptions = {}
): CollisionDebrisSpawner {
  if (options.enabled === false) {
    return { spawn: () => {}, dispose: () => {} };
  }

  const poolSize = Math.max(1, Math.floor(options.poolSize ?? 18));
  const minSpawnPerImpact = Math.max(0, Math.floor(options.minSpawnPerImpact ?? 2));
  const maxSpawnPerImpact = Math.max(
    minSpawnPerImpact,
    Math.floor(options.maxSpawnPerImpact ?? 8)
  );

  const sizeMin = options.sizeMin ?? 0.15;
  const sizeMax = options.sizeMax ?? 0.35;
  const massMin = options.massMin ?? 0.05;
  const massMax = options.massMax ?? 0.18;
  const scatterRadius = options.scatterRadius ?? 0.45;
  const launchSpeedMin = options.launchSpeedMin ?? 1.5;
  const launchSpeedMax = options.launchSpeedMax ?? 5.0;
  const lateralSpeed = options.lateralSpeed ?? 2.2;
  const lifetimeSeconds = options.lifetimeSeconds ?? 1.6;
  const cooldownSeconds = options.cooldownSeconds ?? 0.06;

  const cubes: PooledCube[] = [];
  const tmp = new Vector3();
  const tmp2 = new Vector3();

  for (let i = 0; i < poolSize; i++) {
    const mesh = MeshBuilder.CreateBox(
      `debris_${i}`,
      { size: 1 },
      scene
    ) as Mesh;
    mesh.isPickable = false;
    mesh.setEnabled(false);

    const agg = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.BOX,
      { mass: _randRange(massMin, massMax), restitution: 0.2, friction: 0.9 },
      scene
    );

    // Start parked away from action.
    agg.body.setPrestepType(PhysicsPrestepType.TELEPORT);
    agg.body.setTargetTransform(new Vector3(0, -999, 0), Quaternion.Identity());
    agg.body.setLinearVelocity(Vector3.Zero());
    agg.body.setAngularVelocity(Vector3.Zero());
    agg.body.setPrestepType(PhysicsPrestepType.ACTION);

    cubes.push({ mesh, agg, killAtMs: 0, alive: false });
  }

  let lastSpawnMs = -1;

  const tickObs = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    for (const c of cubes) {
      if (!c.alive) continue;
      if (now >= c.killAtMs) {
        c.alive = false;
        c.mesh.setEnabled(false);
        c.agg.body.setPrestepType(PhysicsPrestepType.TELEPORT);
        c.agg.body.setTargetTransform(new Vector3(0, -999, 0), Quaternion.Identity());
        c.agg.body.setLinearVelocity(Vector3.Zero());
        c.agg.body.setAngularVelocity(Vector3.Zero());
        c.agg.body.setPrestepType(PhysicsPrestepType.ACTION);
      }
    }
  });

  const spawn = (impactPoint: Vector3, impactNormal: Vector3, strength01: number) => {
    const now = performance.now();
    if (lastSpawnMs > 0 && now - lastSpawnMs < cooldownSeconds * 1000) {
      return;
    }
    lastSpawnMs = now;

    const strength = Math.max(0, Math.min(1, strength01));
    const count = Math.min(
      maxSpawnPerImpact,
      Math.max(minSpawnPerImpact, Math.floor(minSpawnPerImpact + strength * (maxSpawnPerImpact - minSpawnPerImpact)))
    );

    const n = _safeNormal(impactNormal);

    for (let spawned = 0; spawned < count; spawned++) {
      const cube = cubes.find((c) => !c.alive);
      if (!cube) break;

      cube.alive = true;
      cube.killAtMs = now + lifetimeSeconds * 1000;
      cube.mesh.setEnabled(true);

      // Random size + mass
      const s = _randRange(sizeMin, sizeMax) * (0.75 + 0.6 * strength);
      cube.mesh.scaling.set(s, s, s);
      (cube.agg.body as any).setMassProperties?.({ mass: _randRange(massMin, massMax) });

      // Spawn position scattered around impact point, biased slightly outward along normal
      _randomInUnitSphere(tmp);
      tmp.scaleInPlace(scatterRadius * (0.3 + 0.7 * strength));
      const spawnPos = impactPoint
        .add(n.scale(0.08))
        .add(tmp);

      cube.agg.body.setPrestepType(PhysicsPrestepType.TELEPORT);
      cube.agg.body.setTargetTransform(spawnPos, Quaternion.Identity());
      cube.agg.body.setPrestepType(PhysicsPrestepType.ACTION);

      // Launch velocity: mostly along normal + some lateral scatter
      _randomInUnitSphere(tmp2);
      tmp2.y = 0; // lateral in XZ
      if (tmp2.lengthSquared() > 1e-6) tmp2.normalize();
      const lateral = tmp2.scale(lateralSpeed * (0.3 + 0.7 * strength));
      const launch = n
        .scale(_randRange(launchSpeedMin, launchSpeedMax) * (0.4 + 0.9 * strength))
        .add(lateral);

      cube.agg.body.setLinearVelocity(launch);
      cube.agg.body.setAngularVelocity(_randomInUnitSphere(tmp2).scale(3 + 6 * strength));
    }
  };

  const dispose = () => {
    scene.onBeforeRenderObservable.remove(tickObs);
    for (const c of cubes) {
      c.agg.dispose();
      c.mesh.dispose(false, true);
    }
  };

  return { spawn, dispose };
}

