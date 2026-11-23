import * as THREE from 'three';
import type { ChunkManager } from './chunk-manager';
import type { InputManager, MovementAxes } from '../engine/input-manager';

const BODY_COLOR = 0x3a6b6f;
const SKIN_COLOR = 0xd9b08c;
const PANTS_COLOR = 0x2b2f36;
const SHOE_COLOR = 0x1a1a1a;

export class Character {
  readonly group: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly body: THREE.Mesh;
  private walkPhase = 0;

  constructor() {
    this.group = new THREE.Group();

    const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    this.body = new THREE.Mesh(torsoGeo, material(BODY_COLOR));
    this.body.position.y = 1.15;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.3);
    const head = new THREE.Mesh(headGeo, material(SKIN_COLOR));
    head.position.y = 1.68;
    head.castShadow = true;
    this.group.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
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

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    this.leftLeg = new THREE.Group();
    const ll = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    ll.position.y = -0.35;
    this.leftLeg.add(ll);
    this.leftLeg.position.set(-0.14, 0.75, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rl = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    rl.position.y = -0.35;
    this.rightLeg.add(rl);
    this.rightLeg.position.set(0.14, 0.75, 0);
    this.group.add(this.rightLeg);

    // Feet
    const footGeo = new THREE.BoxGeometry(0.22, 0.12, 0.3);
    const lf = new THREE.Mesh(footGeo, material(SHOE_COLOR));
    lf.position.set(-0.14, 0.06, 0.05);
    this.group.add(lf);
    const rf = new THREE.Mesh(footGeo, material(SHOE_COLOR));
    rf.position.set(0.14, 0.06, 0.05);
    this.group.add(rf);
  }

  update(deltaSeconds: number, input: InputManager, chunks: ChunkManager | undefined, cameraYaw: number): void {
    const axes: MovementAxes = { horizontal: 0, vertical: 0 };
    input.movement(axes);
    const moving = Math.hypot(axes.horizontal, axes.vertical) > 0.01;
    if (moving) {
      // Movement direction relative to camera yaw (matches CameraRig free mode).
      const dirX = axes.horizontal * Math.cos(cameraYaw) - axes.vertical * Math.sin(cameraYaw);
      const dirZ = -axes.horizontal * Math.sin(cameraYaw) - axes.vertical * Math.cos(cameraYaw);
      const speed = input.isPressed('sprint') ? 5.5 : 2.6;
      const length = Math.hypot(dirX, dirZ) || 1;
      this.group.position.x += (dirX / length) * speed * deltaSeconds;
      this.group.position.z += (dirZ / length) * speed * deltaSeconds;
      const targetYaw = Math.atan2(dirX, dirZ);
      // Smooth rotation.
      let diff = targetYaw - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, deltaSeconds * 12);
      this.walkPhase += deltaSeconds * (input.isPressed('sprint') ? 14 : 9);
    } else {
      this.walkPhase = 0;
    }

    // Snap to terrain.
    if (chunks) {
      const h = chunks.groundHeightAt(this.group.position.x, this.group.position.z);
      if (h !== undefined) this.group.position.y = h;
    }

    // Animation.
    const swing = moving ? Math.sin(this.walkPhase) * 0.45 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.6;
    this.rightArm.rotation.x = swing * 0.6;
    this.body.position.y = 1.15 + (moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.04 : 0);
  }

  get position(): THREE.Vector3 { return this.group.position; }
}
