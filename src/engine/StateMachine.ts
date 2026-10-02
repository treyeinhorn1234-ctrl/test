/**
 * Machine à états finis générique, utilisée par le joueur, l'IA des ennemis
 * et le flux global du jeu. Chaque état est un objet avec des hooks optionnels.
 */
export interface State<Ctx, Id extends string> {
  enter?(ctx: Ctx, prev: Id | null): void;
  update?(ctx: Ctx, dt: number): Id | void;
  exit?(ctx: Ctx, next: Id): void;
}

export class StateMachine<Ctx, Id extends string> {
  private _current: Id | null = null;
  private _time = 0;

  constructor(
    private readonly ctx: Ctx,
    private readonly states: Record<Id, State<Ctx, Id>>,
  ) {}

  get current(): Id | null {
    return this._current;
  }

  /** Temps passé dans l'état courant (secondes). */
  get time(): number {
    return this._time;
  }

  is(...ids: Id[]): boolean {
    return this._current !== null && ids.includes(this._current);
  }

  set(id: Id, force = false): void {
    if (id === this._current && !force) return;
    const prev = this._current;
    if (prev !== null) this.states[prev].exit?.(this.ctx, id);
    this._current = id;
    this._time = 0;
    this.states[id].enter?.(this.ctx, prev);
  }

  update(dt: number): void {
    if (this._current === null) return;
    this._time += dt;
    const next = this.states[this._current].update?.(this.ctx, dt);
    if (next && next !== this._current) this.set(next);
  }
}
