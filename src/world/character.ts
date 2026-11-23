import * as THREE from 'three';
import type { ChunkManager } from './chunk-manager';
import type { InputManager, MovementAxes } from '../engine/input-manager';

const BODY_COLOR = 0x3a6b6f;
const SKIN_COLOR = 0xd9b08c;
const PANTS_COLOR = 0x2b2f36;
const SHOE_COLOR = 0x1a1a1a;
const HAIR_COLOR = 0x2a1f1a;

export class Character {
  readonly group: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly body: THREE.Mesh;
  private walkPhase = 0;
  private vy = 0;
  private onGround = true;

  constructor() {
    this.group = new THREE.Group();

    const material = (color: number, roughness = 0.6, metalness = 0.05) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // Torso (rounded cylinder).
    const torsoGeo = new THREE.CylinderGeometry(0.28, 0.3, 0.75, 16);
    this.body = new THREE.Mesh(torsoGeo, material(BODY_COLOR));
    this.body.position.y = 1.15;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Head (sphere).
    const headGeo = new THREE.SphereGeometry(0.18, 24, 16);
    const head = new THREE.Mesh(headGeo, material(SKIN_COLOR, 0.5));
    head.position.y = 1.68;
    head.castShadow = true;
    this.group.add(head);

    // Hair (small sphere cap).
    const hairGeo = new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const hair = new THREE.Mesh(hairGeo, material(HAIR_COLOR, 0.7));
    hair.position.y = 1.72;
    hair.castShadow = true;
    this.group.add(hair);

    // Arms (cylinders).
    const armGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.6, 12);
    this.leftArm = new THREE.Group();
    const la = new THREE.Mesh(armGeo, material(BODY_COLOR));
    la.position.y = -0.3;
    this.leftArm.add(la);
    this.leftArm.position.set(-0.38, 1.4, 0);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    const ra = new THREE.Mesh(armGeo, material(BODY_COLOR));
    ra.position.y = -0.3;
    this.rightArm.add(ra);
    this.rightArm.position.set(0.38, 1.4, 0);
    this.group.add(this.rightArm);

    // Hands (small spheres).
    const handGeo = new THREE.SphereGeometry(0.09, 12, 8);
    const lh = new THREE.Mesh(handGeo, material(SKIN_COLOR, 0.5));
    lh.position.set(0, -0.62, 0);
    this.leftArm.add(lh);
    const rh = new THREE.Mesh(handGeo, material(SKIN_COLOR, 0.5));
    rh.position.set(0, -0.62, 0);
    this.rightArm.add(rh);

    // Legs (cylinders).
    const legGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.7, 12);
    const footGeo = new THREE.SphereGeometry(0.1, 12, 8);
    footGeo.scale(1.1, 0.5, 1.4);
    this.leftLeg = new THREE.Group();
    const ll = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    ll.position.y = -0.35;
    this.leftLeg.add(ll);
    const lf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    lf.position.set(0, -0.72, 0.05);
    this.leftLeg.add(lf);
    this.leftLeg.position.set(-0.14, 0.75, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rl = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    rl.position.y = -0.35;
    this.rightLeg.add(rl);
    const rf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    rf.position.set(0, -0.72, 0.05);
    this.rightLeg.add(rf);
    this.rightLeg.position.set(0.14, 0.75, 0);
    this.group.add(this.rightLeg);
  }

  update(deltaSeconds: number, input: InputManager, chunks: ChunkManager | undefined, cameraYaw: number, jump: boolean): void {
    const axes: MovementAxes = { horizontal: 0, vertical: 0 };
    input.movement(axes);
    const moving = Math.hypot(axes.horizontal, axes.vertical) > 0.01;

    if (jump && this.onGround) {
      this.vy = 6.2;
      this.onGround = false;
    }

    const speed = input.isPressed('sprint') ? 5.5 : 2.6;
    if (moving) {
      const dirX = axes.horizontal * Math.cos(cameraYaw) - axes.vertical * Math.sin(cameraYaw);
      const dirZ = -axes.horizontal * Math.sin(cameraYaw) - axes.vertical * Math.cos(cameraYaw);
      const length = Math.hypot(dirX, dirZ) || 1;
      const stepX = (dirX / length) * speed * deltaSeconds;
      const stepZ = (dirZ / length) * speed * deltaSeconds;
      const nextX = this.group.position.x + stepX;
      if (!chunks || !chunks.collidesWithBuilding(nextX, this.group.position.z, 0.4)) {
        this.group.position.x = nextX;
      }
      const nextZ = this.group.position.z + stepZ;
      if (!chunks || !chunks.collidesWithBuilding(this.group.position.x, nextZ, 0.4)) {
        this.group.position.z = nextZ;
      }
      const targetYaw = Math.atan2(dirX, dirZ);
      let diff = targetYaw - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, deltaSeconds * 12);
      this.walkPhase += deltaSeconds * (input.isPressed('sprint') ? 14 : 9);
    } else {
      this.walkPhase *= 0.85;
    }

    this.vy -= 18 * deltaSeconds;
    this.group.position.y += this.vy * deltaSeconds;
    if (chunks) {
      const ground = chunks.groundHeightAt(this.group.position.x, this.group.position.z);
      if (ground !== undefined && this.group.position.y <= ground + 0.05) {
        this.group.position.y = ground;
        this.vy = 0;
        this.onGround = true;
      } else if (ground !== undefined && this.group.position.y > ground + 0.05) {
        this.onGround = false;
      }
    }

    const swing = moving ? Math.sin(this.walkPhase) * 0.45 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.6;
    this.rightArm.rotation.x = swing * 0.6;
    this.body.position.y = 1.15 + (moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.04 : 0);
  }

  get position(): THREE.Vector3 { return this.group.position; }
}