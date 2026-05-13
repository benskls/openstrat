const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

const OPENSTRAT_DIR = path.resolve(__dirname);
const CONFIG_PATH = path.join(OPENSTRAT_DIR, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) { console.error('Config load error:', e.message); }
  return { parentDir: null };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

let config = loadConfig();
let PARENT_DIR = config.parentDir ? path.resolve(config.parentDir) : path.dirname(OPENSTRAT_DIR);

// Validation au boot
if (config.parentDir && !fs.existsSync(PARENT_DIR)) {
  console.warn(`⚠️ Configured parentDir not found: ${config.parentDir}, falling back to default.`);
  PARENT_DIR = path.dirname(OPENSTRAT_DIR);
}

// ─── Multi-Project Scanner ─────────────────────────────────────────

function scanProjects() {
  const projects = [];

  try {
    const entries = fs.readdirSync(PARENT_DIR);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;

      const entryPath = path.join(PARENT_DIR, entry);
      const stat = fs.statSync(entryPath);
      if (!stat.isDirectory()) continue;

      // Exclude the OpenStrat installation directory itself
      if (entryPath === OPENSTRAT_DIR) continue;

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
        hasRoadmap: fs.existsSync(path.join(entryPath, 'roadmap.md')),
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
  if (!projectRoot.startsWith(PARENT_DIR)) {
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

// ─── CONFIG ────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({ parentDir: config.parentDir || null });
});

app.post('/api/config', (req, res) => {
  const { parentDir } = req.body;
  if (!parentDir || typeof parentDir !== 'string') {
    return res.status(400).json({ error: 'Invalid directory path' });
  }
  const resolved = path.resolve(parentDir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return res.status(400).json({ error: 'Directory does not exist' });
  }
  config = { parentDir: resolved };
  saveConfig(config);
  PARENT_DIR = resolved;
  res.json({ success: true, parentDir: resolved });
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

// ─── FILE GENERATION ───────────────────────────────────────────────

app.post('/api/generate-file', (req, res) => {
  const { projectId, fileType } = req.body;

  if (!projectId || !fileType) {
    return res.status(400).json({ error: 'Missing projectId or fileType' });
  }

  const validTypes = ['main-agent', 'session-start', 'session-end', 'picture', 'progress', 'roadmap'];
  if (!validTypes.includes(fileType)) {
    return res.status(400).json({ error: 'Unknown fileType' });
  }

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  const projectSlug = projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const templatesDir = path.join(OPENSTRAT_DIR, 'templates');

  function renderTemplate(templatePath, outputPath) {
    let content = fs.readFileSync(templatePath, 'utf8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, projectId)
      .replace(/\{\{PROJECT_SLUG\}\}/g, projectSlug)
      .replace(/\{\{PROJECT_TYPE\}\}/g, 'Side project')
      .replace(/\{\{TARGET_AUDIENCE\}\}/g, 'Utilisateurs')
      .replace(/\{\{KEY_PROBLEM\}\}/g, 'Problème à résoudre')
      .replace(/\{\{HORIZON\}\}/g, '1-3 ans');
    fs.writeFileSync(outputPath, content, 'utf8');
  }

  let created = [];

  switch (fileType) {
    case 'main-agent':
      fs.mkdirSync(paths.agents, { recursive: true });
      renderTemplate(path.join(templatesDir, 'main-agent.md'), path.join(paths.agents, `${projectId}-main.md`));
      created.push('.opencode/agents/' + projectId + '-main.md');
      break;
    case 'session-start':
      fs.mkdirSync(path.join(paths.skills, projectId + '-session-start'), { recursive: true });
      renderTemplate(path.join(templatesDir, 'session-start.md'), path.join(paths.skills, projectId + '-session-start', 'SKILL.md'));
      created.push('.opencode/skills/' + projectId + '-session-start/SKILL.md');
      break;
    case 'session-end':
      fs.mkdirSync(path.join(paths.skills, projectId + '-session-end'), { recursive: true });
      renderTemplate(path.join(templatesDir, 'session-end.md'), path.join(paths.skills, projectId + '-session-end', 'SKILL.md'));
      created.push('.opencode/skills/' + projectId + '-session-end/SKILL.md');
      break;
    case 'picture':
      fs.mkdirSync(path.join(paths.root, 'docs'), { recursive: true });
      renderTemplate(path.join(templatesDir, 'picture.md'), path.join(paths.root, 'docs', 'PICTURE.md'));
      created.push('docs/PICTURE.md');
      break;
    case 'progress':
      renderTemplate(path.join(templatesDir, 'progress.md'), paths.progress);
      created.push('progress.md');
      break;
    case 'roadmap':
      renderTemplate(path.join(templatesDir, 'roadmap.md'), path.join(paths.root, 'roadmap.md'));
      created.push('roadmap.md');
      break;
  }

  res.json({ success: true, created });
});

// ─── Server Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
  const projects = scanProjects();
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 OpenStrat Dashboard v1.1                            ║
║                                                          ║
║   Local:    http://localhost:${PORT}                        ║
║   Parent:   ${PARENT_DIR}                                    ║
║   Projects: ${projects.length} found                                    ║
║   ${projects.map(p => `• ${p.name}`).join('\n   ')}${projects.length === 0 ? '• (none)' : ''}
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
