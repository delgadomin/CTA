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

    // Softly tailored jacket, with a visible collar and hem to read as a
    // person at the game's normal third-person camera distance.
    const torsoGeo = new THREE.CapsuleGeometry(0.27, 0.34, 5, 12);
    this.body = new THREE.Mesh(torsoGeo, material(BODY_COLOR));
    this.body.position.y = 1.15;
    this.body.castShadow = true;
    this.group.add(this.body);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.1, 12), material(0x233f43));
    collar.position.y = 1.47;
    collar.castShadow = true;
    this.group.add(collar);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.1, 12), material(0x2a5054));
    hem.position.y = 0.85;
    this.group.add(hem);

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
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), material(HAIR_COLOR));
    fringe.scale.set(1.25, 0.62, 0.52);
    fringe.position.set(0, 1.72, 0.13);
    this.group.add(fringe);
    const eyeMaterial = material(0x292522, 0.45);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMaterial);
      eye.position.set(side * 0.055, 1.685, 0.169);
      this.group.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), material(SKIN_COLOR, 0.5));
    nose.scale.set(0.68, 0.8, 1.15);
    nose.position.set(0, 1.65, 0.18);
    this.group.add(nose);

    // Arms (cylinders).
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.35, 4, 10);
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
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.43, 4, 10);
    const footGeo = new THREE.BoxGeometry(0.18, 0.13, 0.32);
    this.leftLeg = new THREE.Group();
    const ll = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    ll.position.y = -0.35;
    this.leftLeg.add(ll);
    const lf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    lf.position.set(0, -0.69, 0.09);
    this.leftLeg.add(lf);
    this.leftLeg.position.set(-0.14, 0.75, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rl = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    rl.position.y = -0.35;
    this.rightLeg.add(rl);
    const rf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    rf.position.set(0, -0.69, 0.09);
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
      const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepZ)) / 0.2));
      const incrementX = stepX / substeps;
      const incrementZ = stepZ / substeps;
      for (let index = 0; index < substeps; index += 1) {
        const nextX = this.group.position.x + incrementX;
        if (chunks && (chunks.groundHeightAt(nextX, this.group.position.z) === undefined || chunks.collidesWithBuilding(nextX, this.group.position.z, 0.4))) break;
        this.group.position.x = nextX;
        const nextZ = this.group.position.z + incrementZ;
        if (chunks && (chunks.groundHeightAt(this.group.position.x, nextZ) === undefined || chunks.collidesWithBuilding(this.group.position.x, nextZ, 0.4))) break;
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

    if (chunks) {
      const ground = chunks.groundHeightAt(this.group.position.x, this.group.position.z);
      if (ground === undefined) {
        // Chunks can unload while the player is near a streaming boundary.
        // Keep the last safe height until collision data becomes available.
        this.vy = 0;
        this.onGround = true;
      } else {
        this.vy -= 18 * deltaSeconds;
        this.group.position.y += this.vy * deltaSeconds;
        // Snap to rising slopes while grounded and catch the floor in the same
        // frame when falling, instead of waiting for the next render frame.
        if ((this.onGround && this.vy <= 0) || this.group.position.y <= ground + 0.08) {
          this.group.position.y = ground;
          this.vy = 0;
          this.onGround = true;
        } else {
          this.onGround = false;
        }
      }
    } else {
      this.vy -= 18 * deltaSeconds;
      this.group.position.y += this.vy * deltaSeconds;
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
