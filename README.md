# OpenStrat

> **Dashboard de gestion d'agents et de skills pour projets IA avec OpenCode.**

OpenStrat est un outil de visualisation et de gestion pour structurer vos projets side-project avec OpenCode. Il vous permet de cartographier vos agents, vos skills, votre vision stratégique (Picture) et votre avancement (Progress) dans une interface web simple et élégante.

## 🚀 Quick Start

```bash
# Cloner le repo
git clone <repo-url> openstrat
cd openstrat

# Installer les dépendances
npm install

# Lancer le dashboard
npm start
```

Ouvrez [http://localhost:3456](http://localhost:3456) dans votre navigateur.

## 📁 Structure projet

```
openstrat/
├── public/
│   └── index.html          # Dashboard UI (single file)
├── server.js               # Express API + static serve
├── package.json
├── README.md
└── .gitignore
```

## 🎯 Fonctionnalités

| Vue | Description |
|-----|-------------|
| **Agents** | Hiérarchie Primary/Subagent alignée sur le modèle OpenCode |
| **Skills** | Bibliothèque de skills avec édition inline |
| **Picture** | Visualisation stratégique (phases, jalons, trajectoire) |
| **Progress** | Suivi des tâches et recommandations |
| **Roadmap** | Matrix Picture × Progress pour voir l'alignement stratégique |

## 🛠 Stack

- **Backend** : Express.js
- **Frontend** : Vanilla HTML/CSS/JS + Tailwind CDN
- **Parsing** : Marked.js pour le rendu Markdown

## 📝 Usage

1. Placez votre projet OpenCode à côté du dossier `openstrat/` (même parent)
2. Le dashboard détecte automatiquement votre `.opencode/` et `progress.md`
3. Éditez agents et skills directement dans l'interface
4. Sauvegardez avec `Cmd+S` ou le bouton Save

## 🏗 Créé pour l'atelier IA

OpenStrat a été conçu comme outil pédagogique pour accompagner la méthodologie :
- Setup OpenCode
- Création d'agents (main + subagents)
- Skills de session (start/end)
- Picture & Progress structurés

---

*Logo et design inspirés de l'écosystème OpenCode.*
