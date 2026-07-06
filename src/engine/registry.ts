/**
 * Generic id-keyed registry. Items (Phase 2), entities (Phase 2), and any
 * future content type register here — game code looks content up by id and
 * never depends on concrete implementations (open/closed principle).
 */
export class Registry<T extends { id: string }> {
  private readonly entries = new Map<string, T>();

  register(entry: T): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Registry: duplicate id "${entry.id}"`);
    }
    this.entries.set(entry.id, entry);
  }

  get(id: string): T | undefined {
    return this.entries.get(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  all(): readonly T[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }
}
