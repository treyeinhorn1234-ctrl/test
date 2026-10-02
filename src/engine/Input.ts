import type { Action, Settings } from '../core/Settings';

/**
 * Gestion centralisée du clavier et de la souris.
 * Les touches sont abstraites en actions (voir Settings.bindings), ce qui
 * permet la reconfiguration des commandes.
 */
export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private releasedThisFrame = new Set<string>();
  /** Position souris en coordonnées normalisées (-1..1). */
  readonly mouseNdc = { x: 0, y: 0 };
  wheelDelta = 0;
  /** Si défini, la prochaine touche est capturée (reconfiguration). */
  private captureResolver: ((code: string | null) => void) | null = null;
  private layoutMap: Map<string, string> | null = null;
  enabled = true;

  constructor(
    private readonly settings: Settings,
    private readonly element: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    element.addEventListener('wheel', this.onWheel, { passive: true });
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    this.loadLayoutMap();
  }

  /** Récupère les libellés réels des touches selon la disposition du clavier. */
  private async loadLayoutMap(): Promise<void> {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
    if (!kb?.getLayoutMap) return;
    try {
      this.layoutMap = await kb.getLayoutMap();
    } catch {
      this.layoutMap = null;
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.captureResolver) {
      e.preventDefault();
      const r = this.captureResolver;
      this.captureResolver = null;
      r(e.code === 'Escape' ? null : e.code);
      return;
    }
    // Empêche le défilement de la page avec Espace / Tab.
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    this.press(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => this.release(e.code);

  private onMouseDown = (e: MouseEvent): void => {
    const code = `Mouse${e.button}`;
    if (this.captureResolver) {
      e.preventDefault();
      const r = this.captureResolver;
      this.captureResolver = null;
      r(code);
      return;
    }
    this.press(code);
  };

  private onMouseUp = (e: MouseEvent): void => this.release(`Mouse${e.button}`);

  private onMouseMove = (e: MouseEvent): void => {
    const r = this.element.getBoundingClientRect();
    this.mouseNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouseNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  };

  private onWheel = (e: WheelEvent): void => {
    this.wheelDelta += Math.sign(e.deltaY);
  };

  private onBlur = (): void => {
    this.down.clear();
  };

  private press(code: string): void {
    if (!this.down.has(code)) this.pressedThisFrame.add(code);
    this.down.add(code);
  }

  private release(code: string): void {
    if (this.down.delete(code)) this.releasedThisFrame.add(code);
  }

  private codeOf(action: Action): string {
    return this.settings.data.bindings[action];
  }

  isDown(action: Action): boolean {
    if (!this.enabled) return false;
    const code = this.codeOf(action);
    if (this.down.has(code)) return true;
    // Shift gauche/droite sont interchangeables.
    if (code === 'ShiftLeft') return this.down.has('ShiftRight');
    return false;
  }

  wasPressed(action: Action): boolean {
    if (!this.enabled && action !== 'pause') return false;
    return this.pressedThisFrame.has(this.codeOf(action));
  }

  wasReleased(action: Action): boolean {
    return this.releasedThisFrame.has(this.codeOf(action));
  }

  /** Vecteur de déplacement brut (x: droite, y: haut écran). */
  moveAxis(): { x: number; y: number } {
    const x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    const y = (this.isDown('moveUp') ? 1 : 0) - (this.isDown('moveDown') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  consumeWheel(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  /** Attend la prochaine touche ou clic (Échap annule → null). */
  captureNext(): Promise<string | null> {
    this.captureResolver?.(null);
    return new Promise((resolve) => {
      this.captureResolver = resolve;
    });
  }

  /** Libellé lisible d'un code de touche, adapté à la disposition clavier. */
  label(code: string): string {
    const special: Record<string, string> = {
      Mouse0: 'Clic G',
      Mouse1: 'Clic M',
      Mouse2: 'Clic D',
      Mouse3: 'Souris 4',
      Mouse4: 'Souris 5',
      Space: 'Espace',
      ShiftLeft: 'Maj',
      ShiftRight: 'Maj D',
      ControlLeft: 'Ctrl',
      ControlRight: 'Ctrl D',
      AltLeft: 'Alt',
      Escape: 'Échap',
      Tab: 'Tab',
      Enter: 'Entrée',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
    };
    if (special[code]) return special[code];
    const mapped = this.layoutMap?.get(code);
    if (mapped) return mapped.toUpperCase();
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  actionLabel(action: Action): string {
    return this.label(this.codeOf(action));
  }

  /**
   * À appeler en fin de frame. `keepGameplay` conserve les appuis (sauf
   * pause) quand la simulation n'a pas tourné — ex. pendant un gel d'impact —
   * pour qu'aucun clic de combo ne soit perdu.
   */
  endFrame(keepGameplay = false): void {
    if (keepGameplay) this.pressedThisFrame.delete(this.codeOf('pause'));
    else this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  clearAll(): void {
    this.down.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }
}
