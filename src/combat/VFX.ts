import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { PixelCanvas } from '../assets/pixel/PixelCanvas';
import type { ParticleSystem } from '../rendering/ParticleSystem';
import type { SpriteActor } from '../entities/SpriteActor';
import { randRange } from '../utils/math';
import { crackTexture, createArcMaterial, impactTexture } from './VFXShapes';

const R = Math.random;

interface Ghost {
  mesh: THREE.Mesh;
  tex: THREE.Texture;
  life: number;
  max: number;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  radius: number;
}

interface Decal {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

interface Arc {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  life: number;
  max: number;
}

interface Burst {
  sprite: THREE.Sprite;
  tex: THREE.Texture;
  life: number;
  max: number;
}

/** Cible suivie par une zone d'attaque télégraphiée. */
export interface TelegraphOwner {
  position: THREE.Vector3;
  facing: number;
  alive: boolean;
}

interface Telegraph {
  arc: Arc;
  owner: TelegraphOwner | null;
  half: number;
}

interface Soul {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  target: () => THREE.Vector3;
  onArrive: () => void;
  color: number;
}

/**
 * Effets visuels de combat, tous en pool : étincelles d'impact, éclats d'os,
 * ondes de choc, images rémanentes de l'esquive, griffures abyssales,
 * âmes libérées par les ennemis vaincus.
 */
export class VFX {
  private ghosts: Ghost[] = [];
  private rings: Ring[] = [];
  private decals: Decal[] = [];
  private arcs: Arc[] = [];
  private bursts: Burst[] = [];
  private cracks: Decal[] = [];
  private telegraphs: Telegraph[] = [];
  private soulList: Soul[] = [];
  private arcIndex = 0;
  private burstIndex = 0;
  private crackIndex = 0;
  private ghostIndex = 0;
  private ringIndex = 0;
  private decalIndex = 0;

  constructor(
    private readonly scene: THREE.Scene,
    readonly sparks: ParticleSystem,
    readonly debris: ParticleSystem,
  ) {
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 8;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, radius: 1 });
    }
    const clawTex = VFX.clawTexture();
    const decalGeo = new THREE.PlaneGeometry(3, 3);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        decalGeo,
        new THREE.MeshBasicMaterial({ map: clawTex, color: new THREE.Color(PAL.void2).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 7;
      scene.add(mesh);
      this.decals.push({ mesh, life: 0, max: 1 });
    }
    const ringGeo2 = new THREE.RingGeometry(0.2, 1, 56, 1);
    const makeArc = (): Arc => {
      const mat = createArcMaterial();
      const mesh = new THREE.Mesh(ringGeo2, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 9;
      scene.add(mesh);
      return { mesh, mat, life: 0, max: 1 };
    };
    for (let i = 0; i < 10; i++) this.arcs.push(makeArc());
    for (let i = 0; i < 8; i++) this.telegraphs.push({ arc: makeArc(), owner: null, half: 0 });
    const burstBase = impactTexture();
    for (let i = 0; i < 12; i++) {
      const tex = burstBase.clone();
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.visible = false;
      sprite.renderOrder = 11;
      scene.add(sprite);
      this.bursts.push({ sprite, tex, life: 0, max: 1 });
    }
    const crackGeo = new THREE.PlaneGeometry(4, 4);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ map: crackTexture(11 + i * 7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 7;
      scene.add(mesh);
      this.cracks.push({ mesh, life: 0, max: 1 });
    }
  }

  /**
   * Arc de taille au sol autour d'un point. `start` et `sweep` sont des angles
   * monde (atan2(z, x)) ; le croissant grandit dans le sens du balayage.
   */
  slashArc(pos: THREE.Vector3, start: number, sweep: number, radius: number, color: number, edge: number, duration = 0.24, height = 1.1): void {
    const a = this.arcs[this.arcIndex++ % this.arcs.length];
    a.mesh.position.set(pos.x, height, pos.z);
    a.mesh.scale.setScalar(radius);
    const u = a.mat.uniforms;
    // Le plan est couché : l'angle local est l'opposé de l'angle monde.
    u.uStart.value = -start;
    u.uSweep.value = -sweep;
    u.uScale.value = radius;
    u.uFill.value = 0;
    u.uInner.value = 0.45;
    u.uColor.value.set(color);
    u.uEdge.value.set(edge);
    u.uProgress.value = 0;
    u.uFade.value = 1;
    a.life = a.max = duration;
    a.mesh.visible = true;
  }

  /** Zone d'attaque ennemie au sol, qui se remplit jusqu'au coup. */
  telegraph(owner: TelegraphOwner, half: number, range: number, duration: number, color: number): void {
    const t = this.telegraphs.find((x) => x.arc.life <= 0) ?? this.telegraphs[0];
    t.owner = owner;
    t.half = half;
    const u = t.arc.mat.uniforms;
    u.uFill.value = 1;
    u.uInner.value = 0.15;
    u.uScale.value = range;
    u.uColor.value.set(color);
    u.uEdge.value.set(color).multiplyScalar(1.6);
    u.uProgress.value = 1;
    u.uFade.value = 0;
    t.arc.mesh.scale.setScalar(range);
    t.arc.life = t.arc.max = duration;
    t.arc.mesh.visible = true;
  }

  cancelTelegraph(owner: TelegraphOwner): void {
    for (const t of this.telegraphs) {
      if (t.owner !== owner) continue;
      t.arc.life = 0;
      t.arc.mesh.visible = false;
      t.owner = null;
    }
  }

  /** Éclat lumineux à l'impact. */
  burst(pos: THREE.Vector3, color: number, size = 2.4): void {
    const b = this.bursts[this.burstIndex++ % this.bursts.length];
    b.sprite.position.copy(pos);
    b.sprite.scale.setScalar(size);
    (b.sprite.material as THREE.SpriteMaterial).color.set(color).multiplyScalar(2.2);
    (b.sprite.material as THREE.SpriteMaterial).rotation = Math.floor(Math.random() * 4) * (Math.PI / 4);
    b.life = b.max = 0.2;
    b.sprite.visible = true;
  }

  /** Fissure lumineuse au sol. */
  crack(pos: THREE.Vector3, color: number, scale = 1): void {
    const d = this.cracks[this.crackIndex++ % this.cracks.length];
    d.mesh.position.set(pos.x, 0.05, pos.z);
    d.mesh.scale.setScalar(scale);
    d.mesh.rotation.z = Math.random() * Math.PI * 2;
    (d.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2);
    d.life = d.max = 1.6;
    d.mesh.visible = true;
  }

  /** Braises qui suivent le tranchant pendant un coup. */
  swordTrail(center: THREE.Vector3, angle: number, range: number, color: number, count = 10): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 1.6;
      const r = range * randRange(R, 0.45, 1);
      this.sparks.emit({
        x: center.x + Math.cos(a) * r, y: randRange(R, 0.6, 1.8), z: center.z + Math.sin(a) * r,
        vx: -Math.sin(a) * 3 + Math.cos(a) * 1.5, vy: randRange(R, 0.5, 2.5), vz: Math.cos(a) * 3 + Math.sin(a) * 1.5,
        life: randRange(R, 0.25, 0.6), color, colorEnd: PAL.void0, intensity: 3, size: i % 4 === 0 ? 2 : 1, drag: 4,
      });
    }
  }

  /** Particules qui convergent vers un point (charge d'énergie). */
  converge(pos: THREE.Vector3, color: number, count = 3, radius = 2.4): void {
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2;
      const life = randRange(R, 0.25, 0.4);
      const sx = Math.cos(a) * radius;
      const sz = Math.sin(a) * radius;
      const sy = randRange(R, 0.3, 2.6);
      this.sparks.emit({
        x: pos.x + sx, y: sy, z: pos.z + sz,
        vx: -sx / life, vy: (1.2 - sy) / life, vz: -sz / life,
        life, color, colorEnd: PAL.void3, intensity: 3, size: 1,
      });
    }
  }

  /** Âmes libérées qui volent vers une cible (Dévoration d'âme). */
  soulStream(from: THREE.Vector3, count: number, target: () => THREE.Vector3, onArrive: () => void, color: number = PAL.void2): void {
    for (let i = 0; i < count; i++) {
      this.soulList.push({
        pos: from.clone().setY(1.2 + Math.random()),
        vel: new THREE.Vector3(randRange(R, -4, 4), randRange(R, 2, 5), randRange(R, -4, 4)),
        age: 0,
        target,
        onArrive: i === 0 ? onArrive : () => {},
        color,
      });
    }
  }

  private static clawTexture(): THREE.Texture {
    const c = new PixelCanvas(48, 48);
    for (let k = -1; k <= 1; k++) {
      for (let t = 0; t <= 1; t += 0.01) {
        const x = 6 + t * 36;
        const y = 24 + k * 9 + Math.sin(t * Math.PI) * -6;
        const w = Math.sin(t * Math.PI) * 2.5;
        for (let j = -w; j <= w; j++) c.px(x, y + j, j === 0 ? 0xffffff : 0xa0a0a0);
      }
    }
    return c.toTexture();
  }

  /** Étincelles et éclats à l'impact d'un coup. */
  impact(pos: THREE.Vector3, dir: THREE.Vector3, by: 'player' | 'enemy', crit: boolean, blocked: boolean): void {
    if (blocked) {
      this.burst(pos, PAL.fire2, 1.8);
      for (let i = 0; i < 14; i++) {
        this.sparks.emit({
          x: pos.x, y: pos.y, z: pos.z,
          vx: -dir.x * randRange(R, 2, 6) + randRange(R, -3, 3), vy: randRange(R, 1, 5), vz: -dir.z * randRange(R, 2, 6) + randRange(R, -3, 3),
          life: randRange(R, 0.15, 0.4), color: PAL.fire3, colorEnd: PAL.fire1, intensity: 3, size: 1, gravity: 14, drag: 2,
        });
      }
      return;
    }
    const main = by === 'player' ? PAL.void3 : PAL.ember1;
    const end = by === 'player' ? PAL.void0 : PAL.ember0;
    const n = crit ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const s = randRange(R, 3, crit ? 11 : 8);
      this.sparks.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: dir.x * s + randRange(R, -2.5, 2.5), vy: randRange(R, 0.5, 4), vz: dir.z * s + randRange(R, -2.5, 2.5),
        life: randRange(R, 0.15, 0.35), color: crit && i % 3 === 0 ? PAL.gold2 : main, colorEnd: end, intensity: 3.5, size: i < (crit ? 6 : 3) ? 2 : 1, drag: 6,
      });
    }
    this.burst(pos.clone().addScaledVector(dir, -0.2), crit ? PAL.gold2 : main, crit ? 3.4 : 2.4);
    if (by === 'player') {
      // Éclats d'os.
      for (let i = 0; i < (crit ? 10 : 5); i++) {
        this.debris.emit({
          x: pos.x, y: pos.y, z: pos.z,
          vx: dir.x * randRange(R, 2, 5) + randRange(R, -1.5, 1.5), vy: randRange(R, 2, 5), vz: dir.z * randRange(R, 2, 5) + randRange(R, -1.5, 1.5),
          life: randRange(R, 0.5, 0.9), color: PAL.bone2, colorEnd: PAL.bone0, size: 1, gravity: 16, drag: 1,
        });
      }
    }
  }

  /** Onde de choc au sol. */
  shockwave(pos: THREE.Vector3, color: number, radius: number, duration = 0.35): void {
    const r = this.rings[this.ringIndex++ % this.rings.length];
    r.mesh.position.set(pos.x, 0.08, pos.z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2.5);
    r.life = duration;
    r.max = duration;
    r.radius = radius;
    r.mesh.visible = true;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.sparks.emit({
        x: pos.x + Math.cos(a) * 0.4, y: 0.15, z: pos.z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * radius * 3, vy: randRange(R, 0.2, 1.2), vz: Math.sin(a) * radius * 3,
        life: duration * 1.2, color, colorEnd: PAL.void0, intensity: 2.5, size: 1, drag: 5,
      });
    }
  }

  /** Nuage de poussière (esquive, chute). */
  dust(pos: THREE.Vector3, count = 8, spread = 1): void {
    for (let i = 0; i < count; i++) {
      this.debris.emit({
        x: pos.x + randRange(R, -0.3, 0.3) * spread, y: 0.15, z: pos.z + randRange(R, -0.3, 0.3) * spread,
        vx: randRange(R, -1.5, 1.5) * spread, vy: randRange(R, 0.3, 1.2), vz: randRange(R, -1.5, 1.5) * spread,
        life: randRange(R, 0.4, 0.8), color: 0x5e5868, colorEnd: 0x2a2630, size: 2, sizeEnd: 1, drag: 3, alpha: 0.8,
      });
    }
  }

  /** Image rémanente violette (esquive dans l'ombre). */
  afterimage(actor: SpriteActor): void {
    let g = this.ghosts[this.ghostIndex % 6];
    if (!g) {
      const tex = actor.sheet.color.clone();
      const mesh = new THREE.Mesh(
        actor.mesh.geometry,
        new THREE.MeshBasicMaterial({
          map: tex, color: new THREE.Color(PAL.void1).multiplyScalar(1.4), transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, alphaTest: 0.3, side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.copy(actor.mesh.rotation);
      this.scene.add(mesh);
      g = { mesh, tex, life: 0, max: 0.3 };
      this.ghosts.push(g);
    }
    this.ghostIndex++;
    actor.copyFrameTo(g.tex);
    g.mesh.position.copy(actor.root.position);
    g.mesh.position.y += actor.mesh.position.y;
    g.life = g.max;
    g.mesh.visible = true;
  }

  /** Griffures abyssales au sol (sort Griffe abyssale). */
  clawMarks(pos: THREE.Vector3, angle: number): void {
    const d = this.decals[this.decalIndex++ % this.decals.length];
    d.mesh.position.set(pos.x, 0.06, pos.z);
    d.mesh.rotation.set(-Math.PI / 2, 0, -angle);
    d.life = d.max = 0.5;
    d.mesh.visible = true;
  }

  /** Âme libérée par un ennemi vaincu. */
  souls(pos: THREE.Vector3, color: number = PAL.soulBlue): void {
    for (let i = 0; i < 18; i++) {
      this.sparks.emit({
        x: pos.x + randRange(R, -0.4, 0.4), y: randRange(R, 0.2, 1.4), z: pos.z + randRange(R, -0.4, 0.4),
        vx: randRange(R, -0.4, 0.4), vy: randRange(R, 1, 3), vz: randRange(R, -0.4, 0.4),
        life: randRange(R, 0.6, 1.4), color, colorEnd: PAL.void0, intensity: 2.5, size: i < 3 ? 2 : 1, drag: 1.5,
      });
    }
  }

  /** Volutes d'énergie autour d'un point (aura, charge). */
  aura(pos: THREE.Vector3, color: number, count = 1, radius = 0.6): void {
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2;
      this.sparks.emit({
        x: pos.x + Math.cos(a) * radius, y: randRange(R, 0.2, 2.2), z: pos.z + Math.sin(a) * radius,
        vx: -Math.cos(a) * 0.3, vy: randRange(R, 0.4, 1.2), vz: -Math.sin(a) * 0.3,
        life: randRange(R, 0.5, 1.1), color, colorEnd: PAL.void0, intensity: 2, size: 1, drag: 1,
      });
    }
  }

  update(dt: number): void {
    for (const a of this.arcs) {
      if (a.life <= 0) continue;
      a.life -= dt;
      const t = 1 - a.life / a.max;
      a.mat.uniforms.uProgress.value = Math.min(1, t * 3.2);
      a.mat.uniforms.uFade.value = t < 0.35 ? 1 : Math.max(0, 1 - (t - 0.35) / 0.65);
      if (a.life <= 0) a.mesh.visible = false;
    }
    for (const tg of this.telegraphs) {
      const a = tg.arc;
      if (a.life <= 0) continue;
      a.life -= dt;
      if (tg.owner && !tg.owner.alive) a.life = 0;
      if (tg.owner) {
        a.mesh.position.set(tg.owner.position.x, 0.07, tg.owner.position.z);
        a.mat.uniforms.uStart.value = -(tg.owner.facing - tg.half);
        a.mat.uniforms.uSweep.value = -tg.half * 2;
      }
      a.mat.uniforms.uFade.value = 1 - a.life / a.max;
      if (a.life <= 0) {
        a.mesh.visible = false;
        tg.owner = null;
      }
    }
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const f = Math.min(3, Math.floor((1 - b.life / b.max) * 4));
      b.tex.offset.x = f / 4;
      if (b.life <= 0) b.sprite.visible = false;
    }
    for (const d of this.cracks) {
      if (d.life <= 0) continue;
      d.life -= dt;
      const t = d.life / d.max;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = t > 0.7 ? 1 : t / 0.7;
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const s of this.soulList) {
      s.age += dt;
      const to = s.target().clone().setY(1.4).sub(s.pos);
      const d = to.length();
      if (s.age > 0.25) s.vel.addScaledVector(to.normalize(), 60 * dt);
      s.vel.multiplyScalar(Math.exp(-2.5 * dt));
      s.pos.addScaledVector(s.vel, dt);
      this.sparks.emit({ x: s.pos.x, y: s.pos.y, z: s.pos.z, life: 0.3, color: s.color, colorEnd: PAL.void0, intensity: 3, size: 1 });
      if ((d < 0.6 && s.age > 0.25) || s.age > 3) {
        s.age = 99;
        s.onArrive();
      }
    }
    this.soulList = this.soulList.filter((s) => s.age < 99);
    for (const g of this.ghosts) {
      if (g.life <= 0) continue;
      g.life -= dt;
      (g.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, g.life / g.max) * 0.6;
      if (g.life <= 0) g.mesh.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - r.life / r.max;
      const s = 0.3 + r.radius * (1 - Math.pow(1 - t, 3));
      r.mesh.scale.set(s, s, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (d.life / d.max) * 2);
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}
