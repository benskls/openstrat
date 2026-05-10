# OpenStrat

> Dashboard de gestion d'agents et skills pour projets IA avec OpenCode.

## Architecture

- **Frontend** : Vanilla HTML/CSS/JS, Tailwind CDN, Marked.js
- **Backend** : Express.js, détection multi-projets
- **Stack** : Node.js 18+

## Workspace

Ce projet utilise sa propre configuration OpenCode dans `.opencode/`.

## Agents

| Agent | Rôle |
|-------|------|
| `@main-openstrat` | Orchestrateur dashboard |
| `@backend-openstrat` | API Express, scan projets |
| `@frontend-openstrat` | UI/UX dashboard |

## Skills

| Skill | Usage |
|-------|-------|
| `project-scanner` | Détection projets OpenCode voisins |
| `dashboard-ui` | Composants et patterns UI |
| `session-start` | Brief d'ouverture de session |
| `session-end` | Clôture et récap de session |

## Développement

```bash
npm install
npm start
# http://localhost:3456
```
