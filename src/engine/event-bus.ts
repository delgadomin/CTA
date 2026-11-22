type Listener<T> = (payload: T) => void;

/** Typed, instance-scoped event bus. Subscriptions must be removed by their owner. */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set<Listener<unknown>>();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>): void {
    const bucket = this.listeners.get(event);
    bucket?.delete(listener as Listener<unknown>);
    if (bucket?.size === 0) this.listeners.delete(event);
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    for (const listener of bucket) listener(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
