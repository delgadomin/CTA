import { Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { InputManager, MovementAxes } from './input-manager';

export type CameraMode = 'free' | 'thirdPerson';

export class CameraRig {
  mode: CameraMode = 'free';
  occlusion: ((origin: Vector3, dir: Vector3, maxDist: number) => number) | undefined;
  private yaw = 0.58;
  private pitch = -0.27;
  private readonly direction = new Vector3();
  private readonly target = new Vector3();
  private readonly orbitOffset = new Vector3();
  private readonly orbitEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly upAxis = new Vector3(0, 1, 0);
  private readonly axes: MovementAxes = { horizontal: 0, vertical: 0 };
  private mouseX = 0;
  private mouseY = 0;
  private readonly camera: PerspectiveCamera;
  private readonly input: InputManager;
  private readonly moveSpeed: number;
  private readonly mouseSensitivity: number;

  constructor(
    camera: PerspectiveCamera,
    input: InputManager,
    moveSpeed = 8,
    mouseSensitivity = 0.002,
    initialYaw = 0.58,
    initialPitch = -0.27,
  ) {
    this.camera = camera;
    this.input = input;
    this.moveSpeed = moveSpeed;
    this.mouseSensitivity = mouseSensitivity;
    this.yaw = initialYaw;
    this.pitch = MathUtils.clamp(initialPitch, -1.45, 1.45);
    this.camera.rotation.order = 'YXZ';
    this.syncRotation();
  }

  toggleMode(): CameraMode {
    this.mode = this.mode === 'free' ? 'thirdPerson' : 'free';
    return this.mode;
  }

  getYaw(): number { return this.yaw; }

  update(deltaSeconds: number, focus?: Vector3): void {
    this.input.sampleGamepad();
    if (this.input.consumePressed('lookToggle')) this.toggleMode();
    this.mouseX = this.input.lookX;
    this.mouseY = this.input.lookY;
    this.input.consumeLookDelta();
    this.yaw -= this.mouseX * this.mouseSensitivity;
    this.pitch = MathUtils.clamp(this.pitch - this.mouseY * this.mouseSensitivity, -1.45, 1.45);
    this.syncRotation();

    if (this.mode === 'thirdPerson' && focus) {
      this.target.copy(focus);
      this.orbitEuler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.orbitOffset.set(0, 2.6, 7.5).applyEuler(this.orbitEuler);
      const desired = this.target.clone().add(this.orbitOffset);
      if (this.occlusion) {
        const dir = desired.clone().sub(this.target);
        const maxDist = dir.length();
        if (maxDist > 0.01) {
          dir.normalize();
          const toi = this.occlusion(this.target, dir, maxDist);
          if (toi < maxDist - 0.2) {
            this.camera.position.copy(this.target).addScaledVector(dir, Math.max(0.5, toi - 0.3));
            this.camera.lookAt(this.target);
            return;
          }
        }
      }
      this.camera.position.copy(desired);
      this.camera.lookAt(this.target);
      return;
    }

    this.input.movement(this.axes);
    this.direction.set(this.axes.horizontal, 0, -this.axes.vertical).applyAxisAngle(this.upAxis, this.yaw);
    const speedMultiplier = this.input.isPressed('sprint') ? 5 : 1;
    this.camera.position.addScaledVector(this.direction, this.moveSpeed * speedMultiplier * deltaSeconds);
  }

  private syncRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
