export type EntityId = number;

const INDEX_BITS = 16;
const INDEX_MASK = (1 << INDEX_BITS) - 1;

/** Fixed-capacity structure-of-arrays store for allocation-free system iteration. */
export class EntityStore {
  readonly capacity: number;
  readonly active: Uint8Array;
  readonly position: Float32Array;
  readonly rotation: Float32Array;
  readonly scale: Float32Array;

  private readonly generations: Uint16Array;
  private readonly freeSlots: Uint16Array;
  private freeCount: number;

  constructor(capacity = 2048) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > INDEX_MASK) {
      throw new RangeError(`Entity capacity must be between 1 and ${INDEX_MASK}.`);
    }
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.position = new Float32Array(capacity * 3);
    this.rotation = new Float32Array(capacity * 3);
    this.scale = new Float32Array(capacity * 3);
    this.generations = new Uint16Array(capacity);
    this.freeSlots = new Uint16Array(capacity);
    this.freeCount = capacity;
    for (let slot = 0; slot < capacity; slot += 1) {
      this.freeSlots[slot] = capacity - slot - 1;
      this.generations[slot] = 1;
    }
  }

  create(): EntityId {
    if (this.freeCount === 0) throw new Error('Entity capacity exhausted.');
    this.freeCount -= 1;
    const slot = this.freeSlots[this.freeCount];
    if (slot === undefined) throw new Error('Entity free list is corrupt.');
    this.active[slot] = 1;
    this.setVector(this.position, slot, 0, 0, 0);
    this.setVector(this.rotation, slot, 0, 0, 0);
    this.setVector(this.scale, slot, 1, 1, 1);
    return this.pack(slot, this.generations[slot] ?? 1);
  }

  destroy(id: EntityId): boolean {
    const slot = this.resolve(id);
    if (slot < 0) return false;
    this.active[slot] = 0;
    this.generations[slot] = ((this.generations[slot] ?? 0) + 1) & 0xffff;
    if (this.generations[slot] === 0) this.generations[slot] = 1;
    this.freeSlots[this.freeCount] = slot;
    this.freeCount += 1;
    return true;
  }

  isAlive(id: EntityId): boolean {
    return this.resolve(id) >= 0;
  }

  setPosition(id: EntityId, x: number, y: number, z: number): void {
    this.setVector(this.position, this.requireSlot(id), x, y, z);
  }

  setRotation(id: EntityId, x: number, y: number, z: number): void {
    this.setVector(this.rotation, this.requireSlot(id), x, y, z);
  }

  forEachTransform(
    callback: (id: EntityId, x: number, y: number, z: number, rotationY: number) => void,
  ): void {
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (this.active[slot] === 0) continue;
      const offset = slot * 3;
      callback(
        this.pack(slot, this.generations[slot] ?? 1),
        this.position[offset] ?? 0,
        this.position[offset + 1] ?? 0,
        this.position[offset + 2] ?? 0,
        this.rotation[offset + 1] ?? 0,
      );
    }
  }

  private setVector(array: Float32Array, slot: number, x: number, y: number, z: number): void {
    const offset = slot * 3;
    array[offset] = x;
    array[offset + 1] = y;
    array[offset + 2] = z;
  }

  private resolve(id: EntityId): number {
    const slot = id & INDEX_MASK;
    const generation = id >>> INDEX_BITS;
    if (slot >= this.capacity || this.active[slot] !== 1) return -1;
    return this.generations[slot] === generation ? slot : -1;
  }

  private requireSlot(id: EntityId): number {
    const slot = this.resolve(id);
    if (slot < 0) throw new Error(`Entity ${id} is not alive.`);
    return slot;
  }

  private pack(slot: number, generation: number): EntityId {
    return (generation << INDEX_BITS) | slot;
  }
}
