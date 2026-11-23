import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';


const CAR_COLOR = 0xc94a3a;
const WHEEL_COLOR = 0x1a1a1a;

export class Vehicle {
  readonly group: THREE.Group;
  readonly chassisBody: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  private readonly wheels: THREE.Mesh[] = [];
  private readonly world: World;

  constructor(world: World, x: number, y: number, z: number) {
    this.world = world;
    this.group = new THREE.Group();

    // Chassis rigid body.
    const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y + 0.6, z)
      .setLinearDamping(0.3)
      .setAngularDamping(2.5);
    this.chassisBody = world.createRigidBody(chassisDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.35, 2.0).setMass(1200).setFriction(0.7);
    world.createCollider(colliderDesc, this.chassisBody);

    this.controller = new RAPIER.DynamicRayCastVehicleController(
      this.chassisBody,
      world.bodies,
      world.colliders,
      world.queryPipeline,
    );
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;

    const wheelPositions = [
      { x: -0.75, z: 1.3 },
      { x: 0.75, z: 1.3 },
      { x: -0.75, z: -1.3 },
      { x: 0.75, z: -1.3 },
    ];
    for (const wp of wheelPositions) {
      this.controller.addWheel(
        new RAPIER.Vector3(wp.x, -0.2, wp.z),
        new RAPIER.Vector3(0, -1, 0),
        new RAPIER.Vector3(1, 0, 0),
        0.3,
        0.35,
      );
    }
    for (let i = 0; i < 4; i += 1) {
      this.controller.setWheelSuspensionStiffness(i, 30);
      this.controller.setWheelMaxSuspensionTravel(i, 0.3);
      this.controller.setWheelSuspensionCompression(i, 4.4);
      this.controller.setWheelSuspensionRelaxation(i, 2.3);
      this.controller.setWheelFrictionSlip(i, 5);
      this.controller.setWheelSideFrictionStiffness(i, 2.0);
      this.controller.setWheelMaxSuspensionForce(i, 6000);
      this.controller.setWheelRadius(i, 0.35);
    }

    // Visual mesh.
    const bodyGeo = new THREE.CapsuleGeometry(0.78, 2.15, 4, 10);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1, 0.5, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: CAR_COLOR, roughness: 0.4, metalness: 0.3 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.32;
    bodyMesh.castShadow = true;
    this.group.add(bodyMesh);

    const cabinGeo = taperedCabinGeometry();
    const cabinMat = new THREE.MeshStandardMaterial({ color: CAR_COLOR, roughness: 0.38, metalness: 0.18 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0, -0.18);
    cabin.castShadow = true;
    this.group.add(cabin);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.62, metalness: 0.22 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffefbb, emissive: 0x392a0b, roughness: 0.28 });
    const rearLightMat = new THREE.MeshStandardMaterial({ color: 0xb7352d, emissive: 0x30100c, roughness: 0.35 });
    const addDetail = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.group.add(mesh);
    };
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x263e4a, roughness: 0.2, metalness: 0.12, side: THREE.DoubleSide });
    const addPane = (points: readonly (readonly [number, number, number])[]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((point) => point), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      addDetail(geometry, glassMat, 0, 0, 0);
    };
    addPane([[-0.64, 0.57, 0.79], [0.64, 0.57, 0.79], [0.48, 1.08, 0.42], [-0.48, 1.08, 0.42]]);
    addPane([[0.64, 0.57, -0.75], [-0.64, 0.57, -0.75], [-0.48, 1.08, -0.48], [0.48, 1.08, -0.48]]);
    for (const side of [-1, 1]) {
      addPane([[side * 0.731, 0.58, 0.72], [side * 0.731, 0.58, 0.04], [side * 0.535, 1.08, 0.04], [side * 0.535, 1.08, 0.42]]);
      addPane([[side * 0.731, 0.58, -0.04], [side * 0.731, 0.58, -0.68], [side * 0.535, 1.08, -0.48], [side * 0.535, 1.08, -0.04]]);
    }
    addDetail(new THREE.BoxGeometry(1.9, 0.14, 0.16), trimMat, 0, 0.2, 2.02);
    addDetail(new THREE.BoxGeometry(1.9, 0.14, 0.16), trimMat, 0, 0.2, -2.02);
    addDetail(new THREE.BoxGeometry(0.62, 0.17, 0.045), trimMat, 0, 0.35, 2.02);
    for (const x of [-0.2, 0, 0.2]) addDetail(new THREE.BoxGeometry(0.025, 0.14, 0.05), trimMat, x, 0.35, 2.05);
    for (const side of [-1, 1]) {
      addDetail(new THREE.BoxGeometry(0.32, 0.2, 0.1), lightMat, side * 0.62, 0.4, 1.91);
      addDetail(new THREE.BoxGeometry(0.28, 0.17, 0.1), rearLightMat, side * 0.66, 0.42, -1.91);
      addDetail(new THREE.BoxGeometry(0.16, 0.12, 0.22), trimMat, side * 0.82, 0.83, 0.48);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: WHEEL_COLOR, roughness: 0.8 });
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.27, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xa7a9a5, roughness: 0.35, metalness: 0.65 });
    for (const wp of wheelPositions) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wp.x, 0.0, wp.z);
      this.group.add(w);
      this.wheels.push(w);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.x = 0.02;
      w.add(hub);
    }
  }

  update(deltaSeconds: number, input: { forward: boolean; backward: boolean; left: boolean; right: boolean; handbrake: boolean }): void {
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steeringAngle = steer * 0.5;
    this.controller.setWheelSteering(0, steeringAngle);
    this.controller.setWheelSteering(1, steeringAngle);

    const engine = input.forward ? 4000 : input.backward ? -2000 : 0;
    this.controller.setWheelEngineForce(2, engine);
    this.controller.setWheelEngineForce(3, engine);

    const brake = input.handbrake ? 60 : input.backward && !input.forward ? 30 : 0;
    for (let i = 0; i < 4; i += 1) this.controller.setWheelBrake(i, brake);

    this.controller.updateVehicle(deltaSeconds);
    // Rapier's vehicle controller only changes velocities; stepping the world is
    // what integrates the chassis and resolves contacts with terrain, buildings
    // and the kinematic agent colliders.
    this.world.step();

    // Sync visual mesh.
    const t = this.chassisBody.translation();
    const r = this.chassisBody.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    // Wheel visuals.
    for (let i = 0; i < 4; i += 1) {
      const w = this.wheels[i];
      if (!w) continue;
      const rot = this.controller.wheelRotation(i);
      if (rot !== null) w.rotation.x = rot;
      const steerAng = this.controller.wheelSteering(i);
      if (steerAng !== null && i < 2) w.rotation.y = steerAng;
      const hp = this.controller.wheelHardPoint(i);
      const suspLen = this.controller.wheelSuspensionLength(i);
      if (hp && suspLen !== null) {
        w.position.set(hp.x - this.group.position.x, hp.y - this.group.position.y + suspLen * 0.5, hp.z - this.group.position.z);
      }
    }
  }

  get position(): THREE.Vector3 { return this.group.position; }

  get speed(): number {
    const velocity = this.chassisBody.linvel();
    return Math.hypot(velocity.x, velocity.y, velocity.z);
  }

  dispose(): void {
    this.world.removeRigidBody(this.chassisBody);
  }
}

function taperedCabinGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    -0.75, 0.56, 0.82,  0.75, 0.56, 0.82,  0.75, 0.56, -0.78, -0.75, 0.56, -0.78,
    -0.53, 1.1, 0.42,   0.53, 1.1, 0.42,   0.53, 1.1, -0.48,  -0.53, 1.1, -0.48,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7, 4, 5, 6, 4, 6, 7]);
  geometry.computeVertexNormals();
  return geometry;
}
