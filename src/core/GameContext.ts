import type * as THREE from 'three';
import type { EventBus } from './EventBus';
import type { GameEvents } from './GameEvents';
import type { Level } from '../world/Level';
import type { CombatSystem } from '../combat/CombatSystem';
import type { VFX } from '../combat/VFX';
import type { Input } from '../engine/Input';
import type { IsoCamera } from '../rendering/IsoCamera';
import type { Player } from '../player/Player';

/**
 * Contexte partagé transmis aux entités à chaque mise à jour. Les entités n'ont
 * ainsi aucune dépendance directe vers la classe Game.
 */
export interface GameContext {
  events: EventBus<GameEvents>;
  level: Level;
  combat: CombatSystem;
  fx: VFX;
  input: Input;
  cameraRig: IsoCamera;
  player: Player;
  /** Point visé par la souris au sol. */
  aimPoint: THREE.Vector3;
  time: number;
  /** Gel de l'image (impact). */
  hitstop(duration: number): void;
  /** Ralenti : le temps s'écoule à `scale` pendant `duration` secondes réelles. */
  slowmo(scale: number, duration: number): void;
  /** Flash plein écran. */
  screenFlash(color: number, strength: number, decay?: number): void;
  /** Nombre maximal d'ennemis autorisés à attaquer simultanément. */
  attackTokens: { used: number; max: number };
}
