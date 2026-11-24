export type GameAction =
  'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight' | 'sprint' | 'lookToggle';
export type InputBindings = Readonly<Record<GameAction, string>>;

export const DEFAULT_BINDINGS: InputBindings = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  sprint: 'ShiftLeft',
  lookToggle: 'Tab',
};

export interface MovementAxes {
  horizontal: number;
  vertical: number;
}

export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly bindingMap = new Map<GameAction, string>();
  private pointerLocked = false;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private disposed = false;
  private readonly target: HTMLElement;
  private gamepadIndex: number | undefined;
  private gamepadTogglePressed = false;
  private gamepadToggleJustPressed = false;
  private stickX = 0;
  private stickY = 0;

  get lookX(): number {
    return this.lookDeltaX;
  }
  get lookY(): number {
    return this.lookDeltaY;
  }

  constructor(target: HTMLElement, bindings: InputBindings = DEFAULT_BINDINGS) {
    this.target = target;
    for (const [action, code] of Object.entries(bindings) as [GameAction, string][]) {
      this.bindingMap.set(action, code);
    }
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearPressed);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  rebind(action: GameAction, code: string): void {
    this.bindingMap.set(action, code);
  }

  isPressed(action: GameAction): boolean {
    if (action === 'sprint' && (this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight')))
      return true;
    const code = this.bindingMap.get(action);
    return code !== undefined && this.pressed.has(code);
  }

  consumePressed(action: GameAction): boolean {
    const code = this.bindingMap.get(action);
    const keyPressed = code !== undefined && this.justPressed.delete(code);
    const gamepadPressed = action === 'lookToggle' && this.gamepadToggleJustPressed;
    this.gamepadToggleJustPressed = false;
    return keyPressed || gamepadPressed;
  }

  sampleGamepad(): void {
    if (this.gamepadIndex === undefined) return;
    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad?.connected) {
      this.gamepadIndex = undefined;
      this.stickX = 0;
      this.stickY = 0;
      this.gamepadTogglePressed = false;
      return;
    }
    this.stickX = this.withDeadzone(gamepad.axes[0] ?? 0);
    this.stickY = this.withDeadzone(gamepad.axes[1] ?? 0);
    const togglePressed = gamepad.buttons[0]?.pressed ?? false;
    if (togglePressed && !this.gamepadTogglePressed) this.gamepadToggleJustPressed = true;
    this.gamepadTogglePressed = togglePressed;
    this.lookDeltaX += this.withDeadzone(gamepad.axes[2] ?? 0) * 6;
    this.lookDeltaY += this.withDeadzone(gamepad.axes[3] ?? 0) * 6;
  }

  movement(result: MovementAxes): void {
    const horizontal =
      Number(this.isPressed('moveRight')) - Number(this.isPressed('moveLeft')) + this.stickX;
    const vertical =
      Number(this.isPressed('moveForward')) - Number(this.isPressed('moveBack')) - this.stickY;
    const magnitude = Math.hypot(horizontal, vertical);
    const divisor = magnitude > 1 ? magnitude : 1;
    result.horizontal = horizontal / divisor;
    result.vertical = vertical / divisor;
  }

  consumeLookDelta(): void {
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  }

  requestPointerLock(): void {
    if (!this.disposed) void this.target.requestPointerLock();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearPressed);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    this.clearPressed();
    this.justPressed.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.pressed.has(event.code)) this.justPressed.add(event.code);
    this.pressed.add(event.code);
    if (event.code === 'Tab' || event.code.startsWith('Arrow')) event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly clearPressed = (): void => {
    this.pressed.clear();
  };

  private readonly handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.target;
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookDeltaX += event.movementX;
    this.lookDeltaY += event.movementY;
  };

  private readonly handleGamepadConnected = (event: GamepadEvent): void => {
    this.gamepadIndex = event.gamepad.index;
  };

  private readonly handleGamepadDisconnected = (event: GamepadEvent): void => {
    if (event.gamepad.index !== this.gamepadIndex) return;
    this.gamepadIndex = undefined;
    this.stickX = 0;
    this.stickY = 0;
    this.gamepadTogglePressed = false;
  };

  private withDeadzone(value: number): number {
    const deadzone = 0.16;
    if (Math.abs(value) <= deadzone) return 0;
    return Math.sign(value) * ((Math.abs(value) - deadzone) / (1 - deadzone));
  }
}
