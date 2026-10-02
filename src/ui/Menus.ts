/**
 * Écrans de menu : titre, pause, mort. Chaque bouton déclenche une action
 * réelle fournie par le jeu.
 */
export interface MenuItem {
  label: string;
  action: () => void;
}

function button(item: MenuItem, uiSound: (n: string) => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = item.label;
  b.onmouseenter = () => uiSound('uiHover');
  b.onclick = () => {
    uiSound('uiClick');
    item.action();
  };
  return b;
}

export class Screen {
  readonly root: HTMLElement;
  constructor(parent: HTMLElement, cls: string) {
    this.root = document.createElement('div');
    this.root.className = `screen ${cls}`;
    parent.appendChild(this.root);
  }
  show(): void {
    this.root.classList.add('show');
  }
  hide(): void {
    this.root.classList.remove('show');
  }
  get visible(): boolean {
    return this.root.classList.contains('show');
  }
}

export class TitleScreen extends Screen {
  constructor(parent: HTMLElement, items: MenuItem[], uiSound: (n: string) => void) {
    super(parent, 'title-screen');
    this.root.innerHTML = `
      <div class="logo">Ashen<br/><span class="crown">Crown</span></div>
      <div class="tagline">Mille ans sous la pierre. Les héros t'ont enchaîné, les rois t'ont effacé.<br/>Le sceau se brise, Varyn. Reprends ta couronne.</div>`;
    const menu = document.createElement('div');
    menu.className = 'menu';
    for (const it of items) menu.appendChild(button(it, uiSound));
    this.root.appendChild(menu);
    const v = document.createElement('div');
    v.className = 'version';
    v.textContent = 'Prototype 0.1 — Étape 1 : Les Cryptes Oubliées';
    this.root.appendChild(v);
  }
}

export class PanelScreen extends Screen {
  private body: HTMLElement;
  constructor(parent: HTMLElement, frameCls: string, title: string, items: MenuItem[], uiSound: (n: string) => void, extraCls = '') {
    super(parent, `dim ${extraCls}`);
    const panel = document.createElement('div');
    panel.className = `panel frame ${frameCls}`;
    const h2 = document.createElement('h2');
    h2.textContent = title;
    this.body = document.createElement('div');
    const menu = document.createElement('div');
    menu.className = 'menu';
    for (const it of items) menu.appendChild(button(it, uiSound));
    panel.append(h2, this.body, menu);
    this.root.appendChild(panel);
  }
  setBody(html: string): void {
    this.body.innerHTML = html;
  }
}
