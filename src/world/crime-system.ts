export type CrimeKind = 'vehicleTheft' | 'pedestrianImpact' | 'recklessDriving';

export interface CrimeEvent {
  readonly kind: CrimeKind;
  readonly x: number;
  readonly z: number;
}

const WEIGHTS: Readonly<Record<CrimeKind, number>> = {
  vehicleTheft: 2,
  pedestrianImpact: 3,
  recklessDriving: 1,
};

/** Repeated contacts must not add a star every frame. */
const COOLDOWNS: Readonly<Record<CrimeKind, number>> = {
  vehicleTheft: 8,
  pedestrianImpact: 4,
  recklessDriving: 6,
};

/**
 * Tracks notoriety and the transition to a bust. Heat is continuous so decay
 * can depend on whether the police are actually pressing the player; stars are
 * only the rounded value shown in the HUD and used to size the pursuit.
 */
export class CrimeSystem {
  private heat = 0;
  private bustTimer = 0;
  private elapsed = 0;
  private lastEvent: CrimeEvent | undefined;
  private events = 0;
  private readonly cooldownUntil: Record<CrimeKind, number> = {
    vehicleTheft: 0,
    pedestrianImpact: 0,
    recklessDriving: 0,
  };

  get stars(): number {
    return Math.min(5, Math.max(0, Math.ceil(this.heat - 0.001)));
  }

  get value(): number {
    return this.heat;
  }

  get busted(): boolean {
    return this.bustTimer >= 2;
  }

  get eventCount(): number {
    return this.events;
  }

  get lastCrime(): CrimeEvent | undefined {
    return this.lastEvent;
  }

  /** Returns false when the same crime is still on cooldown. */
  report(kind: CrimeKind, x: number, z: number): boolean {
    if (this.elapsed < this.cooldownUntil[kind]) return false;
    this.cooldownUntil[kind] = this.elapsed + COOLDOWNS[kind];
    this.heat = Math.min(5, this.heat + WEIGHTS[kind]);
    this.lastEvent = { kind, x, z };
    this.events += 1;
    return true;
  }

  update(deltaSeconds: number, nearestPoliceMeters: number, playerSpeed: number): void {
    this.elapsed += Math.max(deltaSeconds, 0);
    if (this.heat <= 0) {
      this.bustTimer = 0;
      return;
    }
    const pressed = nearestPoliceMeters < 120;
    const escaped = nearestPoliceMeters > 260;
    if (escaped) this.heat = Math.max(0, this.heat - deltaSeconds * 0.09);
    else if (!pressed) this.heat = Math.max(0, this.heat - deltaSeconds * 0.025);
    if (this.stars === 0) this.heat = 0;
    if (pressed && nearestPoliceMeters < 7 && playerSpeed < 2.5) this.bustTimer += deltaSeconds;
    else this.bustTimer = Math.max(0, this.bustTimer - deltaSeconds * 0.5);
  }

  reset(): void {
    this.heat = 0;
    this.bustTimer = 0;
    this.lastEvent = undefined;
    this.cooldownUntil.vehicleTheft = 0;
    this.cooldownUntil.pedestrianImpact = 0;
    this.cooldownUntil.recklessDriving = 0;
  }
}
