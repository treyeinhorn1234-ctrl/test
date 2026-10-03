import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { CombatSystem } from '../combat/CombatSystem';
import { VFX } from '../combat/VFX';
import { Enemy } from '../enemies/Enemy';
import { Input } from '../engine/Input';
import { FORGOTTEN_CRYPTS_LAYOUT, CRYPT_LORE } from '../maps/forgottenCrypts';
import { Player } from '../player/Player';
import { IsoCamera } from '../rendering/IsoCamera';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { PixelRenderer } from '../rendering/PixelRenderer';
import { HUD } from '../ui/HUD';
import { PanelScreen, TitleScreen } from '../ui/Menus';
import { SettingsMenu } from '../ui/SettingsMenu';
import { EncounterDirector } from '../world/EncounterDirector';
import { Level, type Interactable } from '../world/Level';
import { Pickups } from '../world/Pickups';
import { PAL } from '../assets/palette';
import { EventBus } from './EventBus';
import type { GameContext } from './GameContext';
import type { GameEvents } from './GameEvents';
import { QUALITY_PRESETS, Settings } from './Settings';

type Mode = 'menu' | 'playing' | 'paused' | 'dead';

const FOG_DENSITY = 0.012;
const ALTAR_COOLDOWN = 30;

/**
 * Chef d'orchestre : crée les systèmes, exécute la boucle de jeu (delta time
 * borné, gel d'impact), route les événements et gère les écrans.
 */
export class Game {
  readonly settings = new Settings();
  readonly events = new EventBus<GameEvents>();
  readonly renderer: PixelRenderer;
  readonly scene = new THREE.Scene();
  readonly cameraRig = new IsoCamera();
  readonly input: Input;
  readonly audio: AudioManager;
  readonly level: Level;
  readonly combat = new CombatSystem();
  readonly fx: VFX;
  readonly player = new Player();
  readonly enemies: Enemy[] = [];
  private readonly sparks = new ParticleSystem(3000, true);
  private readonly debris = new ParticleSystem(1500, false);
  private readonly pickups: Pickups;
  private readonly director: EncounterDirector;
  private readonly hud: HUD;
  private readonly settingsMenu: SettingsMenu;
  private readonly title: TitleScreen;
  private readonly pause: PanelScreen;
  private readonly death: PanelScreen;
  private readonly fade: HTMLElement;
  private readonly ctx: GameContext;
  private mode: Mode = 'menu';
  private time = 0;
  private realTime = 0;
  private hitstopTime = 0;
  private last = performance.now();
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private kills = 0;
  private altarCooldown = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aimPoint = new THREE.Vector3();

  constructor(container: HTMLElement) {
    const g = this.settings.data.graphics;
    this.renderer = new PixelRenderer(container, g);
    this.input = new Input(this.settings, this.renderer.domElement);
    this.audio = new AudioManager(this.settings.data.audio);

    this.scene.background = new THREE.Color(0x05040a);
    this.scene.fog = new THREE.FogExp2(0x0c0a10, FOG_DENSITY);
    this.level = new Level(FORGOTTEN_CRYPTS_LAYOUT, QUALITY_PRESETS[g.quality].shadows);
    this.scene.add(this.level.group, this.sparks.points, this.debris.points);
    this.fx = new VFX(this.scene, this.sparks, this.debris);
    this.pickups = new Pickups(this.scene);

    this.scene.add(this.player.actor.root, this.player.light);
    this.combat.add(this.player);

    this.director = new EncounterDirector(
      (e) => this.spawnEnemy(e),
      () => this.enemies.filter((e) => e.alive).length,
    );

    this.ctx = {
      events: this.events,
      level: this.level,
      combat: this.combat,
      fx: this.fx,
      input: this.input,
      cameraRig: this.cameraRig,
      player: this.player,
      aimPoint: this.aimPoint,
      time: 0,
      hitstop: (d) => {
        this.hitstopTime = Math.max(this.hitstopTime, d);
      },
      attackTokens: { used: 0, max: 2 },
    };

    // ---- Interface ----
    const ui = document.createElement('div');
    ui.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    container.appendChild(ui);
    this.hud = new HUD(ui, this.input);
    const sound = (n: string) => this.audio.play(n, { volume: 0.6 });
    this.settingsMenu = new SettingsMenu(ui, this.settings, this.input, () => `${this.renderer.view.x} × ${this.renderer.view.y}`, sound);
    this.title = new TitleScreen(ui, [
      { label: 'Nouvelle partie', action: () => this.newGame() },
      { label: 'Paramètres', action: () => this.openSettings('graphics', this.title) },
      { label: 'Commandes', action: () => this.openSettings('controls', this.title) },
    ], sound);
    this.pause = new PanelScreen(ui, '', 'Pause', [
      { label: 'Reprendre', action: () => this.resume() },
      { label: 'Paramètres', action: () => this.openSettings('graphics', this.pause) },
      { label: 'Commandes', action: () => this.openSettings('controls', this.pause) },
      { label: 'Recommencer', action: () => this.newGame() },
      { label: 'Menu principal', action: () => this.toMenu() },
    ], sound);
    this.death = new PanelScreen(ui, 'blood', 'Retour aux cendres', [
      { label: 'Se relever', action: () => this.newGame() },
      { label: 'Menu principal', action: () => this.toMenu() },
    ], sound, 'death');
    this.fade = document.createElement('div');
    this.fade.className = 'fade';
    ui.appendChild(this.fade);

    this.settings.onChange((d) => this.applySettings(d.graphics.quality));
    this.applySettings(g.quality);
    this.bindEvents();

    // Débloque l'audio au premier geste.
    const unlock = () => {
      this.audio.unlock();
      this.audio.warmup();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.toMenu();
  }

  start(): void {
    const loop = () => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ états

  private resetWorld(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.actor.root);
      this.combat.remove(e);
      e.actor.dispose();
    }
    this.enemies.length = 0;
    this.pickups.clear();
    this.sparks.clear();
    this.debris.clear();
    this.hud.clearWorldUi();
    this.hud.hideMessage();
    this.ctx.attackTokens.used = 0;
    this.timers = [];
    this.kills = 0;
    this.altarCooldown = 0;
    this.director.reset();
    this.player.reset(this.level.playerSpawn);
    this.cameraRig.setTarget(this.player.position, true);
  }

  private toMenu(): void {
    this.mode = 'menu';
    this.resetWorld();
    // Varyn se tient devant son sarcophage brisé.
    this.player.position.copy(this.level.playerSpawn).add(new THREE.Vector3(-1.5, 0, -1.5));
    this.player.facing = Math.PI * 0.75;
    this.hud.setVisible(false);
    this.pause.hide();
    this.death.hide();
    this.settingsMenu.root.classList.remove('show');
    this.title.show();
    this.input.enabled = false;
    this.audio.setMusicIntensity(0);
  }

  private newGame(): void {
    this.title.hide();
    this.pause.hide();
    this.death.hide();
    (document.activeElement as HTMLElement | null)?.blur();
    this.fade.classList.add('on');
    this.input.enabled = false;
    window.setTimeout(() => {
      this.resetWorld();
      this.mode = 'playing';
      this.input.enabled = true;
      this.input.clearAll();
      this.hud.setVisible(true);
      this.fade.classList.remove('on');
      this.hud.showBanner('Les Cryptes Oubliées', "Le Seigneur des Abysses s'éveille");
      this.audio.play('waveStart', { volume: 0.7 });
      this.later(3, () =>
        this.hud.showMessage(
          'Réveil',
          `Mille ans de silence. Tes muscles se souviennent d'Eclipse. ${this.input.actionLabel('moveUp')}${this.input.actionLabel('moveLeft')}${this.input.actionLabel('moveDown')}${this.input.actionLabel('moveRight')} : se déplacer · Clic gauche : combo (en courant : bond) · Clic droit : tour complet (pendant le combo : coup de pied) · ${this.input.actionLabel('block')} : garde, parade juste avant l'impact · ${this.input.actionLabel('dodge')} : roulade (puis clic : uppercut) · ${this.input.actionLabel('spell1')} : Griffe abyssale · ${this.input.actionLabel('interact')} : examiner.`,
          9,
        ),
      );
    }, 450);
  }

  private pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.enabled = false;
    this.pause.show();
    this.audio.setPaused(true);
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.pause.hide();
    (document.activeElement as HTMLElement | null)?.blur();
    this.input.enabled = true;
    this.input.clearAll();
    this.audio.setPaused(false);
  }

  private openSettings(tab: 'graphics' | 'controls', from: TitleScreen | PanelScreen): void {
    from.hide();
    this.settingsMenu.open(tab, () => {
      from.show();
      this.hud.refreshKeys();
    });
  }

  private onPlayerDied(): void {
    this.mode = 'dead';
    this.input.enabled = false;
    this.death.setBody(`
      <p>La couronne attend encore. Les héros ont gagné cette fois… mais le sceau ne tiendra pas éternellement.</p>
      <div class="stats-line">
        <div><b>${this.director.wave}</b>Vague</div>
        <div><b>${this.kills}</b>Gardiens détruits</div>
        <div><b>${this.player.xp.level}</b>Niveau</div>
      </div>`);
    this.death.show();
  }

  private later(seconds: number, fn: () => void): void {
    this.timers.push({ at: this.time + seconds, fn });
  }

  // ------------------------------------------------------------- événements

  private bindEvents(): void {
    const ev = this.events;
    ev.on('sfx', (e) => this.audio.play(e.name, { position: e.position, volume: e.volume }));
    ev.on('hit', (e) => {
      if (e.target === this.player) {
        this.hud.floatText(`${e.amount}`, e.position, 'player');
        this.renderer.triggerFlash(0xff1020, 0.35, 3);
        this.hud.playerHurt();
      } else if (e.blocked) {
        this.hud.floatText(`Paré ${e.amount}`, e.position, 'blocked');
      } else {
        this.hud.floatText(e.crit ? `${e.amount}!` : `${e.amount}`, e.position, e.crit ? 'crit' : '');
        if (e.crit) this.audio.play('slam', { volume: 0.35, pitch: 1.6 });
      }
    });
    ev.on('death', ({ entity }) => {
      if (!(entity instanceof Enemy)) return;
      this.kills++;
      const p = entity.position.clone();
      const levels = this.player.gainXp(entity.xpReward);
      this.hud.floatText(`+${entity.xpReward} XP`, p.clone().setY(2.2), 'xp');
      // Dévoration d'âme (forme mineure) : les âmes rejoignent Varyn et lui rendent de la mana.
      this.fx.soulStream(p, 4, () => this.player.position, () => {
        if (!this.player.alive) return;
        this.player.stats.mana = Math.min(this.player.stats.maxMana, this.player.stats.mana + 5);
        this.fx.aura(this.player.position, PAL.void3, 8, 0.6);
        this.audio.play('soulAbsorb', { volume: 0.5 });
      });
      const lowHp = this.player.stats.hp < this.player.stats.maxHp * 0.5;
      if (Math.random() < (lowHp ? 0.6 : 0.3)) this.pickups.spawnOrb(p);
      if (levels > 0) ev.emit('levelUp', { level: this.player.xp.level });
    });
    ev.on('levelUp', ({ level }) => {
      this.hud.showBanner(`Niveau ${level}`, 'Ta puissance abyssale grandit — PV et mana restaurés');
      this.audio.play('levelUp');
      this.renderer.triggerFlash(PAL.void2, 0.35, 2);
      this.fx.shockwave(this.player.position, PAL.void3, 4, 0.6);
    });
    ev.on('waveStarted', ({ wave }) => {
      this.hud.showBanner(`Vague ${wave}`, wave === 1 ? 'Les gardiens du tombeau se relèvent' : 'Ils sont plus nombreux…');
    });
    ev.on('waveCleared', ({ wave }) => {
      this.hud.showBanner('La crypte se tait', `Vague ${wave} repoussée`);
      this.player.celebrate();
      this.audio.play('soul', { volume: 0.8 });
    });
    ev.on('objective', (o) => this.hud.setObjective(o.title, o.detail));
    ev.on('message', (m) => {
      this.hud.showMessage(m.title, m.text);
      this.audio.play('message', { volume: 0.5 });
    });
    ev.on('banner', (b) => this.hud.showBanner(b.title, b.subtitle));
    ev.on('floatText', (f) => this.hud.floatText(f.text, f.position, f.cls));
    ev.on('pickup', (p) => {
      if (p.amount > 0) this.hud.floatText(`+${p.amount}`, p.position.clone().setY(1.6), 'heal');
    });
    ev.on('playerAttack', ({ heavy }) => {
      for (const e of this.enemies) e.onPlayerAttack(this.ctx, heavy);
    });
    ev.on('interact', ({ kind }) => this.handleInteract(kind));
    ev.on('playerDied', () => this.onPlayerDied());
  }

  private handleInteract(kind: Interactable['kind']): void {
    this.audio.play('interact', { volume: 0.7 });
    if (kind === 'altar') {
      if (this.altarCooldown > 0) {
        this.hud.showMessage('Autel abyssal', `Le cristal est encore épuisé. Il se rechargera dans ${Math.ceil(this.altarCooldown)} secondes.`, 4);
        return;
      }
      this.altarCooldown = ALTAR_COOLDOWN;
      this.player.restoreMana();
      this.fx.aura(this.player.position, PAL.void3, 30, 1);
      this.renderer.triggerFlash(PAL.void1, 0.25, 2);
    }
    const lore = CRYPT_LORE[kind];
    this.hud.showMessage(lore.title, lore.text, 10);
  }

  private spawnEnemy(e: Enemy): void {
    this.enemies.push(e);
    this.combat.add(e);
    this.scene.add(e.actor.root);
  }

  // ------------------------------------------------------------- réglages

  private applySettings(prevQuality: string): void {
    const g = this.settings.data.graphics;
    const preset = QUALITY_PRESETS[g.quality];
    const shadowsBefore = this.renderer.renderer.shadowMap.enabled;
    this.renderer.applySettings(g);
    (this.scene.fog as THREE.FogExp2).density = FOG_DENSITY * g.fog;
    this.level.mist.setDensity(g.fog);
    this.sparks.density = preset.particles;
    this.debris.density = preset.particles;
    this.level.moon.castShadow = preset.shadows > 0;
    if (preset.shadows > 0 && this.level.moon.shadow.mapSize.x !== preset.shadows) {
      this.level.moon.shadow.mapSize.set(preset.shadows, preset.shadows);
      this.level.moon.shadow.map?.dispose();
      this.level.moon.shadow.map = null;
    }
    if (shadowsBefore !== this.renderer.renderer.shadowMap.enabled || prevQuality !== g.quality) {
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) m.needsUpdate = true;
      });
    }
    this.hud?.refreshKeys();
    this.audio?.applySettings(this.settings.data.audio);
  }

  // ------------------------------------------------------------ projection

  /** Projette un point monde en pixels écran (gère la marge et le sous-pixel). */
  worldToScreen(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().project(this.cameraRig.camera);
    const view = this.renderer.view;
    const off = this.renderer.subpixel;
    const tx = ((v.x + 1) / 2) * (view.x + 2);
    const ty = ((v.y + 1) / 2) * (view.y + 2);
    const ux = (tx - 1 - off.x) / view.x;
    const uy = (ty - 1 - off.y) / view.y;
    return { x: ux * window.innerWidth, y: (1 - uy) * window.innerHeight, visible: v.z < 1 && ux > -0.1 && ux < 1.1 && uy > -0.1 && uy < 1.1 };
  }

  private updateAim(): void {
    const view = this.renderer.view;
    const off = this.renderer.subpixel;
    const m = this.input.mouseNdc;
    const tx = ((m.x + 1) / 2) * view.x + 1 + off.x;
    const ty = ((m.y + 1) / 2) * view.y + 1 + off.y;
    const ndc = new THREE.Vector2((tx / (view.x + 2)) * 2 - 1, (ty / (view.y + 2)) * 2 - 1);
    this.raycaster.setFromCamera(ndc, this.cameraRig.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    if (hit) this.aimPoint.copy(hit);
  }

  private findInteractable(): Interactable | null {
    if (!this.player.alive) return null;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.level.interactables) {
      const d = Math.hypot(it.position.x - this.player.position.x, it.position.z - this.player.position.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ boucle

  private frame(): void {
    const now = performance.now();
    const realDt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.realTime += realDt;

    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    if (this.input.wasPressed('pause')) {
      if (this.settingsMenu.isOpen) this.settingsMenu.close();
      else if (this.mode === 'playing') this.pauseGame();
      else if (this.mode === 'paused') this.resume();
    }

    // Gel d'impact : le monde s'arrête, le rendu continue.
    let dt = realDt;
    let frozen = false;
    if (this.hitstopTime > 0) {
      this.hitstopTime -= realDt;
      dt = 0;
      frozen = this.mode === 'playing';
    }
    const simulate = this.mode === 'playing' || this.mode === 'dead' || this.mode === 'menu';
    if (!simulate) dt = 0;

    if (this.mode === 'menu') this.updateMenu(dt);
    else if (dt > 0) this.updateGame(dt);

    // Le décor reste vivant même en pause (flammes, brume).
    this.level.update(realDt, this.realTime, this.sparks, this.debris, this.player.position);
    this.sparks.update(this.mode === 'paused' ? 0 : realDt);
    this.debris.update(this.mode === 'paused' ? 0 : realDt);
    this.fx.update(this.mode === 'paused' ? 0 : realDt);

    this.cameraRig.addZoomInput(this.mode === 'playing' ? this.input.consumeWheel() : (this.input.consumeWheel(), 0));
    this.cameraRig.update(realDt, this.renderer.targetSize, this.renderer.subpixel);
    this.level.updateOcclusion(this.cameraRig.camera, this.player.position, realDt);
    this.audio.setListener(this.player.position, this.cameraRig.groundRight);

    if (this.mode !== 'menu') {
      this.hud.update(realDt, this.player, this.enemies, (p) => this.worldToScreen(p), this.settings.data.graphics.showFps ? this.fps : null);
    }
    this.renderer.render(this.scene, this.cameraRig.camera, realDt, this.realTime);
    this.input.endFrame(frozen);
  }

  private updateMenu(dt: number): void {
    this.time += dt;
    this.ctx.time = this.time;
    // Caméra contemplative qui dérive lentement autour du tombeau.
    const t = this.realTime * 0.15;
    const focus = this.player.position.clone().add(new THREE.Vector3(Math.sin(t) * 2.5 - 3, 0, Math.cos(t * 0.7) * 1.5));
    this.cameraRig.setTarget(focus);
    this.cameraRig.followRate = 1.5;
    this.player.actor.anim.play('idle');
    this.player.syncVisual(dt, this.ctx);
    this.player.light.position.copy(this.player.position).add(new THREE.Vector3(1, 2.4, 1));
    if (Math.random() < dt * 8) this.fx.aura(this.player.position, PAL.void2, 1, 0.5);
  }

  private updateGame(dt: number): void {
    this.time += dt;
    this.ctx.time = this.time;
    this.cameraRig.followRate = 7;
    this.altarCooldown = Math.max(0, this.altarCooldown - dt);

    for (const t of this.timers.filter((t) => t.at <= this.time)) t.fn();
    this.timers = this.timers.filter((t) => t.at > this.time);

    if (this.mode === 'playing') {
      this.updateAim();
      if (this.input.wasPressed('inventory')) this.events.emit('message', { title: 'Inventaire', text: "L'inventaire, l'équipement et les raretés (Commun → Abyssal) arrivent à l'Étape 5 du développement." });
      if (this.input.wasPressed('journal')) this.events.emit('message', { title: 'Journal de quêtes', text: "Objectif actuel : survivre au réveil des gardiens. Le journal complet (quêtes principales et secondaires) arrive à l'Étape 5." });
      if (this.input.wasPressed('map')) this.events.emit('message', { title: 'Carte', text: "Tu te trouves dans la Salle funéraire des Cryptes Oubliées. La carte du monde d'Eldoria arrive avec l'exploration (Étape 4)." });
    }

    this.player.interactTarget = this.mode === 'playing' ? this.findInteractable() : null;
    this.player.update(dt, this.ctx);
    for (const e of this.enemies) e.update(dt, this.ctx);
    this.combat.update(dt, this.ctx);
    this.pickups.update(dt, this.ctx);
    this.director.update(dt, this.ctx);

    for (const e of this.enemies.filter((e) => e.removed)) {
      this.scene.remove(e.actor.root);
      this.combat.remove(e);
      e.actor.dispose();
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].removed) this.enemies.splice(i, 1);

    const prompt = this.player.interactTarget && this.player.state !== 'interact' ? this.player.interactTarget.prompt : null;
    this.hud.setPrompt(this.mode === 'playing' ? prompt : null);

    // Caméra : légère anticipation vers la visée, cadrage élargi en combat.
    const aimLead = new THREE.Vector3().subVectors(this.aimPoint, this.player.position).setY(0);
    if (aimLead.length() > 4) aimLead.setLength(4);
    this.cameraRig.setTarget(this.player.position.clone().addScaledVector(aimLead, 0.18));
    const engaged = this.enemies.filter((e) => e.alive && e.position.distanceTo(this.player.position) < 12).length;
    this.cameraRig.setFraming(engaged >= 3 ? 0.9 : 1);
    this.audio.setMusicIntensity(Math.min(1, engaged / 2));
  }
}
