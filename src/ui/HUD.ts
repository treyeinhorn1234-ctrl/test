import * as THREE from 'three';
import type { Input } from '../engine/Input';
import type { Enemy } from '../enemies/Enemy';
import type { Player } from '../player/Player';
import { ABYSSAL_CLAW, CLAW_COOLDOWN } from '../player/PlayerAttacks';
import { icon, portrait } from './pixelArt';
import type { Action } from '../core/Settings';

interface Floater {
  el: HTMLElement;
  world: THREE.Vector3;
  age: number;
  life: number;
  rise: number;
  drift: number;
}

interface SlotRef {
  root: HTMLElement;
  key: HTMLElement;
  cd?: HTMLElement;
  cdText?: HTMLElement;
  action: Action;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  parent?.appendChild(el);
  return el;
};

/**
 * Interface en jeu : portrait et barres (haut gauche), objectif (haut droite),
 * raccourcis de capacités avec temps de recharge (bas), invite d'interaction,
 * nombres de dégâts, barres de vie ennemies, bannières et messages d'ambiance.
 */
export class HUD {
  readonly root: HTMLElement;
  private hpFill: HTMLElement;
  private hpChip: HTMLElement;
  private hpLabel: HTMLElement;
  private hpBar: HTMLElement;
  private manaFill: HTMLElement;
  private manaLabel: HTMLElement;
  private stamFill: HTMLElement;
  private xpFill: HTMLElement;
  private lvl: HTMLElement;
  private portraitWrap: HTMLElement;
  private objTitle: HTMLElement;
  private objDetail: HTMLElement;
  private prompt: HTMLElement;
  private floaters: HTMLElement;
  private banner: HTMLElement;
  private msg: HTMLElement;
  private msgTitle: HTMLElement;
  private msgText: HTMLElement;
  private msgTimer = 0;
  private fps: HTMLElement;
  private slots: SlotRef[] = [];
  private clawSlot!: SlotRef;
  private live: Floater[] = [];
  private ebars = new Map<Enemy, HTMLElement>();
  private clawWasReady = true;
  private hurtTimer = 0;

  constructor(
    parent: HTMLElement,
    private readonly input: Input,
  ) {
    this.root = h('div', '', parent);
    this.root.id = 'hud';

    const tl = h('div', 'hud-tl', this.root);
    this.portraitWrap = h('div', 'portrait-wrap frame', tl);
    const img = h('img', '', this.portraitWrap);
    img.src = portrait();
    img.alt = 'Varyn';
    this.lvl = h('div', 'lvl', this.portraitWrap);
    const bars = h('div', 'bars', tl);
    const mk = (cls: string, withChip: boolean, withLabel: boolean) => {
      const bar = h('div', `bar ${cls}`, bars);
      const chip = withChip ? h('div', 'chip', bar) : null;
      const fill = h('div', 'fill', bar);
      const label = withLabel ? h('div', 'label', bar) : null;
      return { bar, chip, fill, label };
    };
    const hp = mk('hp', true, true);
    this.hpBar = hp.bar;
    this.hpFill = hp.fill;
    this.hpChip = hp.chip!;
    this.hpLabel = hp.label!;
    const mana = mk('mana small', false, true);
    this.manaFill = mana.fill;
    this.manaLabel = mana.label!;
    this.stamFill = mk('stamina small', false, false).fill;
    this.xpFill = mk('xp', false, false).fill;

    const tr = h('div', 'hud-tr frame', this.root);
    this.objTitle = h('div', 'title', tr);
    this.objDetail = h('div', 'detail', tr);

    const bottom = h('div', 'hud-bottom', this.root);
    const addSlot = (iconName: Parameters<typeof icon>[0], action: Action, title: string, opts: { cd?: boolean; locked?: boolean } = {}) => {
      const root = h('div', `slot slot-frame${opts.locked ? ' locked' : ''}`, bottom);
      root.title = title;
      const im = h('img', '', root);
      im.src = icon(opts.locked ? 'lock' : iconName);
      if (opts.locked) {
        const inner = h('img', '', root);
        inner.src = icon(iconName);
        inner.style.cssText = 'position:absolute;inset:25%;width:50%;height:50%;opacity:.5';
      }
      const ref: SlotRef = { root, key: h('div', 'key', root), action };
      if (opts.cd) {
        ref.cd = h('div', 'cd', root);
        ref.cdText = h('div', 'cdtext', root);
      }
      this.slots.push(ref);
      return ref;
    };
    addSlot('light', 'lightAttack', 'Attaque légère — combo de 3 coups');
    addSlot('heavy', 'heavyAttack', 'Attaque lourde — brise la garde, onde de choc');
    addSlot('dodge', 'dodge', "Roulade — invulnérable · en courant : pas de l'ombre");
    this.clawSlot = addSlot('claw', 'spell1', 'Griffe abyssale — sort de mêlée (18 mana)', { cd: true });
    addSlot('chains', 'spell2', "Chaînes de l'Abîme — verrouillé (Étape 3)", { locked: true });
    addSlot('storm', 'special', 'Tempête du Néant — verrouillé (Étape 3)', { locked: true });

    this.prompt = h('div', 'prompt frame', this.root);
    this.floaters = h('div', 'floaters', this.root);
    this.banner = h('div', 'banner', this.root);
    this.msg = h('div', 'msgbox frame void', this.root);
    this.msgTitle = h('div', 't', this.msg);
    this.msgText = h('div', 'x', this.msg);
    this.fps = h('div', 'fps', this.root);
    this.refreshKeys();
  }

  /** Met à jour les libellés de touches (après reconfiguration). */
  refreshKeys(): void {
    for (const s of this.slots) s.key.textContent = this.input.actionLabel(s.action);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  setObjective(title: string, detail: string): void {
    this.objTitle.textContent = title;
    this.objDetail.textContent = detail;
  }

  showBanner(title: string, subtitle = ''): void {
    this.banner.innerHTML = '';
    const t = h('div', 't', this.banner);
    t.textContent = title;
    if (subtitle) h('div', 's', this.banner).textContent = subtitle;
    this.banner.classList.remove('anim');
    void this.banner.offsetWidth;
    this.banner.classList.add('anim');
  }

  showMessage(title: string, text: string, seconds = 7): void {
    this.msgTitle.textContent = title;
    this.msgText.textContent = text;
    this.msg.classList.remove('show');
    void this.msg.offsetWidth;
    this.msg.classList.add('show');
    this.msgTimer = seconds;
  }

  hideMessage(): void {
    this.msg.classList.remove('show');
    this.msgTimer = 0;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.remove('show');
      return;
    }
    const html = `<b>[${this.input.actionLabel('interact')}]</b> ${text}`;
    if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
    this.prompt.classList.add('show');
  }

  playerHurt(): void {
    this.hurtTimer = 0.25;
  }

  /** Ajoute un texte flottant ancré dans le monde (dégâts, soin, XP). */
  floatText(text: string, world: THREE.Vector3, cls: string): void {
    const el = h('div', `dmg ${cls}`, this.floaters);
    el.textContent = text;
    this.live.push({ el, world: world.clone(), age: 0, life: cls.includes('crit') ? 1.1 : 0.85, rise: cls.includes('xp') ? 50 : 34, drift: (Math.random() - 0.5) * 30 });
    if (this.live.length > 50) {
      const old = this.live.shift()!;
      old.el.remove();
    }
  }

  clearWorldUi(): void {
    for (const f of this.live) f.el.remove();
    this.live = [];
    for (const el of this.ebars.values()) el.remove();
    this.ebars.clear();
  }

  update(dt: number, player: Player, enemies: Enemy[], project: (p: THREE.Vector3) => { x: number; y: number; visible: boolean }, fps: number | null): void {
    const s = player.stats;
    const hpPct = (s.hp / s.maxHp) * 100;
    this.hpFill.style.width = `${hpPct}%`;
    this.hpChip.style.width = `${hpPct}%`;
    this.hpLabel.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    this.hpBar.classList.toggle('low', hpPct < 25 && s.hp > 0);
    this.manaFill.style.width = `${(s.mana / s.maxMana) * 100}%`;
    this.manaLabel.textContent = `${Math.floor(s.mana)}`;
    this.stamFill.style.width = `${(s.stamina / s.maxStamina) * 100}%`;
    this.xpFill.style.width = `${player.xp.progress * 100}%`;
    this.lvl.textContent = `${player.xp.level}`;

    this.hurtTimer -= dt;
    this.portraitWrap.classList.toggle('hurt', this.hurtTimer > 0);

    // Griffe abyssale : recharge + mana.
    const cd = player.clawCooldown;
    const slot = this.clawSlot;
    slot.cd!.style.transform = `scaleY(${cd / CLAW_COOLDOWN})`;
    slot.cdText!.textContent = cd > 0 ? cd.toFixed(1) : '';
    slot.root.classList.toggle('unavailable', s.mana < (ABYSSAL_CLAW.mana ?? 0));
    const ready = cd <= 0;
    if (ready && !this.clawWasReady) {
      slot.root.classList.remove('ready-flash');
      void slot.root.offsetWidth;
      slot.root.classList.add('ready-flash');
    }
    this.clawWasReady = ready;

    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.msg.classList.remove('show');
    }

    // Textes flottants.
    for (const f of this.live) {
      f.age += dt;
      const t = f.age / f.life;
      const p = project(f.world);
      const ease = 1 - Math.pow(1 - Math.min(1, t * 2), 3);
      f.el.style.left = `${p.x + f.drift * ease}px`;
      f.el.style.top = `${p.y - f.rise * ease}px`;
      f.el.style.opacity = `${t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3}`;
      f.el.style.display = p.visible ? '' : 'none';
    }
    const dead = this.live.filter((f) => f.age >= f.life);
    for (const f of dead) f.el.remove();
    this.live = this.live.filter((f) => f.age < f.life);

    // Barres de vie ennemies (affichées après un coup).
    const seen = new Set<Enemy>();
    for (const e of enemies) {
      if (!e.alive || e.sinceHit > 5 || e.stats.hp >= e.stats.maxHp) continue;
      seen.add(e);
      let el = this.ebars.get(e);
      if (!el) {
        el = h('div', 'ebar', this.floaters);
        h('div', '', el);
        this.ebars.set(e, el);
      }
      const p = project(e.position.clone().setY(e.barHeight));
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.display = p.visible ? '' : 'none';
      (el.firstElementChild as HTMLElement).style.width = `${(e.stats.hp / e.stats.maxHp) * 100}%`;
    }
    for (const [e, el] of this.ebars) {
      if (!seen.has(e)) {
        el.remove();
        this.ebars.delete(e);
      }
    }

    this.fps.style.display = fps === null ? 'none' : '';
    if (fps !== null) this.fps.textContent = `${fps} IPS`;
  }
}
