const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

// Try to find project root (sibling directories with .opencode/)
function findProjectRoot() {
  const currentDir = path.resolve(__dirname);
  const parentDir = path.dirname(currentDir);
  
  // Check if there's a project with .opencode in parent
  try {
    const siblings = fs.readdirSync(parentDir);
    for (const sibling of siblings) {
      const siblingPath = path.join(parentDir, sibling);
      if (fs.statSync(siblingPath).isDirectory() && sibling !== 'openstrat') {
        const opencodePath = path.join(siblingPath, '.opencode');
        if (fs.existsSync(opencodePath)) {
          return siblingPath;
        }
      }
    }
  } catch (e) {}
  
  // Fallback: use current working directory
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const AGENTS_DIR = path.join(PROJECT_ROOT, '.opencode', 'agents');
const SKILLS_DIR = path.join(PROJECT_ROOT, '.opencode', 'skills');

app.use(cors());
app.use(express.text({ type: 'text/plain' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    projectRoot: PROJECT_ROOT,
    agentsDir: fs.existsSync(AGENTS_DIR),
    skillsDir: fs.existsSync(SKILLS_DIR)
  });
});

// --- AGENTS ---
app.get('/api/agents', (req, res) => {
  if (!fs.existsSync(AGENTS_DIR)) return res.json([]);
  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const agents = files.map(f => ({
    name: f.replace('.md', ''),
    path: path.join(AGENTS_DIR, f)
  }));
  res.json(agents);
});

app.get('/api/agents/:name', (req, res) => {
  const filePath = path.join(AGENTS_DIR, `${req.params.name}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.post('/api/agents/:name', (req, res) => {
  const filePath = path.join(AGENTS_DIR, `${req.params.name}.md`);
  fs.writeFileSync(filePath, req.body, 'utf8');
  res.json({ success: true });
});

// --- SKILLS ---
app.get('/api/skills', (req, res) => {
  if (!fs.existsSync(SKILLS_DIR)) return res.json([]);
  const dirs = fs.readdirSync(SKILLS_DIR).filter(d => {
    const full = path.join(SKILLS_DIR, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
  });
  const skills = dirs.map(d => ({
    name: d,
    path: path.join(SKILLS_DIR, d, 'SKILL.md')
  }));
  res.json(skills);
});

app.get('/api/skills/:name', (req, res) => {
  const filePath = path.join(SKILLS_DIR, req.params.name, 'SKILL.md');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.post('/api/skills/:name', (req, res) => {
  const dirPath = path.join(SKILLS_DIR, req.params.name);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, 'SKILL.md');
  fs.writeFileSync(filePath, req.body, 'utf8');
  res.json({ success: true });
});

// --- PROGRESS & PICTURE ---
app.get('/api/progress', (req, res) => {
  const filePath = path.join(PROJECT_ROOT, 'progress.md');
  if (!fs.existsSync(filePath)) {
    // Return template
    return res.type('text').send(`# Progress — Mon Projet

> Dernière mise à jour : ${new Date().toISOString().split('T')[0]}

## Chantiers en cours

| Priorité | Chantier | Statut | Prochaine étape |
|----------|----------|--------|-----------------|
| P1 | ... | 🟡 | ... |

## Chantiers terminés
- [x] Setup initial

## Backlog
- [ ] ...
`);
  }
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.get('/api/picture', (req, res) => {
  const filePath = path.join(PROJECT_ROOT, 'docs', 'PICTURE.md');
  if (!fs.existsSync(filePath)) {
    // Return template
    return res.type('text').send(`# Picture — Vision du Projet

## Vision Cible

Décrivez ici la vision à 3 ans de votre projet.

## Roadmap

### Jalon 1
- **Cible** : MVP
- **Statut** : 🟡 En cours

## Décisions Figées

| ID | Décision | Date |
|----|----------|------|
| D01 | ... | ${new Date().toISOString().split('T')[0]} |
`);
  }
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 OpenStrat Dashboard                                 ║
║                                                          ║
║   Local:   http://localhost:${PORT}                        ║
║   Project: ${PROJECT_ROOT}
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
