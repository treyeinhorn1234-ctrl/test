# Audio — ASHEN CROWN

Tous les sons actuels sont des **placeholders procéduraux** générés à l'exécution
(aucun fichier tiers, donc aucun problème de droits) :

| Fichier | Rôle |
| --- | --- |
| `sfx/ProceduralSfx.ts` | Effets (épée, impacts, magie, pas, interface…) synthétisés en PCM |
| `music/ProceduralMusic.ts` | Musique d'exploration + couche de combat mixée selon l'intensité |
| `AudioManager.ts` | Bus Maître / Musique / Effets / Ambiance, réverbération de crypte, spatialisation |

## Remplacer par des assets définitifs

1. Déposer les fichiers dans `src/assets/audio/sfx/` (format `.ogg` conseillé).
2. Les déclarer dans `SFX_FILES` (`AudioManager.ts`) avec le **même nom** que
   le générateur (`swing`, `boneHit`, `block`…). Le fichier remplace
   automatiquement la version synthétique ; en cas d'échec de chargement, le
   placeholder reste utilisé.
