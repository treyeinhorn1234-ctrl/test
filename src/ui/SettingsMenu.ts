import { ACTION_LABELS, QUALITY_PRESETS, type Action, type QualityPreset, type Settings } from '../core/Settings';
import type { Input } from '../engine/Input';

type Tab = 'graphics' | 'audio' | 'controls';

/**
 * Paramètres : graphismes (qualité, taille des pixels / résolution interne,
 * post-traitement, brouillard, luminosité, saturation, IPS), audio (volumes
 * indépendants) et reconfiguration des touches. Tout est sauvegardé.
 */
export class SettingsMenu {
  readonly root: HTMLElement;
  private body: HTMLElement;
  private tabs = new Map<Tab, HTMLButtonElement>();
  private onClose: () => void = () => {};
  private listening: Action | null = null;

  constructor(
    parent: HTMLElement,
    private readonly settings: Settings,
    private readonly input: Input,
    private readonly internalResolution: () => string,
    private readonly uiSound: (name: string) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'screen dim';
    parent.appendChild(this.root);
    const panel = document.createElement('div');
    panel.className = 'panel frame';
    this.root.appendChild(panel);
    const title = document.createElement('h2');
    title.textContent = 'Paramètres';
    panel.appendChild(title);
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    panel.appendChild(tabs);
    for (const [id, label] of [['graphics', 'Graphismes'], ['audio', 'Audio'], ['controls', 'Commandes']] as const) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = label;
      b.onclick = () => {
        this.uiSound('uiClick');
        this.show(id);
      };
      tabs.appendChild(b);
      this.tabs.set(id, b);
    }
    this.body = document.createElement('div');
    panel.appendChild(this.body);
    const footer = document.createElement('div');
    footer.className = 'panel-footer';
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = 'Retour';
    back.onclick = () => this.close();
    footer.appendChild(back);
    panel.appendChild(footer);
  }

  get isOpen(): boolean {
    return this.root.classList.contains('show');
  }

  open(tab: Tab, onClose: () => void): void {
    this.onClose = onClose;
    this.root.classList.add('show');
    this.show(tab);
  }

  close(): void {
    if (this.listening) return;
    this.uiSound('uiClick');
    this.root.classList.remove('show');
    this.onClose();
  }

  private show(tab: Tab): void {
    for (const [id, b] of this.tabs) b.classList.toggle('active', id === tab);
    this.body.innerHTML = '';
    if (tab === 'graphics') this.renderGraphics();
    else if (tab === 'audio') this.renderAudio();
    else this.renderControls();
  }

  private grid(cls = 'rows'): HTMLElement {
    const g = document.createElement('div');
    g.className = cls;
    this.body.appendChild(g);
    return g;
  }

  private slider(grid: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string, hint?: () => string): void {
    const l = document.createElement('div');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = `${min}`;
    input.max = `${max}`;
    input.step = `${step}`;
    input.value = `${get()}`;
    const val = document.createElement('div');
    val.className = 'val';
    val.textContent = fmt(get());
    let hintEl: HTMLElement | null = null;
    input.oninput = () => {
      set(parseFloat(input.value));
      val.textContent = fmt(get());
      if (hintEl && hint) hintEl.textContent = hint();
    };
    grid.append(l, input, val);
    if (hint) {
      hintEl = document.createElement('div');
      hintEl.className = 'hint';
      hintEl.textContent = hint();
      grid.appendChild(hintEl);
    }
  }

  private renderGraphics(): void {
    const g = this.grid();
    const s = this.settings;
    const l = document.createElement('div');
    l.textContent = 'Qualité';
    const sel = document.createElement('select');
    for (const [v, t] of [['low', 'Basse'], ['medium', 'Moyenne'], ['high', 'Élevée']] as const) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      sel.appendChild(o);
    }
    sel.value = s.data.graphics.quality;
    sel.onchange = () => {
      const q = sel.value as QualityPreset;
      s.update((d) => {
        d.graphics.quality = q;
        d.graphics.postLevel = QUALITY_PRESETS[q].postLevel;
      });
      this.show('graphics');
    };
    g.append(l, sel, document.createElement('div'));
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Basse : sans ombres, moins de particules · Moyenne/Élevée : ombres pixelisées, halo lumineux';
    g.appendChild(hint);

    const gr = (k: keyof typeof s.data.graphics) => s.data.graphics[k] as number;
    const set = (k: 'pixelSize' | 'postLevel' | 'fog' | 'brightness' | 'saturation') => (v: number) =>
      s.update((d) => {
        d.graphics[k] = v;
      });
    this.slider(g, 'Taille des pixels', 1, 6, 1, () => gr('pixelSize'), set('pixelSize'), (v) => `×${v}`, () => `Résolution interne : ${this.internalResolution()}`);
    this.slider(g, 'Post-traitement', 0, 2, 1, () => gr('postLevel'), set('postLevel'), (v) => ['Aucun', 'Étalonnage', 'Complet'][v]);
    this.slider(g, 'Brouillard', 0, 2, 0.1, () => gr('fog'), set('fog'), (v) => `${Math.round(v * 100)}%`);
    this.slider(g, 'Luminosité', 0.5, 1.6, 0.05, () => gr('brightness'), set('brightness'), (v) => `${Math.round(v * 100)}%`);
    this.slider(g, 'Saturation', 0, 1.6, 0.05, () => gr('saturation'), set('saturation'), (v) => `${Math.round(v * 100)}%`);

    const fl = document.createElement('div');
    fl.textContent = 'Afficher les IPS';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'check';
    cb.checked = s.data.graphics.showFps;
    cb.onchange = () =>
      s.update((d) => {
        d.graphics.showFps = cb.checked;
      });
    g.append(fl, cb, document.createElement('div'));
  }

  private renderAudio(): void {
    const g = this.grid();
    const s = this.settings;
    const entries = [['master', 'Volume général'], ['music', 'Musique'], ['sfx', 'Effets'], ['ambience', 'Ambiance']] as const;
    for (const [k, label] of entries) {
      this.slider(g, label, 0, 1, 0.05, () => s.data.audio[k], (v) => s.update((d) => {
        d.audio[k] = v;
      }), (v) => `${Math.round(v * 100)}%`);
    }
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Sons et musique actuels : placeholders procéduraux (voir src/audio/README.md).';
    g.appendChild(hint);
  }

  private renderControls(): void {
    const g = this.grid('rows binds');
    const s = this.settings;
    for (const action of Object.keys(ACTION_LABELS) as Action[]) {
      const l = document.createElement('div');
      l.textContent = ACTION_LABELS[action];
      const b = document.createElement('button');
      b.className = 'keybtn';
      b.textContent = this.input.label(s.data.bindings[action]);
      b.onclick = async () => {
        if (this.listening) return;
        this.listening = action;
        b.classList.add('listening');
        b.textContent = '…';
        const code = await this.input.captureNext();
        this.listening = null;
        if (code) {
          s.update((d) => {
            // Échange si la touche était déjà utilisée par une autre action.
            const prev = (Object.keys(d.bindings) as Action[]).find((a) => d.bindings[a] === code);
            if (prev && prev !== action) d.bindings[prev] = d.bindings[action];
            d.bindings[action] = code;
          });
        }
        this.input.clearAll();
        this.show('controls');
      };
      g.append(l, b);
    }
    const reset = document.createElement('button');
    reset.className = 'btn';
    reset.style.cssText = 'grid-column:1/-1;text-align:center';
    reset.textContent = 'Rétablir les touches par défaut';
    reset.onclick = () => {
      this.uiSound('uiClick');
      s.resetBindings();
      this.show('controls');
    };
    g.appendChild(reset);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Les touches sont physiques : ZQSD (AZERTY) et WASD (QWERTY) fonctionnent automatiquement. Molette : zoom.';
    g.appendChild(hint);
  }
}
