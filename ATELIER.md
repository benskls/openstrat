# OpenStrat — Guide Atelier IA

> **Date** : 20 mai 2026  
> **Objectif** : Donner les bases pour démarrer un sideproject avec OpenCode  
> **Outil** : OpenStrat Dashboard (https://github.com/benskls/openstrat)

---

## Plan de l'atelier (2h)

### 1. Introduction & Démo (15 min)
**Objectif** : Montrer le potentiel, créer l'envie

- **Démo 3 min** : Tu demandes un bouton à OpenCode, il le code, tu montres le résultat
- **Concept** : L'agent de codage comme "dev junior" qui travaille 24/7
- **Promesse** : À la fin de l'atelier, chacun aura sa structure d'agents prête à coder

### 2. Setup OpenCode (20 min)
**Objectif** : Tout le monde a OpenCode qui tourne

```bash
# Commande à faire taper
npm install -g opencode-ai

# Puis dans un projet
cd ~/mon-sideproject
opencode
/init
```

**Tips à donner** :
- Configurer sa clé API (`/connect` puis opencode.ai/auth)
- Le fichier `AGENTS.md` se crée automatique à la racine
- Valider le fichier dans git (`git add AGENTS.md && git commit`)

### 3. Architecture Agents (25 min)
**Objectif** : Comprendre le modèle Primary/Subagent

**Concepts clés** (alignés sur la doc OpenCode) :
- **Primary** : L'agent avec qui tu parles (ex: `main`, `build`, `plan`)
- **Subagent** : Les experts spécialisés que tu invoques avec `@` (ex: `@design`, `@backend`)
- **Mode** : `primary` vs `subagent` dans la config
- **Tools** : Certains écrivent du code, d'autres analysent seulement (`write: false`)

**Exercice pratique** :
1. Créer `.opencode/agents/main.md` (ton chef d'orchestre)
2. Créer `.opencode/agents/cto.md` (expert technique)
3. Créer `.opencode/agents/design.md` (expert UI)

**Template main.md** :
```markdown
---
description: Chef d'orchestre du projet — coordonne les experts
mode: primary
temperature: 0.3
permission:
  task:
    "*": allow
---

Tu es le main agent de mon sideproject.
Tu coordonnes les experts via @mention.
Tu ne codes jamais directement, tu délègues.
Tu gardes la vision long terme du projet.
```

### 4. Skills /Start et /End (15 min)
**Objectif** : Gérer le contexte entre sessions sans brûler de tokens

**Concept** :
- `/start` → Charge le contexte du projet, rappelle où on en est
- `/end` → Sauvegarde l'état, liste les prochaines tâches

**Exercice** :
1. Créer `.opencode/skills/session-start/SKILL.md`
2. Créer `.opencode/skills/session-end/SKILL.md`
3. Tester : commencer une session, faire une tâche, finir, recommencer

**Template session-start** :
```markdown
---
name: session-start
description: Charge le contexte au début de chaque session
---

## Contexte actuel

- Projet : [Nom du sideproject]
- Phase : [Foundation / Core / Launch]
- Dernière tâche : [Ce qu'on a fait hier]
- Prochaine tâche : [Ce qu'on doit faire maintenant]

## Fichiers importants

- docs/PICTURE.md : Vision stratégique
- progress.md : Avancement des tâches
- AGENTS.md : Architecture agents

## Rappel des règles

- Toujours consulter progress.md avant de commencer
- Demander un GO avant toute refonte majeure
- Utiliser les composants maison (pas de lib externe)
```

### 5. Picture + Progress (20 min)
**Objectif** : Structurer la vision et le suivi

**Picture** (`docs/PICTURE.md`) :
- Vision à 3 ans
- 3-5 jalons
- Décisions figées
- Phases détaillées avec %

**Progress** (`progress.md`) :
- Chantiers en cours (tableau priorité/statut/prochaine étape)
- Chantiers terminés
- Backlog

**Démo OpenStrat** :
```bash
cd ~/Desktop/CLAUDE/openstrat
npm start
# Montrer les 5 vues : Agents, Skills, Picture, Progress, Roadmap
```

### 6. Design.md & Composants (10 min)
**Objectif** : Rappeler les bases design sans bloquer

**Message clé** :
> "Pas de lib UI externe (shadcn, bootstrap). Inspiration autorisée, import interdit."

**Checklist rapide** :
- Tokens Tailwind v4 (`@theme inline`)
- Radix primitives pour l'accessibilité
- CVA pour les variants
- Un seul fichier `globals.css`

**Ne pas approfondir** : Si un participant bloque ici, lui dire "on verra en session".

### 7. Le Mega Prompt & Itération (20 min)
**Objectif** : Lancer la machine

**Structure du mega prompt** :
```
Je veux [OBJECTIF CLAIR].

Contexte :
- Stack : [Next.js 16, Tailwind v4, Supabase, etc.]
- Design system : [lien vers DESIGN.md ou description]
- Contraintes : [pas de lib externe, mobile-first, etc.]

Références :
- [URL inspirante si besoin]
- [Screenshot si pertinent]

Livrable attendu :
- [Composant X avec props Y]
- [Page Z avec sections A, B, C]
- [Test visuel sur mobile + desktop]
```

**Exercice** :
1. Chaque participant rédige son mega prompt
2. Il le colle dans OpenCode
3. Il switch en mode Plan (`Tab`) pour valider l'approche
4. Puis mode Build (`Tab`) pour exécuter

### 8. Q/R & Conclusion (5 min)
**Objectif** : Débloquer les blocages, donner la suite

**Questions fréquentes** :
- "Ça marche offline ?" → Non, besoin d'API. Mais on peut préparer des prompts offline
- "Ça coûte cher ?" → ~$5-20/mois pour un sideproject actif. Tips : mode Plan pour réduire les tokens
- "Et si ça casse tout ?" → `/undo` dans OpenCode, ou `git reset --hard`

**Suite recommandée** :
- Session quotidienne de 30 min max (éviter le burnout token)
- Utiliser `/start` et `/end` systématiquement
- Tenir à jour `progress.md` à chaque session

---

## Commandes de référence

| Commande | Description |
|----------|-------------|
| `npm install -g opencode-ai` | Installer OpenCode |
| `opencode` | Lancer OpenCode dans un projet |
| `/init` | Initialiser OpenCode (crée AGENTS.md) |
| `/connect` | Configurer une clé API |
| `/undo` | Annuler la dernière modification |
| `/share` | Partager la conversation |
| `Tab` | Switcher entre Build et Plan |
| `@agent` | Invoquer un subagent |
| `/start` | Charger le skill de démarrage |
| `/end` | Charger le skill de clôture |

---

## Ressources

- **OpenCode Docs** : https://opencode.ai/docs/fr
- **OpenStrat Repo** : https://github.com/benskls/openstrat (privé, invitation envoyée)
- **Exemple Agents** : Voir `.opencode/agents/` dans ce repo
- **Exemple Skills** : Voir `.opencode/skills/` dans ce repo

---

## Checklist pré-atelier (pour toi)

- [ ] Machine de démo prête (OpenCode installé + clé API configurée)
- [ ] Projet de démo prêt (un petit sideproject simple à montrer)
- [ ] OpenStrat lancé (`npm start` dans `~/Desktop/CLAUDE/openstrat`)
- [ ] Connexion internet stable
- [ ] Plan B : repo offline avec le code déjà cloné sur une clé USB

---

*Bon atelier ! 🚀*
