import * as THREE from 'three';

export const TILE_SIZE = 2;

/**
 * Collisions sur grille : chaque tuile solide est une boîte alignée.
 * Les entités sont des cercles (XZ) repoussés hors des tuiles solides.
 * Coût constant par entité : seules les tuiles voisines sont testées.
 */
export class CollisionWorld {
  /** Obstacles circulaires statiques (piliers, statues) : x, z, rayon. */
  private circles: { x: number; z: number; r: number }[] = [];

  constructor(
    readonly cols: number,
    readonly rows: number,
    private readonly solid: Uint8Array,
  ) {}

  tileOf(x: number, z: number): { c: number; r: number } {
    return { c: Math.floor(x / TILE_SIZE), r: Math.floor(z / TILE_SIZE) };
  }

  isSolidTile(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.solid[r * this.cols + c] === 1;
  }

  isSolidAt(x: number, z: number): boolean {
    const { c, r } = this.tileOf(x, z);
    return this.isSolidTile(c, r);
  }

  addCircle(x: number, z: number, r: number): void {
    this.circles.push({ x, z, r });
  }

  /** Repousse un cercle hors des tuiles solides. Retourne true en cas de contact. */
  resolveCircle(pos: THREE.Vector3, radius: number): boolean {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      const { c: c0, r: r0 } = this.tileOf(pos.x, pos.z);
      for (let r = r0 - 1; r <= r0 + 1; r++)
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (!this.isSolidTile(c, r)) continue;
          const minX = c * TILE_SIZE;
          const minZ = r * TILE_SIZE;
          const cx = Math.max(minX, Math.min(pos.x, minX + TILE_SIZE));
          const cz = Math.max(minZ, Math.min(pos.z, minZ + TILE_SIZE));
          let dx = pos.x - cx;
          let dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          hit = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = radius - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          } else {
            // Centre à l'intérieur de la boîte : sortie par l'axe le plus court.
            const left = pos.x - minX;
            const right = minX + TILE_SIZE - pos.x;
            const top = pos.z - minZ;
            const bottom = minZ + TILE_SIZE - pos.z;
            const m = Math.min(left, right, top, bottom);
            dx = m === left ? -1 : m === right ? 1 : 0;
            dz = m === top ? -1 : m === bottom ? 1 : 0;
            pos.x += dx * (m + radius);
            pos.z += dz * (m + radius);
          }
        }
      for (const o of this.circles) {
        const dx = pos.x - o.x;
        const dz = pos.z - o.z;
        const min = radius + o.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (min - d);
        pos.z += (dz / d) * (min - d);
        hit = true;
      }
    }
    return hit;
  }

  /** Ligne de vue entre deux points (échantillonnage le long du segment). */
  hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(dist / (TILE_SIZE * 0.25));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolidAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
}
