const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

const OPENSTRAT_DIR = path.resolve(__dirname);
const PARENT_DIR = path.dirname(OPENSTRAT_DIR);

// ─── Multi-Project Scanner ─────────────────────────────────────────

function scanProjects() {
  const projects = [];
  
  try {
    const entries = fs.readdirSync(PARENT_DIR);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'openstrat') continue;
      
      const entryPath = path.join(PARENT_DIR, entry);
      const stat = fs.statSync(entryPath);
      if (!stat.isDirectory()) continue;
      
      const opencodePath = path.join(entryPath, '.opencode');
      const hasOpencode = fs.existsSync(opencodePath);
      
      projects.push({
        id: entry,
        name: entry,
        path: entryPath,
        hasAgents: fs.existsSync(path.join(entryPath, '.opencode', 'agents')),
        hasSkills: fs.existsSync(path.join(entryPath, '.opencode', 'skills')),
        hasPicture: fs.existsSync(path.join(entryPath, 'docs', 'PICTURE.md')),
        hasProgress: fs.existsSync(path.join(entryPath, 'progress.md')),
        isOpencode: hasOpencode
      });
    }
  } catch (e) {
    console.error('Scan error:', e.message);
  }
  
  return projects;
}

function getProjectPaths(projectId) {
  const projectRoot = path.join(PARENT_DIR, projectId);
  
  // Security: ensure path stays within parent directory
  if (!projectRoot.startsWith(PARENT_DIR) || projectRoot === OPENSTRAT_DIR) {
    return null;
  }
  
  if (!fs.existsSync(projectRoot)) {
    return null;
  }
  
  return {
    root: projectRoot,
    agents: path.join(projectRoot, '.opencode', 'agents'),
    skills: path.join(projectRoot, '.opencode', 'skills'),
    progress: path.join(projectRoot, 'progress.md'),
    picture: path.join(projectRoot, 'docs', 'PICTURE.md')
  };
}

// ─── Middleware ────────────────────────────────────────────────────

app.use(cors());
app.use(express.text({ type: 'text/plain' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Endpoints ─────────────────────────────────────────────────

// Health & Projects
app.get('/api/health', (req, res) => {
  const projects = scanProjects();
  res.json({ 
    status: 'ok',
    openstratDir: OPENSTRAT_DIR,
    projectsFound: projects.length,
    projects: projects.map(p => ({ id: p.id, name: p.name, isOpencode: p.isOpencode }))
  });
});

app.get('/api/projects', (req, res) => {
  res.json(scanProjects());
});

// ─── AGENTS ────────────────────────────────────────────────────────

app.get('/api/agents', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  if (!fs.existsSync(paths.agents)) return res.json([]);
  const files = fs.readdirSync(paths.agents).filter(f => f.endsWith('.md'));
  const agents = files.map(f => ({
    name: f.replace('.md', ''),
    path: path.join(paths.agents, f)
  }));
  res.json(agents);
});

app.get('/api/agents/:name', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  const filePath = path.join(paths.agents, `${req.params.name}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.post('/api/agents/:name', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  const filePath = path.join(paths.agents, `${req.params.name}.md`);
  fs.writeFileSync(filePath, req.body, 'utf8');
  res.json({ success: true });
});

// ─── SKILLS ────────────────────────────────────────────────────────

app.get('/api/skills', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  if (!fs.existsSync(paths.skills)) return res.json([]);
  const dirs = fs.readdirSync(paths.skills).filter(d => {
    const full = path.join(paths.skills, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
  });
  const skills = dirs.map(d => ({
    name: d,
    path: path.join(paths.skills, d, 'SKILL.md')
  }));
  res.json(skills);
});

app.get('/api/skills/:name', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  const filePath = path.join(paths.skills, req.params.name, 'SKILL.md');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type('text').send(fs.readFileSync(filePath, 'utf8'));
});

app.post('/api/skills/:name', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  const dirPath = path.join(paths.skills, req.params.name);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, 'SKILL.md');
  fs.writeFileSync(filePath, req.body, 'utf8');
  res.json({ success: true });
});

// ─── PROGRESS & PICTURE ────────────────────────────────────────────

app.get('/api/progress', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  if (!fs.existsSync(paths.progress)) {
    return res.type('text').send(`# Progress — ${projectId}

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
  res.type('text').send(fs.readFileSync(paths.progress, 'utf8'));
});

app.get('/api/picture', (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });
  
  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });
  
  if (!fs.existsSync(paths.picture)) {
    return res.type('text').send(`# Picture — Vision du Projet ${projectId}

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
  res.type('text').send(fs.readFileSync(paths.picture, 'utf8'));
});

// ─── Server Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
  const projects = scanProjects();
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 OpenStrat Dashboard v1.1                            ║
║                                                          ║
║   Local:   http://localhost:${PORT}                        ║
║   Projects: ${projects.length} found                                    ║
║   ${projects.map(p => `• ${p.name}`).join('\n   ')}${projects.length === 0 ? '• (none)' : ''}
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
