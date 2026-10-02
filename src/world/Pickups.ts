import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { bloodOrb } from '../assets/sprites/propSprites';
import { CAMERA_YAW, PIXELS_PER_UNIT } from '../rendering/IsoCamera';
import { createSpriteMaterial } from '../rendering/SpriteMaterial';
import type { GameContext } from '../core/GameContext';
import { VERTICAL_STRETCH } from '../entities/SpriteActor';
import { randRange } from '../utils/math';

interface Orb {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  heal: number;
}

/**
 * Orbes de sang laissés par les ennemis : attirés par Varyn à courte
 * distance, ils restaurent des points de vie.
 */
export class Pickups {
  private orbs: Orb[] = [];
  private geo: THREE.PlaneGeometry;
  private material: THREE.MeshLambertMaterial;

  constructor(private readonly scene: THREE.Scene) {
    const s = bloodOrb();
    this.material = createSpriteMaterial(s.color, s.emissive, new THREE.Vector2(s.width, s.height), { depthBias: 0.3, emissiveIntensity: 2.5 }).material;
    const w = s.width / PIXELS_PER_UNIT;
    const h = (s.height / PIXELS_PER_UNIT) * VERTICAL_STRETCH;
    this.geo = new THREE.PlaneGeometry(w, h);
    this.geo.translate(0, h / 2, 0);
  }

  spawnOrb(at: THREE.Vector3, heal = 18): void {
    const mesh = new THREE.Mesh(this.geo, this.material);
    mesh.rotation.y = CAMERA_YAW;
    this.scene.add(mesh);
    this.orbs.push({
      mesh,
      pos: at.clone().setY(0),
      vel: new THREE.Vector3(randRange(Math.random, -2, 2), 0, randRange(Math.random, -2, 2)),
      age: 0,
      heal,
    });
  }

  update(dt: number, ctx: GameContext): void {
    const player = ctx.player;
    for (const o of this.orbs) {
      o.age += dt;
      o.vel.multiplyScalar(Math.exp(-4 * dt));
      const to = new THREE.Vector3().subVectors(player.position, o.pos).setY(0);
      const d = to.length();
      if (player.alive && d < 3.2 && o.age > 0.4) o.vel.addScaledVector(to.normalize(), 30 * dt);
      o.pos.addScaledVector(o.vel, dt);
      ctx.level.collision.resolveCircle(o.pos, 0.2);
      o.mesh.position.set(o.pos.x, 0.35 + Math.sin(o.age * 4) * 0.12, o.pos.z);
      if (Math.random() < dt * 5) ctx.fx.aura(o.pos, PAL.ember1, 1, 0.15);
      if (player.alive && d < 0.7 && o.age > 0.4) {
        const healed = player.heal(o.heal);
        ctx.events.emit('pickup', { kind: 'heal', amount: healed, position: o.pos.clone() });
        ctx.events.emit('sfx', { name: 'pickup' });
        o.age = 999;
      }
      if (o.age > 25) o.age = 999;
    }
    for (const o of this.orbs.filter((o) => o.age >= 999)) this.scene.remove(o.mesh);
    this.orbs = this.orbs.filter((o) => o.age < 999);
  }

  clear(): void {
    for (const o of this.orbs) this.scene.remove(o.mesh);
    this.orbs = [];
  }
}
