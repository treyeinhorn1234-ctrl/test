import * as THREE from 'three';
import { PAL } from '../assets/palette';
import {
  altarCrystal, bonesDecal, candles, flameSheet, kingStatue, rubbleDecal, tornBanner, type PropSprite,
} from '../assets/sprites/propSprites';
import {
  floorTile, pillarTexture, sarcophagusLid, sarcophagusSide, sealedDoor, wallTexture, wallTopTexture,
} from '../assets/textures/cryptTextures';
import { CAMERA_YAW, PIXELS_PER_UNIT } from '../rendering/IsoCamera';
import { GroundMist } from '../rendering/GroundMist';
import type { ParticleSystem } from '../rendering/ParticleSystem';
import { createSpriteMaterial } from '../rendering/SpriteMaterial';
import { VERTICAL_STRETCH, tiltSpriteNormals } from '../entities/SpriteActor';
import { createRng, randRange } from '../utils/math';
import { CollisionWorld, TILE_SIZE } from './CollisionWorld';

export type InteractKind = 'tomb' | 'statue' | 'altar' | 'door' | 'banner';

export interface Interactable {
  kind: InteractKind;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
}

interface Torch {
  light: THREE.PointLight;
  flameTex: THREE.Texture[];
  base: number;
  phase: number;
  pos: THREE.Vector3;
}

interface Occluder {
  object: THREE.Object3D;
  materials: THREE.Material[];
  base: THREE.Vector3;
  height: number;
  halfWidth: number;
  opacity: number;
}

const WALL_H = 5;
const LOW_WALL_H = 0.8;
const WALL_CHARS = new Set(['#', 'T', 'B', 'D']);

/**
 * Construit une zone jouable à partir d'une carte ASCII : sol et murs
 * instanciés, décors, lumières, brume, collisions et objets interactifs.
 */
export class Level {
  readonly group = new THREE.Group();
  readonly collision: CollisionWorld;
  readonly playerSpawn = new THREE.Vector3();
  readonly enemySpawns: THREE.Vector3[] = [];
  readonly interactables: Interactable[] = [];
  readonly width: number;
  readonly depth: number;
  readonly mist: GroundMist;
  readonly moon: THREE.DirectionalLight;
  private torches: Torch[] = [];
  private glowLights: { light: THREE.PointLight; base: number; speed: number; pos: THREE.Vector3; color: number }[] = [];
  private occluders: Occluder[] = [];
  private disposables: { dispose(): void }[] = [];
  private grid: string[][];
  private rng = createRng(1337);
  private doorMaterial: THREE.MeshLambertMaterial | null = null;

  constructor(layout: string[], shadowMapSize: number) {
    const cols = Math.max(...layout.map((r) => r.length));
    const rows = layout.length;
    this.grid = layout.map((r) => r.padEnd(cols, '#').split(''));
    this.width = cols * TILE_SIZE;
    this.depth = rows * TILE_SIZE;

    const solid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ch = this.grid[r][c];
        if (WALL_CHARS.has(ch) || ch === 'S' || ch === 'V') solid[r * cols + c] = 1;
      }
    this.collision = new CollisionWorld(cols, rows, solid);

    this.buildFloor(cols, rows);
    this.buildWalls(cols, rows);
    this.buildProps(cols, rows);
    this.scatterDecals(cols, rows);

    // Éclairage d'ambiance : lumière lunaire filtrant par les fissures de la voûte.
    const hemi = new THREE.HemisphereLight(0x948a90, 0x34282c, 2.4);
    this.group.add(hemi);
    this.moon = new THREE.DirectionalLight(0xa4aae8, 1.0);
    this.moon.position.set(this.width / 2 - 14, 34, this.depth / 2 - 18);
    this.moon.target.position.set(this.width / 2, 0, this.depth / 2);
    this.moon.castShadow = shadowMapSize > 0;
    this.moon.shadow.mapSize.set(Math.max(512, shadowMapSize), Math.max(512, shadowMapSize));
    const sc = this.moon.shadow.camera;
    sc.left = -36;
    sc.right = 36;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 90;
    this.moon.shadow.bias = -0.0015;
    this.moon.shadow.normalBias = 0.04;
    this.group.add(this.moon, this.moon.target);


    this.mist = new GroundMist(this.width, this.depth, 0x564878);
    this.group.add(this.mist.mesh);
  }

  /** Centre monde d'une tuile. */
  static tileCenter(c: number, r: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3(c * TILE_SIZE + TILE_SIZE / 2, y, r * TILE_SIZE + TILE_SIZE / 2);
  }

  private isWall(c: number, r: number): boolean {
    const row = this.grid[r];
    if (!row || c < 0 || c >= row.length) return true;
    return WALL_CHARS.has(row[c]);
  }

  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }

  private buildFloor(cols: number, rows: number): void {
    const variants = [0, 1, 2, 3].map((v) => this.track(floorTile(v, 11 + v * 7)));
    const extra = [this.track(floorTile(0, 5)), this.track(floorTile(1, 23))];
    const textures = [...variants, ...extra];
    const buckets: THREE.Matrix4[][] = textures.map(() => []);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (this.isWall(c, r)) continue;
        const ch = this.grid[r][c];
        let v = 0;
        if (ch === ':') v = 1;
        else if (ch === ',') v = 2;
        else if (ch === '*') v = 3;
        else {
          const roll = this.rng();
          v = roll < 0.12 ? 1 : roll < 0.2 ? 2 : roll < 0.6 ? 4 : roll < 0.7 ? 5 : 0;
        }
        const rot = Math.floor(this.rng() * 4) * (Math.PI / 2);
        q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rot));
        m.compose(Level.tileCenter(c, r), q, new THREE.Vector3(1, 1, 1));
        buckets[v].push(m.clone());
      }
    const geo = this.track(new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE));
    textures.forEach((tex, i) => {
      if (buckets[i].length === 0) return;
      const mat = this.track(new THREE.MeshLambertMaterial({ map: tex }));
      const inst = new THREE.InstancedMesh(geo, mat, buckets[i].length);
      buckets[i].forEach((mm, k) => inst.setMatrixAt(k, mm));
      inst.receiveShadow = true;
      this.group.add(inst);
    });
  }

  private buildWalls(cols: number, rows: number): void {
    const side = this.track(wallTexture(77));
    const top = this.track(wallTopTexture(78));
    const sideMat = this.track(new THREE.MeshLambertMaterial({ map: side }));
    const topMat = this.track(new THREE.MeshLambertMaterial({ map: top, color: 0x9a90a8 }));
    const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

    const makeGeo = (h: number) => {
      const g = new THREE.BoxGeometry(TILE_SIZE, h, TILE_SIZE);
      g.translate(0, h / 2, 0);
      // Les faces latérales gardent 16 px/unité verticalement.
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let face = 0; face < 6; face++) {
        if (face === 2 || face === 3) continue;
        for (let k = 0; k < 4; k++) {
          const idx = face * 4 + k;
          uv.setY(idx, uv.getY(idx) * (h / 4));
        }
      }
      return this.track(g);
    };

    const tall: THREE.Vector3[] = [];
    const low: THREE.Vector3[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (!this.isWall(c, r)) continue;
        const front =
          r === rows - 1 ||
          c === cols - 1 ||
          (!this.isWall(c, r - 1) && r > 0) ||
          (!this.isWall(c - 1, r) && c > 0) ||
          (!this.isWall(c - 1, r - 1) && r > 0 && c > 0);
        (front ? low : tall).push(Level.tileCenter(c, r));
      }

    const place = (list: THREE.Vector3[], geo: THREE.BufferGeometry, cast: boolean) => {
      const inst = new THREE.InstancedMesh(geo, mats, list.length);
      const m = new THREE.Matrix4();
      list.forEach((p, i) => inst.setMatrixAt(i, m.makeTranslation(p.x, 0, p.z)));
      inst.castShadow = cast;
      inst.receiveShadow = true;
      this.group.add(inst);
    };
    place(tall, makeGeo(WALL_H), true);
    place(low, makeGeo(LOW_WALL_H), false);
  }

  /** Panneau sprite statique (vertical face caméra, ou décalque au sol). */
  private spriteMesh(sprite: PropSprite, upright: boolean, emissiveIntensity = 2): THREE.Mesh {
    const { material } = createSpriteMaterial(
      sprite.color,
      sprite.emissive,
      new THREE.Vector2(sprite.width, sprite.height),
      { depthBias: upright ? 0.3 : 0, emissiveIntensity },
    );
    this.track(material);
    const w = sprite.width / PIXELS_PER_UNIT;
    const h = (sprite.height / PIXELS_PER_UNIT) * (upright ? VERTICAL_STRETCH : 1);
    const geo = this.track(new THREE.PlaneGeometry(w, h));
    const px = (sprite.pivotX + 0.5) / sprite.width;
    const py = (sprite.pivotY + 1) / sprite.height;
    if (upright) {
      geo.translate(w * (0.5 - px), h * (py - 0.5), 0);
      tiltSpriteNormals(geo);
    }
    const mesh = new THREE.Mesh(geo, material);
    if (upright) mesh.rotation.y = CAMERA_YAW;
    else {
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.floor(this.rng() * 4) * (Math.PI / 2);
      mesh.position.y = 0.03;
    }
    return mesh;
  }

  private wallFaceDir(c: number, r: number): THREE.Vector3 {
    if (!this.isWall(c, r + 1)) return new THREE.Vector3(0, 0, 1);
    if (!this.isWall(c + 1, r)) return new THREE.Vector3(1, 0, 0);
    if (!this.isWall(c - 1, r)) return new THREE.Vector3(-1, 0, 0);
    return new THREE.Vector3(0, 0, -1);
  }

  private buildProps(cols: number, rows: number): void {
    const pillarMatBase = new THREE.MeshLambertMaterial({ map: this.track(pillarTexture(5)) });
    this.track(pillarMatBase);
    const pillarGeo = this.track(new THREE.CylinderGeometry(0.62, 0.7, 5.4, 8, 1, true));
    pillarGeo.translate(0, 2.7, 0);
    const capGeo = this.track(new THREE.BoxGeometry(1.7, 0.45, 1.7));
    const stoneMat = this.track(new THREE.MeshLambertMaterial({ map: this.track(sarcophagusSide(3)) }));
    const flame = flameSheet();
    this.track(flame.color);
    if (flame.emissive) this.track(flame.emissive);
    const doneDoubles = new Set<string>();

    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const ch = this.grid[r][c];
        const p = Level.tileCenter(c, r);
        switch (ch) {
          case '@':
            this.playerSpawn.copy(p);
            break;
          case 's':
            this.enemySpawns.push(p);
            break;
          case 'P': {
            const g = new THREE.Group();
            const mat = pillarMatBase.clone();
            mat.alphaHash = true;
            this.track(mat);
            const shaft = new THREE.Mesh(pillarGeo, mat);
            const base = new THREE.Mesh(capGeo, mat);
            base.position.y = 0.22;
            const cap = new THREE.Mesh(capGeo, mat);
            cap.position.y = 5.3;
            for (const m of [shaft, base, cap]) {
              m.castShadow = true;
              m.receiveShadow = true;
              g.add(m);
            }
            g.position.copy(p);
            this.group.add(g);
            this.collision.addCircle(p.x, p.z, 0.8);
            this.occluders.push({ object: g, materials: [mat], base: p.clone(), height: 5.6, halfWidth: 0.9, opacity: 1 });
            break;
          }
          case 'K': {
            const mesh = this.spriteMesh(kingStatue(100 + c * 7 + r), true);
            const mat = mesh.material as THREE.MeshLambertMaterial;
            mat.alphaTest = 0;
            mat.alphaHash = true;
            mesh.position.copy(p).add(new THREE.Vector3(0, 0, -0.2));
            this.group.add(mesh);
            this.collision.addCircle(p.x, p.z - 0.2, 1.0);
            this.occluders.push({ object: mesh, materials: [mat], base: mesh.position.clone(), height: 5.5, halfWidth: 1.2, opacity: 1 });
            this.interactables.push({ kind: 'statue', position: p.clone().add(new THREE.Vector3(0, 0, 1.2)), radius: 1.9, prompt: 'Examiner la statue' });
            break;
          }
          case 'S':
          case 'V': {
            const key = `${c},${r}`;
            if (doneDoubles.has(key)) break;
            doneDoubles.add(key);
            doneDoubles.add(`${c + 1},${r}`);
            const center = p.clone().add(new THREE.Vector3(TILE_SIZE / 2, 0, 0));
            if (ch === 'S') this.buildSarcophagus(center, stoneMat);
            else this.buildVarynTomb(center, stoneMat);
            break;
          }
          case 'A':
            this.buildAltar(p);
            break;
          case 'c': {
            const m = this.spriteMesh(candles(c * 31 + r), true, 2.5);
            m.position.copy(p).add(new THREE.Vector3(randRange(this.rng, -0.4, 0.4), 0, randRange(this.rng, -0.4, 0.4)));
            this.group.add(m);
            break;
          }
          case 'b': {
            const m = this.spriteMesh(bonesDecal(c * 13 + r), false);
            m.position.x = p.x;
            m.position.z = p.z;
            this.group.add(m);
            break;
          }
          case 'T':
            this.buildTorch(c, r, flame);
            break;
          case 'B': {
            const dir = this.wallFaceDir(c, r);
            const sprite = tornBanner(c * 3 + r);
            const { material } = createSpriteMaterial(sprite.color, sprite.emissive, new THREE.Vector2(sprite.width, sprite.height), { depthBias: 0, emissiveIntensity: 2 });
            this.track(material);
            const geo = this.track(new THREE.PlaneGeometry(sprite.width / PIXELS_PER_UNIT, sprite.height / PIXELS_PER_UNIT));
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.copy(p).addScaledVector(dir, TILE_SIZE / 2 + 0.03);
            mesh.position.y = 3.2;
            mesh.lookAt(mesh.position.clone().add(dir));
            this.group.add(mesh);
            this.interactables.push({ kind: 'banner', position: p.clone().addScaledVector(dir, TILE_SIZE / 2 + 1), radius: 1.6, prompt: 'Examiner la bannière' });
            break;
          }
          case 'D': {
            if (doneDoubles.has(`${c},${r}`)) break;
            doneDoubles.add(`${c + 1},${r}`);
            this.buildDoor(p.clone().add(new THREE.Vector3(TILE_SIZE / 2, 0, 0)), this.wallFaceDir(c, r));
            break;
          }
          default:
            break;
        }
      }
  }

  private buildSarcophagus(center: THREE.Vector3, stoneMat: THREE.Material): void {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.6, 1.0, 1.5)), stoneMat);
    body.position.y = 0.5;
    const lidTex = this.track(sarcophagusLid(Math.floor(center.x * 7 + center.z)));
    lidTex.center.set(0.5, 0.5);
    lidTex.rotation = Math.PI / 2;
    const lidTop = this.track(new THREE.MeshLambertMaterial({ map: lidTex }));
    const lid = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.8, 0.25, 1.7)), [stoneMat, stoneMat, lidTop, stoneMat, stoneMat, stoneMat]);
    lid.position.y = 1.12;
    for (const m of [body, lid]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.position.copy(center);
    this.group.add(g);
  }

  private buildVarynTomb(center: THREE.Vector3, stoneMat: THREE.Material): void {
    const g = new THREE.Group();
    const dark = this.track(new THREE.MeshLambertMaterial({ color: 0x2a2433 }));
    // Estrade.
    const dais = new THREE.Mesh(this.track(new THREE.BoxGeometry(5.2, 0.25, 3.0)), dark);
    dais.position.y = 0.12;
    // Cuve ouverte : quatre parois.
    const wallGeoLong = this.track(new THREE.BoxGeometry(3.8, 1.2, 0.25));
    const wallGeoShort = this.track(new THREE.BoxGeometry(0.25, 1.2, 1.8));
    const parts: [THREE.BufferGeometry, number, number][] = [
      [wallGeoLong, 0, -0.78],
      [wallGeoLong, 0, 0.78],
      [wallGeoShort, -1.78, 0],
      [wallGeoShort, 1.78, 0],
    ];
    for (const [geo, x, z] of parts) {
      const m = new THREE.Mesh(geo, stoneMat);
      m.position.set(x, 0.85, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    // Lueur abyssale au fond de la cuve.
    const glow = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(3.3, 1.3)),
      this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.void1).multiplyScalar(1.6) })),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.6;
    // Couvercle brisé, appuyé contre la cuve, et éclats.
    const lidTex = this.track(sarcophagusLid(999, true));
    lidTex.center.set(0.5, 0.5);
    lidTex.rotation = Math.PI / 2;
    const lidMat = this.track(new THREE.MeshLambertMaterial({ map: lidTex, alphaTest: 0.5 }));
    const lid = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.6, 0.22, 1.8)), [stoneMat, stoneMat, lidMat, stoneMat, stoneMat, stoneMat]);
    lid.position.set(-0.6, 0.5, 1.45);
    lid.rotation.x = 0.5;
    lid.rotation.y = 0.15;
    const chunk = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.8, 0.3, 0.6)), stoneMat);
    chunk.position.set(2.2, 0.3, 1.1);
    chunk.rotation.y = 0.6;
    for (const m of [dais, lid, chunk]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.add(glow);
    g.position.copy(center);
    this.group.add(g);

    const light = new THREE.PointLight(PAL.void1, 18, 9, 1.6);
    light.position.copy(center).add(new THREE.Vector3(0, 1.6, 0));
    this.group.add(light);
    this.glowLights.push({ light, base: 18, speed: 1.3, pos: center.clone().setY(0.8), color: PAL.void2 });
    this.interactables.push({ kind: 'tomb', position: center.clone().add(new THREE.Vector3(0, 0, 1.8)), radius: 2.2, prompt: 'Examiner ton sarcophage' });
  }

  private buildAltar(p: THREE.Vector3): void {
    const mat = this.track(new THREE.MeshLambertMaterial({ map: this.track(sarcophagusSide(41)), color: 0x9a8aa8 }));
    const base = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.5, 1.0, 1.2)), mat);
    base.position.copy(p).setY(0.5);
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);
    const crystal = this.spriteMesh(altarCrystal(), true, 2.4);
    crystal.position.copy(p).setY(1.0);
    this.group.add(crystal);
    this.collision.addCircle(p.x, p.z, 0.95);
    const light = new THREE.PointLight(PAL.void2, 22, 10, 1.6);
    light.position.copy(p).setY(2.2);
    this.group.add(light);
    this.glowLights.push({ light, base: 22, speed: 2.1, pos: p.clone().setY(1.8), color: PAL.void3 });
    this.interactables.push({ kind: 'altar', position: p.clone(), radius: 2.0, prompt: "Toucher l'autel abyssal" });
  }

  private buildTorch(c: number, r: number, flame: PropSprite & { frames: number }): void {
    const dir = this.wallFaceDir(c, r);
    const p = Level.tileCenter(c, r).addScaledVector(dir, TILE_SIZE / 2);
    const bracketMat = this.track(new THREE.MeshLambertMaterial({ color: 0x3a2a22 }));
    const bracket = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.25, 0.7, 0.25)), bracketMat);
    bracket.position.copy(p).addScaledVector(dir, 0.2).setY(2.3);
    bracket.rotation.x = dir.z * 0.4;
    bracket.rotation.z = -dir.x * 0.4;
    this.group.add(bracket);

    const colorTex = flame.color.clone();
    const emTex = flame.emissive!.clone();
    const { material } = createSpriteMaterial(colorTex, emTex, new THREE.Vector2(flame.width * flame.frames, flame.height), { depthBias: 0.4, emissiveIntensity: 3 });
    this.track(material);
    const w = flame.width / PIXELS_PER_UNIT;
    const h = (flame.height / PIXELS_PER_UNIT) * VERTICAL_STRETCH;
    const geo = this.track(new THREE.PlaneGeometry(w, h));
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.y = CAMERA_YAW;
    mesh.position.copy(p).addScaledVector(dir, 0.35).setY(2.55);
    this.group.add(mesh);

    const light = new THREE.PointLight(0xff8a3a, 42, 15, 1.5);
    light.position.copy(p).addScaledVector(dir, 0.9).setY(3.0);
    this.group.add(light);
    this.torches.push({ light, flameTex: [colorTex, emTex], base: 42, phase: this.rng() * 10, pos: mesh.position.clone().setY(3.0) });
  }

  private buildDoor(center: THREE.Vector3, dir: THREE.Vector3): void {
    const { color, emissive } = sealedDoor(9);
    this.track(color);
    this.track(emissive);
    const mat = this.track(new THREE.MeshLambertMaterial({ map: color, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 2.2 }));
    this.doorMaterial = mat;
    const mesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(4, 5)), mat);
    mesh.position.copy(center).addScaledVector(dir, TILE_SIZE / 2 + 0.02).setY(2.5);
    mesh.lookAt(mesh.position.clone().add(dir));
    mesh.receiveShadow = true;
    this.group.add(mesh);
    const light = new THREE.PointLight(PAL.void1, 14, 8, 1.7);
    light.position.copy(center).addScaledVector(dir, TILE_SIZE / 2 + 1.2).setY(2.2);
    this.group.add(light);
    this.glowLights.push({ light, base: 14, speed: 0.8, pos: light.position.clone(), color: PAL.void2 });
    this.interactables.push({ kind: 'door', position: center.clone().addScaledVector(dir, TILE_SIZE / 2 + 1.2), radius: 2.2, prompt: 'Examiner la porte scellée' });
  }

  private scatterDecals(cols: number, rows: number): void {
    for (let i = 0; i < 26; i++) {
      const c = 1 + Math.floor(this.rng() * (cols - 2));
      const r = 1 + Math.floor(this.rng() * (rows - 2));
      if (this.grid[r][c] !== '.' && this.grid[r][c] !== ',') continue;
      const sprite = this.rng() < 0.5 ? rubbleDecal(i * 17) : bonesDecal(i * 29 + 3);
      const m = this.spriteMesh(sprite, false);
      const p = Level.tileCenter(c, r);
      m.position.x = p.x + randRange(this.rng, -0.6, 0.6);
      m.position.z = p.z + randRange(this.rng, -0.6, 0.6);
      this.group.add(m);
    }
  }

  /** Animation des flammes, scintillement des lumières, particules d'ambiance. */
  update(dt: number, time: number, sparks: ParticleSystem, dust: ParticleSystem, focus: THREE.Vector3): void {
    this.mist.update(time);
    const frame = Math.floor(time * 9);
    for (const t of this.torches) {
      const f = (frame + Math.floor(t.phase * 3)) % 4;
      for (const tex of t.flameTex) tex.offset.x = f / 4;
      const flicker = Math.sin(time * 9 + t.phase) * 0.08 + Math.sin(time * 23 + t.phase * 2) * 0.05 + (Math.random() - 0.5) * 0.06;
      t.light.intensity = t.base * (1 + flicker);
      if (Math.random() < dt * 6) {
        sparks.emit({
          x: t.pos.x + randRange(Math.random, -0.1, 0.1), y: t.pos.y - 0.1, z: t.pos.z + randRange(Math.random, -0.1, 0.1),
          vx: randRange(Math.random, -0.3, 0.3), vy: randRange(Math.random, 0.8, 1.8), vz: randRange(Math.random, -0.3, 0.3),
          life: randRange(Math.random, 0.6, 1.3), color: PAL.fire2, colorEnd: PAL.fire0, intensity: 2.5, size: 1, drag: 1.2,
        });
      }
    }
    for (const g of this.glowLights) {
      g.light.intensity = g.base * (1 + Math.sin(time * g.speed) * 0.2);
      if (Math.random() < dt * 4) {
        sparks.emit({
          x: g.pos.x + randRange(Math.random, -0.7, 0.7), y: g.pos.y, z: g.pos.z + randRange(Math.random, -0.7, 0.7),
          vy: randRange(Math.random, 0.3, 0.9), vx: randRange(Math.random, -0.15, 0.15),
          life: randRange(Math.random, 1.2, 2.4), color: g.color, colorEnd: PAL.void0, intensity: 2, size: 1, drag: 0.4,
        });
      }
    }
    if (this.doorMaterial) this.doorMaterial.emissiveIntensity = 1.8 + Math.sin(time * 1.6) * 0.7;

    // Poussière en suspension autour du joueur et dans les puits de lumière.
    if (Math.random() < dt * 14) {
      dust.emit({
        x: focus.x + randRange(Math.random, -14, 14), y: randRange(Math.random, 0.3, 4), z: focus.z + randRange(Math.random, -10, 10),
        vx: randRange(Math.random, -0.12, 0.12), vy: randRange(Math.random, -0.05, 0.08), vz: randRange(Math.random, -0.12, 0.12),
        life: randRange(Math.random, 3, 6), color: 0x8c84a8, size: 1, alpha: 0.55,
      });
    }
  }

  /** Estompe (tramage) les piliers et statues qui masquent le joueur. */
  updateOcclusion(camera: THREE.Camera, target: THREE.Vector3, dt: number): void {
    const camPos = camera.position;
    const tNdc = target.clone().setY(1.2).project(camera);
    const tDist = camPos.distanceTo(target);
    for (const o of this.occluders) {
      let want = 1;
      if (camPos.distanceTo(o.base) < tDist) {
        const b = o.base.clone().project(camera);
        const top = o.base.clone().setY(o.height).project(camera);
        const edge = o.base.clone().add(new THREE.Vector3(o.halfWidth * Math.cos(CAMERA_YAW), 0, -o.halfWidth * Math.sin(CAMERA_YAW))).project(camera);
        const hw = Math.abs(edge.x - b.x) + 0.04;
        if (Math.abs(tNdc.x - b.x) < hw && tNdc.y > b.y - 0.05 && tNdc.y < top.y) want = 0.35;
      }
      o.opacity += (want - o.opacity) * Math.min(1, dt * 8);
      for (const m of o.materials) m.opacity = o.opacity;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
