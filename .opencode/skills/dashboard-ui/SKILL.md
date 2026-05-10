---
name: dashboard-ui
description: Patterns et composants UI pour le dashboard OpenStrat — Tailwind, vanilla JS, dark mode
license: MIT
compatibility: opencode
metadata:
  project: openstrat
  scope: frontend
---

## Design System OpenStrat

### Palette

| Token | Valeur | Usage |
|-------|--------|-------|
| `--primary` | `#6366f1` | Indigo — actions principales |
| `--primary-light` | `#818cf8` | Violet — accents, hover |
| `--bg-base` | `#09090b` | Zinc-950 — fond global |
| `--bg-surface` | `#18181b` | Zinc-900 — cartes, sidebar |
| `--border` | `#27272a` | Zinc-800 — bordures |
| `--text-primary` | `#fafafa` | Blanc cassé — titres |
| `--text-secondary` | `#a1a1aa` | Zinc-400 — corps |
| `--text-muted` | `#52525b` | Zinc-600 — labels |

### Composants

#### Bouton Primaire
```html
<button class="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium transition">
  Action
</button>
```

#### Carte
```html
<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
  <h3 class="text-white font-semibold">Titre</h3>
  <p class="text-zinc-500 text-sm mt-1">Description</p>
</div>
```

#### Badge
```html
<span class="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">label</span>
```

#### Toast
```js
// Créer un toast
const toast = document.createElement('div');
toast.className = 'fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50';
toast.textContent = 'Message';
document.body.appendChild(toast);
setTimeout(() => toast.remove(), 2000);
```

### Patterns

- **Active state** : bordure droite + background teinté
- **Hover state** : `bg-white/5` léger
- **Focus** : `outline-none ring-2 ring-indigo-500/50`
- **Transition** : `transition-all duration-200`
