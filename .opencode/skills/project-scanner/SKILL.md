---
name: project-scanner
description: Détecte automatiquement les projets OpenCode voisins de OpenStrat
license: MIT
compatibility: opencode
metadata:
  project: openstrat
  scope: backend
---

## Objectif

Scanner le filesystem pour trouver tous les projets OpenCode utilisables par le dashboard.

## Algorithme

1. Récupérer le dossier parent de `openstrat/`
2. Lister tous les sous-dossiers
3. Pour chaque sous-dossier, vérifier s'il contient `.opencode/`
4. Si oui, l'ajouter comme projet détecté
5. Retourner la liste JSON

## Format de sortie

```json
[
  {
    "id": "altuas",
    "name": "altuas",
    "path": "/Users/.../altuas",
    "hasAgents": true,
    "hasSkills": true,
    "hasPicture": true,
    "hasProgress": true
  }
]
```

## Règles

- Ignorer `openstrat/` lui-même (le dashboard n'est pas un projet à scanner)
- Ignorer les dossiers cachés (commençant par `.`)
- Ignorer `node_modules/`
- Limiter la profondeur à 1 niveau
