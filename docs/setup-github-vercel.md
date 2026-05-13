# Guide — Déployer son Side Project avec GitHub + Vercel

> Objectif : passer de "projet local" à "site en ligne avec URL publique" en quelques clics.

---

## Avant de commencer (prérequis)

Tu as besoin de **2 comptes gratuits** et de **2 outils** installés sur ton ordinateur.

> **Bonne nouvelle** : le dashboard OpenStrat vérifie automatiquement si tout est installé et te guide étape par étape si ce n'est pas le cas !

### 1. Comptes à créer (gratuits)

| Service | Lien | Pourquoi |
|---------|------|----------|
| **GitHub** | https://github.com/signup | Stocker le code de ton projet (repo privé) |
| **Vercel** | https://vercel.com/signup | Héberger ton site gratuitement |

> Astuce : tu peux t'inscrire sur Vercel en un clic avec ton compte GitHub.

### 2. Outils à installer (une seule fois)

Le dashboard détecte automatiquement si les outils sont manquants et affiche les commandes exactes à copier-coller.

#### macOS (Terminal)

```bash
# GitHub CLI
brew install gh

# Vercel CLI
npm install -g vercel
```

#### Windows (PowerShell)

```powershell
# GitHub CLI
winget install --id GitHub.cli

# Vercel CLI
npm install -g vercel
```

#### Linux

```bash
# GitHub CLI (exemple pour Debian/Ubuntu)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo apt update
sudo apt install gh

# Vercel CLI
npm install -g vercel
```

### 3. Connexion (une seule fois par ordinateur)

```bash
# Connexion GitHub (ouvre une page web pour te connecter)
gh auth login

# Connexion Vercel (ouvre une page web)
vercel login
```

> Ces commandes stockent tes tokens de manière sécurisée dans le "keychain" de ton ordinateur. **Aucun mot de passe n'est écrit dans un fichier.**

### 4. Vérification automatique

Dans le dashboard (onglet **Config**), clique sur **"Vérifier"**. Le dashboard te dira :
- ✅ Si tout est prêt
- ⚠️ Si un outil est manquant (avec la commande exacte pour l'installer)
- ⚠️ Si tu n'es pas connecté (avec la commande pour te connecter)

---

## Méthode 1 — Depuis le Dashboard OpenStrat (recommandé pour les non-techniques)

1. Ouvre ton dashboard : http://localhost:3456
2. Va dans l'onglet **"Déploiement"** (à venir dans le frontend)
3. Choisis ton projet dans la liste
4. Clique sur **"Setup GitHub + Vercel"**
5. Le dashboard te montre la progression en direct
6. À la fin, tu reçois :
   - L'URL de ton repo GitHub (privé)
   - L'URL publique de ton site Vercel (`https://mon-projet-xxx.vercel.app`)

> Le dashboard appelle l'API du backend (`POST /api/setup/full`) qui fait tout automatiquement.

---

## Méthode 2 — Depuis la ligne de commande

Si tu préfères utiliser le terminal (ou si le dashboard n'est pas encore prêt) :

### Setup complet (GitHub + Vercel)

```bash
# Depuis le dossier openstrat
npm run setup:full -- ../mon-projet

# Avec un nom de repo différent
npm run setup:full -- ../mon-projet mon-super-projet

# Repo public (défaut = privé)
npm run setup:full -- ../mon-projet mon-super-projet --public
```

### Uniquement GitHub

```bash
npm run setup:github -- ../mon-projet
```

### Uniquement Vercel

```bash
npm run setup:vercel -- ../mon-projet
```

---

## Méthode 3 — Depuis l'API REST

Tu peux aussi appeler l'API directement (utile pour les intégrations ou les scripts personnalisés).

### Vérifier les prérequis

```bash
curl http://localhost:3456/api/setup/status
```

Réponse :
```json
{
  "github": { "installed": true, "authenticated": true, "user": "tonpseudo" },
  "vercel": { "installed": true, "authenticated": true, "user": "tonpseudo" },
  "ready": true
}
```

### Lancer le setup complet

```bash
curl -X POST http://localhost:3456/api/setup/full \
  -H "Content-Type: application/json" \
  -d '{"projectId": "mon-projet", "isPrivate": true}'
```

Réponse :
```json
{
  "success": true,
  "githubUrl": "https://github.com/tonpseudo/mon-projet",
  "vercelUrl": "https://mon-projet-abc123.vercel.app",
  "logs": ["🔍 Checking prerequisites...", "✅ GitHub CLI ready...", "..."]
}
```

### Streaming en temps réel (SSE)

Pour voir la progression en direct (comme le dashboard) :

```bash
curl -X POST http://localhost:3456/api/setup/full \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"projectId": "mon-projet"}'
```

Chaque ligne est un événement JSON :
```
data: {"type":"log","message":"🚀 Deploying to Vercel..."}

data: {"type":"end","success":true,"githubUrl":"...","vercelUrl":"..."}
```

---

## Endpoints API résumés

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/setup/status` | Vérifie gh + vercel installés et authentifiés |
| POST | `/api/setup/github` | Crée le repo GitHub et push le code |
| POST | `/api/setup/vercel` | Déploie sur Vercel |
| POST | `/api/setup/full` | Workflow complet (supporte SSE) |
| GET | `/api/setup/github-url?project=xxx` | Retourne l'URL GitHub du projet |
| GET | `/api/setup/vercel-url?project=xxx` | Retourne l'URL Vercel du projet |

---

## Coûts

| Service | Coût | Limites |
|---------|------|---------|
| GitHub Free | 0€ | Repos privés illimités, 2 000 minutes CI/CD/mois |
| Vercel Hobby | 0€ | Bande passante 100GB/mois, builds 6 000 min/mois |

> Tu restes dans le gratuit tant que ton side project n'a pas des milliers de visiteurs par jour.

---

## Dépannage

### "GitHub CLI (gh) is not installed"
→ Installe `gh` (voir section "Outils à installer").

### "Not authenticated with GitHub"
→ Lance `gh auth login` dans ton terminal.

### "Vercel CLI is not installed"
→ Installe `vercel` avec `npm install -g vercel`.

### "Not authenticated with Vercel"
→ Lance `vercel login` dans ton terminal.

### Le push échoue avec une erreur de permission
→ Vérifie que tu as bien fait `gh auth login` avec un compte qui a accès à GitHub.

### Je veux changer le repo de privé à public
→ Va sur GitHub.com, dans les Settings du repo, et change la visibilité.

---

## Sécurité

- **Aucun token n'est stocké dans les fichiers du projet.** Les CLI utilisent le "keychain" système (macOS), le "Credential Manager" (Windows) ou `libsecret` (Linux).
- Les repos sont créés **privés par défaut**.
- L'API ne demande jamais de mot de passe : elle délègue l'authentification aux CLI natives.
