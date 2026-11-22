export interface GameSystem {
  readonly name: string;
  readonly order: number;
  update(deltaSeconds: number): void;
}

export type RenderCallback = (interpolation: number, frameSeconds: number, timestamp: number) => void;

/** Fixed-step accumulator with an explicit spiral-of-death guard. */
export class FixedStepLoop {
  readonly stepSeconds: number;
  readonly maxStepsPerFrame: number;
  private readonly systems: readonly GameSystem[];
  private readonly render: RenderCallback;
  private accumulator = 0;
  private frameHandle: number | undefined;
  private lastTimestamp = 0;
  private running = false;

  constructor(systems: readonly GameSystem[], render: RenderCallback, stepSeconds = 1 / 60, maxStepsPerFrame = 5) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) throw new RangeError('The fixed step must be greater than zero.');
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) throw new RangeError('At least one fixed step must be allowed per frame.');
    this.systems = [...systems].sort((left, right) => left.order - right.order);
    this.render = render;
    this.stepSeconds = stepSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  advance(frameSeconds: number, timestamp = performance.now()): number {
    const elapsed = Number.isFinite(frameSeconds) ? frameSeconds : 0;
    const safeDelta = Math.min(Math.max(elapsed, 0), this.stepSeconds * this.maxStepsPerFrame);
    this.accumulator += safeDelta;
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      for (const system of this.systems) system.update(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps += 1;
    }
    this.render(this.accumulator / this.stepSeconds, safeDelta, timestamp);
    return steps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.frameHandle !== undefined) cancelAnimationFrame(this.frameHandle);
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running) return;
    const elapsed = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.advance(elapsed);
    this.frameHandle = requestAnimationFrame(this.frame);
  };
}
