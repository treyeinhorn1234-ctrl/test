import type * as THREE from 'three';
import type { Entity } from '../entities/Entity';
import type { InteractKind } from '../world/Level';

/** Catalogue des événements échangés entre systèmes. */
export interface GameEvents extends Record<string, unknown> {
  hit: {
    target: Entity;
    attacker: Entity;
    amount: number;
    crit: boolean;
    blocked: boolean;
    killed: boolean;
    position: THREE.Vector3;
    tag: string;
  };
  death: { entity: Entity };
  sfx: { name: string; position?: THREE.Vector3; volume?: number };
  playerAttack: { position: THREE.Vector3; heavy: boolean };
  xpGained: { amount: number; position: THREE.Vector3 };
  levelUp: { level: number };
  waveStarted: { wave: number; count: number };
  waveCleared: { wave: number };
  objective: { title: string; detail: string };
  interact: { kind: InteractKind };
  pickup: { kind: 'heal'; amount: number; position: THREE.Vector3 };
  message: { title: string; text: string };
  banner: { title: string; subtitle?: string };
  floatText: { text: string; position: THREE.Vector3; cls: string };
  playerDied: Record<string, never>;
}
