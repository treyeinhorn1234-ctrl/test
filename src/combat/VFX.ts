import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { PixelCanvas } from '../assets/pixel/PixelCanvas';
import type { ParticleSystem } from '../rendering/ParticleSystem';
import type { SpriteActor } from '../entities/SpriteActor';
import { randRange } from '../utils/math';

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

/**
 * Effets visuels de combat, tous en pool : étincelles d'impact, éclats d'os,
 * ondes de choc, images rémanentes de l'esquive, griffures abyssales,
 * âmes libérées par les ennemis vaincus.
 */
export class VFX {
  private ghosts: Ghost[] = [];
  private rings: Ring[] = [];
  private decals: Decal[] = [];
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
        life: randRange(R, 0.15, 0.35), color: crit && i % 3 === 0 ? PAL.gold2 : main, colorEnd: end, intensity: 3.5, size: crit && i < 4 ? 2 : 1, drag: 6,
      });
    }
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
