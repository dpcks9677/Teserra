import * as CANNON from 'cannon-es';

export const BOUNDARY_MODES = Object.freeze({
  NORMAL: 'normal',
  INGRESS: 'ingress',
  FLIP: 'flip'
});

const BOARD_THICKNESS = 4;
const WALL_THICKNESS = 4;
const NORMAL_WALL_HEIGHT = 26;
const NORMAL_CEILING_GAP = 20;
const INGRESS_WALL_HEIGHT = 30;
const FLIP_WALL_HEIGHT = 250;
const FLIP_CEILING_GAP = 110;
const CEILING_THICKNESS = 10;
const RUNWAY_END_PADDING = 4;
const SLOPE_THICKNESS = 1;

export class DiceBoardPhysics {
  constructor(world) {
    this.world = world;
    this.bodies = [];
    this.floorBody = null;
    this.mode = BOUNDARY_MODES.NORMAL;
    this.layout = null;
  }

  configure(layout, mode = this.mode) {
    if (!layout) return;

    this.clear();
    this.layout = layout;
    this.mode = mode;
    const profile = this.getCollisionProfile(layout);
    const { floor } = profile;
    
    // 바닥 충돌체 생성
    this.floorBody = this.createHorizontalPlate(
      floor.minX,
      floor.maxX,
      floor.minZ,
      floor.maxZ,
      floor.y,
      BOARD_THICKNESS
    );

    // 4면 경사로(Ramps) 충돌체 생성
    if (profile.ramps && profile.ramps.length > 0) {
      profile.ramps.forEach(ramp => this.createSlopedPlate(ramp));
    }

    // 모드별 외곽벽 및 천장 구성
    if (mode === BOUNDARY_MODES.INGRESS) {
      this.configureIngress(layout);
    } else if (mode === BOUNDARY_MODES.FLIP) {
      this.configureClosed(layout, FLIP_WALL_HEIGHT, FLIP_CEILING_GAP);
    } else {
      this.configureClosed(layout, NORMAL_WALL_HEIGHT, NORMAL_CEILING_GAP);
    }
  }

  getCollisionProfile(layout) {
    return layout.collisionProfile ?? {
      bounds: { ...layout.playBounds },
      floor: { ...layout.playBounds, y: layout.playSurfaceY },
      ramps: [],
      wallBottoms: {
        minX: layout.playSurfaceY,
        maxX: layout.playSurfaceY,
        minZ: layout.playSurfaceY,
        maxZ: layout.playSurfaceY
      }
    };
  }

  getBounds(layout) {
    return this.getCollisionProfile(layout).bounds;
  }

  configureClosed(layout, wallHeight, ceilingGap) {
    const profile = this.getCollisionProfile(layout);
    const { minX, maxX, minZ, maxZ } = profile.bounds;
    this.createPerimeterWalls(profile.bounds, profile.wallBottoms, wallHeight);
    this.createCeiling(minX, maxX, minZ, maxZ, Math.max(...Object.values(profile.wallBottoms)) + ceilingGap);
  }

  configureIngress(layout) {
    const { minX, maxX, minZ, maxZ } = this.getBounds(layout);
    const runwayEndZ = Math.max(layout.launchOriginZ + RUNWAY_END_PADDING, maxZ + RUNWAY_END_PADDING);

    this.createHorizontalPlate(
      minX,
      maxX,
      maxZ,
      runwayEndZ,
      layout.playSurfaceY,
      BOARD_THICKNESS
    );

    const fullDepth = runwayEndZ - minZ;
    const centerZ = (minZ + runwayEndZ) / 2;
    const fullWidth = maxX - minX;
    const wallY = layout.playSurfaceY + INGRESS_WALL_HEIGHT / 2;

    // 상단(12시 방향) 차단벽
    this.createStaticBox(
      new CANNON.Vec3((fullWidth + WALL_THICKNESS * 2) / 2, INGRESS_WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3((minX + maxX) / 2, wallY, minZ - WALL_THICKNESS / 2)
    );
    // 후방(발사 지점 뒤쪽) 차단벽
    this.createStaticBox(
      new CANNON.Vec3((fullWidth + WALL_THICKNESS * 2) / 2, INGRESS_WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3((minX + maxX) / 2, wallY, runwayEndZ + WALL_THICKNESS / 2)
    );
    // 좌측 벽
    this.createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, INGRESS_WALL_HEIGHT / 2, fullDepth / 2 + WALL_THICKNESS),
      new CANNON.Vec3(minX - WALL_THICKNESS / 2, wallY, centerZ)
    );
    // 우측 벽
    this.createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, INGRESS_WALL_HEIGHT / 2, fullDepth / 2 + WALL_THICKNESS),
      new CANNON.Vec3(maxX + WALL_THICKNESS / 2, wallY, centerZ)
    );
  }

  createPerimeterWalls({ minX, maxX, minZ, maxZ }, wallBottoms, wallHeight) {
    const fullWidth = maxX - minX;
    const fullDepth = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // 상단(12시) 벽
    this.createStaticBox(
      new CANNON.Vec3((fullWidth + WALL_THICKNESS * 2) / 2, wallHeight / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3(centerX, wallBottoms.minZ + wallHeight / 2, minZ - WALL_THICKNESS / 2)
    );
    // 하단(6시) 벽
    this.createStaticBox(
      new CANNON.Vec3((fullWidth + WALL_THICKNESS * 2) / 2, wallHeight / 2, WALL_THICKNESS / 2),
      new CANNON.Vec3(centerX, wallBottoms.maxZ + wallHeight / 2, maxZ + WALL_THICKNESS / 2)
    );
    // 좌측(9시) 벽
    this.createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, wallHeight / 2, fullDepth / 2 + WALL_THICKNESS),
      new CANNON.Vec3(minX - WALL_THICKNESS / 2, wallBottoms.minX + wallHeight / 2, centerZ)
    );
    // 우측(3시) 벽
    this.createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, wallHeight / 2, fullDepth / 2 + WALL_THICKNESS),
      new CANNON.Vec3(maxX + WALL_THICKNESS / 2, wallBottoms.maxX + wallHeight / 2, centerZ)
    );
  }

  createCeiling(minX, maxX, minZ, maxZ, bottomY) {
    this.createStaticBox(
      new CANNON.Vec3((maxX - minX) / 2, CEILING_THICKNESS / 2, (maxZ - minZ) / 2),
      new CANNON.Vec3(
        (minX + maxX) / 2,
        bottomY + CEILING_THICKNESS / 2,
        (minZ + maxZ) / 2
      )
    );
  }

  createHorizontalPlate(minX, maxX, minZ, maxZ, topY, thickness) {
    return this.createStaticBox(
      new CANNON.Vec3((maxX - minX) / 2, thickness / 2, (maxZ - minZ) / 2),
      new CANNON.Vec3((minX + maxX) / 2, topY - thickness / 2, (minZ + maxZ) / 2)
    );
  }

  createSlopedPlate({ axis, from, to, fromY, toY, min, max }) {
    const run = to - from;
    const rise = toY - fromY;
    const angle = Math.atan2(rise, run);
    const length = Math.hypot(run, rise);
    const halfThickness = SLOPE_THICKNESS / 2;
    const normal = axis === 'x'
      ? new CANNON.Vec3(-Math.sin(angle), Math.cos(angle), 0)
      : new CANNON.Vec3(0, Math.cos(angle), -Math.sin(angle));
    const position = axis === 'x'
      ? new CANNON.Vec3((from + to) / 2, (fromY + toY) / 2, (min + max) / 2)
      : new CANNON.Vec3((min + max) / 2, (fromY + toY) / 2, (from + to) / 2);
    position.vsub(normal.scale(halfThickness), position);
    const halfExtents = axis === 'x'
      ? new CANNON.Vec3(length / 2, halfThickness, (max - min) / 2)
      : new CANNON.Vec3((max - min) / 2, halfThickness, length / 2);
    const rotation = new CANNON.Quaternion();
    rotation.setFromAxisAngle(axis === 'x' ? new CANNON.Vec3(0, 0, 1) : new CANNON.Vec3(1, 0, 0), angle);
    return this.createStaticBox(halfExtents, position, rotation);
  }

  createStaticBox(halfExtents, position, rotation) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(halfExtents) });
    body.position.copy(position);
    if (rotation) body.quaternion.copy(rotation);
    this.world.addBody(body);
    this.bodies.push(body);
    return body;
  }

  clear() {
    this.bodies.forEach(body => this.world.removeBody(body));
    this.bodies = [];
    this.floorBody = null;
  }
}
