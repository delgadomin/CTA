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
  private readonly proceduralVisual = new THREE.Group();
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly body: THREE.Mesh;
  private walkPhase = 0;
  private vy = 0;
  private onGround = true;
  private mixer: THREE.AnimationMixer | undefined;
  private idleAction: THREE.AnimationAction | undefined;
  private walkAction: THREE.AnimationAction | undefined;
  private activeAction: THREE.AnimationAction | undefined;

  constructor() {
    this.group = new THREE.Group();
    this.group.add(this.proceduralVisual);

    const material = (color: number, roughness = 0.6, metalness = 0.05) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // A broad shoulder line and tapered waist create a readable human silhouette
    // at the fixed third-person camera distance.
    const torsoGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.58, 10, 1);
    torsoGeo.scale(1, 1, 0.76);
    this.body = new THREE.Mesh(torsoGeo, material(BODY_COLOR));
    this.body.position.y = 1.16;
    this.body.castShadow = true;
    this.proceduralVisual.add(this.body);

    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.42, 8), material(0xe6ddc8));
    shirt.scale.z = 0.82;
    shirt.position.set(0, 1.16, 0.17);
    this.proceduralVisual.add(shirt);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 10), material(0x263f44));
    collar.position.y = 1.48;
    collar.castShadow = true;
    this.proceduralVisual.add(collar);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.09, 10), material(0x2a5054));
    hem.position.y = 0.88;
    this.proceduralVisual.add(hem);

    const lapelMaterial = material(0x517a7d);
    for (const side of [-1, 1]) {
      const lapel = new THREE.BufferGeometry();
      lapel.setAttribute('position', new THREE.Float32BufferAttribute([
        side * 0.025, 1.45, 0.207,
        side * 0.16, 1.37, 0.207,
        side * 0.07, 1.08, 0.218,
      ], 3));
      lapel.computeVertexNormals();
      const panel = new THREE.Mesh(lapel, lapelMaterial);
      panel.castShadow = true;
      this.proceduralVisual.add(panel);
    }
    const pocket = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 2, 6), material(0x31565a));
    pocket.scale.set(1, 0.7, 0.3);
    pocket.position.set(-0.16, 1.12, 0.205);
    this.proceduralVisual.add(pocket);

    // Head (sphere).
    const headGeo = new THREE.SphereGeometry(0.18, 24, 16);
    const head = new THREE.Mesh(headGeo, material(SKIN_COLOR, 0.5));
    head.position.y = 1.68;
    head.castShadow = true;
    this.proceduralVisual.add(head);

    // Hair (small sphere cap).
    const hairGeo = new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const hair = new THREE.Mesh(hairGeo, material(HAIR_COLOR, 0.7));
    hair.position.y = 1.72;
    hair.castShadow = true;
    this.proceduralVisual.add(hair);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), material(HAIR_COLOR));
    fringe.scale.set(1.25, 0.62, 0.52);
    fringe.position.set(0, 1.72, 0.13);
    this.proceduralVisual.add(fringe);
    const eyeMaterial = material(0x292522, 0.45);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMaterial);
      eye.position.set(side * 0.055, 1.685, 0.169);
      this.proceduralVisual.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), material(SKIN_COLOR, 0.5));
    nose.scale.set(0.68, 0.8, 1.15);
    nose.position.set(0, 1.65, 0.18);
    this.proceduralVisual.add(nose);
    const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.05, 2, 6), material(0x805a4a, 0.7));
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, 1.605, 0.175);
    this.proceduralVisual.add(mouth);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), material(SKIN_COLOR, 0.5));
      ear.scale.set(0.55, 0.85, 0.55);
      ear.position.set(side * 0.17, 1.67, 0);
      this.proceduralVisual.add(ear);
    }

    // Layered sleeves and cuffs keep the arms from reading as plain rods.
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.27, 4, 8);
    this.leftArm = new THREE.Group();
    const la = new THREE.Mesh(armGeo, material(BODY_COLOR));
    la.position.y = -0.28;
    this.leftArm.add(la);
    this.leftArm.position.set(-0.38, 1.4, 0);
    this.proceduralVisual.add(this.leftArm);

    this.rightArm = new THREE.Group();
    const ra = new THREE.Mesh(armGeo, material(BODY_COLOR));
    ra.position.y = -0.28;
    this.rightArm.add(ra);
    this.rightArm.position.set(0.38, 1.4, 0);
    this.proceduralVisual.add(this.rightArm);

    // Hands (small spheres).
    const cuffGeo = new THREE.CylinderGeometry(0.075, 0.082, 0.09, 8);
    const lc = new THREE.Mesh(cuffGeo, material(0x233f43));
    lc.position.set(0, -0.49, 0);
    this.leftArm.add(lc);
    const rc = new THREE.Mesh(cuffGeo, material(0x233f43));
    rc.position.set(0, -0.49, 0);
    this.rightArm.add(rc);
    const handGeo = new THREE.SphereGeometry(0.075, 10, 7);
    const lh = new THREE.Mesh(handGeo, material(SKIN_COLOR, 0.5));
    lh.position.set(0, -0.58, 0);
    this.leftArm.add(lh);
    const rh = new THREE.Mesh(handGeo, material(SKIN_COLOR, 0.5));
    rh.position.set(0, -0.58, 0);
    this.rightArm.add(rh);

    // Legs (cylinders).
    const legGeo = new THREE.CapsuleGeometry(0.095, 0.4, 4, 8);
    const footGeo = new THREE.CapsuleGeometry(0.085, 0.16, 3, 8);
    footGeo.scale(1, 0.62, 1.65);
    const soleGeo = new THREE.CapsuleGeometry(0.09, 0.17, 3, 8);
    soleGeo.scale(1, 0.2, 1.65);
    this.leftLeg = new THREE.Group();
    const ll = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    ll.position.y = -0.35;
    this.leftLeg.add(ll);
    const lf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    lf.position.set(0, -0.69, 0.11);
    this.leftLeg.add(lf);
    const leftSole = new THREE.Mesh(soleGeo, material(0x111315, 0.8));
    leftSole.position.set(0, -0.75, 0.11);
    this.leftLeg.add(leftSole);
    this.leftLeg.position.set(-0.14, 0.75, 0);
    this.proceduralVisual.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rl = new THREE.Mesh(legGeo, material(PANTS_COLOR));
    rl.position.y = -0.35;
    this.rightLeg.add(rl);
    const rf = new THREE.Mesh(footGeo, material(SHOE_COLOR, 0.4, 0.1));
    rf.position.set(0, -0.69, 0.11);
    this.rightLeg.add(rf);
    const rightSole = new THREE.Mesh(soleGeo, material(0x111315, 0.8));
    rightSole.position.set(0, -0.75, 0.11);
    this.rightLeg.add(rightSole);
    this.rightLeg.position.set(0.14, 0.75, 0);
    this.proceduralVisual.add(this.rightLeg);
  }

  async loadModel(chunks: ChunkManager, url: string): Promise<void> {
    const gltf = await chunks.loadModel(url, 100);
    const model = gltf.scene;
    model.name = 'CC0 detailed player character';
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.group.add(model);
    this.proceduralVisual.visible = false;
    this.mixer = new THREE.AnimationMixer(model);
    this.idleAction = this.mixer.clipAction(gltf.animations.find((clip) => clip.name.toLowerCase() === 'idle') ?? gltf.animations[0]!);
    this.walkAction = this.mixer.clipAction(gltf.animations.find((clip) => clip.name.toLowerCase() === 'walk') ?? gltf.animations[0]!);
    this.activeAction = this.idleAction;
    this.activeAction?.play();
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

    if (this.mixer) {
      const nextAction = moving ? this.walkAction : this.idleAction;
      if (nextAction && nextAction !== this.activeAction) {
        this.activeAction?.fadeOut(0.18);
        nextAction.reset().fadeIn(0.18).play();
        this.activeAction = nextAction;
      }
      this.mixer.update(deltaSeconds);
      return;
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
