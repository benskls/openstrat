const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const github = require('./lib/github');
const vercel = require('./lib/vercel');
const orchestrator = require('./lib/orchestrator');
const setupUtils = require('./lib/setup-utils');

const app = express();
const PORT = process.env.PORT || 3456;

const OPENSTRAT_DIR = path.resolve(__dirname);
const CONFIG_PATH = path.join(OPENSTRAT_DIR, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (!data.projectConfig) data.projectConfig = {};
      return data;
    }
  } catch (e) { console.error('Config load error:', e.message); }
  return { parentDir: null, projectConfig: {} };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
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
  config.parentDir = resolved;
  if (!config.projectConfig) config.projectConfig = {};
  saveConfig(config);
  PARENT_DIR = resolved;
  res.json({ success: true, parentDir: resolved });
});

// ─── PROJECT CONFIG ────────────────────────────────────────────────

app.get('/api/config/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const pc = (config.projectConfig && config.projectConfig[projectId]) || {};
  res.json(pc);
});

app.post('/api/config/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' });
  }
  if (!config.projectConfig) config.projectConfig = {};
  config.projectConfig[projectId] = req.body;
  saveConfig(config);
  res.json({ success: true, config: config.projectConfig[projectId] });
});

// ─── AUTO SETUP ────────────────────────────────────────────────────

app.post('/api/setup', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' });
  }

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  const logs = [];
  try {
    const result = await orchestrator.fullSetup(paths.root, {
      repoName: projectId,
      isPrivate: true,
      onLog: (line) => logs.push(line)
    });

    if (result.success) {
      // Mettre à jour la config du projet
      if (!config.projectConfig) config.projectConfig = {};
      if (!config.projectConfig[projectId]) config.projectConfig[projectId] = {};
      config.projectConfig[projectId].setup = {
        completed: true,
        date: new Date().toISOString(),
        githubUrl: result.githubUrl,
        vercelUrl: result.vercelUrl
      };
      config.projectConfig[projectId].github = {
        repo: projectId,
        url: result.githubUrl
      };
      config.projectConfig[projectId].vercel = {
        url: result.vercelUrl,
        status: 'deployed'
      };
      saveConfig(config);

      res.json({
        success: true,
        message: `Setup terminé avec succès. GitHub: ${result.githubUrl} | Vercel: ${result.vercelUrl}`,
        githubUrl: result.githubUrl,
        vercelUrl: result.vercelUrl,
        logs,
        projectId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Setup failed',
        logs,
        projectId
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Unexpected error during setup',
      logs,
      projectId
    });
  }
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

// ─── SETUP GITHUB + VERCEL ─────────────────────────────────────────

/**
 * GET /api/setup/status
 * Vérifie que gh et vercel sont installés et authentifiés.
 */
app.get('/api/setup/status', async (req, res) => {
  try {
    const gh = await github.checkStatus();
    const vc = await vercel.checkStatus();
    const gitInstalled = await setupUtils.checkCommand('git');
    res.json({
      github: {
        installed: gh.installed,
        authenticated: gh.authenticated,
        user: gh.user,
        instructions: gh.instructions || null
      },
      vercel: {
        installed: vc.installed,
        authenticated: vc.authenticated,
        user: vc.user,
        instructions: vc.instructions || null
      },
      git: {
        installed: gitInstalled,
        instructions: gitInstalled ? null : await setupUtils.getInstallInstructions('git')
      },
      ready: gh.installed && gh.authenticated && vc.installed && vc.authenticated && gitInstalled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/github
 * Crée un repo GitHub et pousse le code initial.
 * Body: { projectId, repoName?, isPrivate? }
 */
app.post('/api/setup/github', async (req, res) => {
  const { projectId, repoName, isPrivate = true } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  const logs = [];
  const result = await orchestrator.setupGithubOnly(paths.root, {
    repoName: repoName || projectId,
    isPrivate,
    onLog: (line) => logs.push(line)
  });

  res.json({ ...result, logs });
});

/**
 * POST /api/setup/vercel
 * Déploie le projet sur Vercel.
 * Body: { projectId }
 */
app.post('/api/setup/vercel', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  const logs = [];
  const result = await orchestrator.setupVercelOnly(paths.root, (line) => logs.push(line));

  res.json({ ...result, logs });
});

/**
 * POST /api/setup/full
 * Workflow complet GitHub + Vercel.
 * Body: { projectId, repoName?, isPrivate? }
 * Supporte SSE (Server-Sent Events) si header Accept: text/event-stream
 */
app.post('/api/setup/full', async (req, res) => {
  const { projectId, repoName, isPrivate = true } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  const accept = req.headers.accept || '';
  const useSSE = accept.includes('text/event-stream');

  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ type: 'start', message: 'Setup started' });

    const result = await orchestrator.fullSetup(paths.root, {
      repoName: repoName || projectId,
      isPrivate,
      onLog: (line) => send({ type: 'log', message: line })
    });

    send({ type: 'end', ...result });
    res.end();
  } else {
    const logs = [];
    const result = await orchestrator.fullSetup(paths.root, {
      repoName: repoName || projectId,
      isPrivate,
      onLog: (line) => logs.push(line)
    });
    res.json({ ...result, logs });
  }
});

/**
 * GET /api/setup/vercel-url?project=<id>
 * Retourne l'URL de déploiement Vercel d'un projet.
 */
app.get('/api/setup/vercel-url', async (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  try {
    const urls = await vercel.getDeploymentUrl(paths.root);
    res.json({ success: true, ...urls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/setup/github-url?project=<id>
 * Retourne l'URL du remote GitHub d'un projet.
 */
app.get('/api/setup/github-url', async (req, res) => {
  const projectId = req.query.project;
  if (!projectId) return res.status(400).json({ error: 'Missing project parameter' });

  const paths = getProjectPaths(projectId);
  if (!paths) return res.status(404).json({ error: 'Project not found' });

  try {
    const url = await github.getRepoUrl(paths.root);
    res.json({ success: true, repoUrl: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VERSION & UPDATE CHECK ────────────────────────────────────────

const PACKAGE_JSON = require('./package.json');
const CURRENT_VERSION = PACKAGE_JSON.version;

app.get('/api/version', async (req, res) => {
  const result = {
    current: CURRENT_VERSION,
    latest: null,
    updateAvailable: false,
    repoUrl: 'https://github.com/benskls/openstrat'
  };
  
  try {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/benskls/openstrat/releases/latest',
      headers: { 'User-Agent': 'OpenStrat-Dashboard' }
    };
    
    const latest = await new Promise((resolve, reject) => {
      https.get(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.tag_name || null);
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
    
    if (latest) {
      result.latest = latest;
      const normalizedLatest = latest.startsWith('v') ? latest.substring(1) : latest;
      result.updateAvailable = normalizedLatest !== CURRENT_VERSION;
    }
  } catch (err) {
    // Silencieux — pas de connexion = pas de mise à jour affichée
  }
  
  res.json(result);
});

/**
 * POST /api/update
 * Exécute le script de mise à jour et retourne le résultat.
 */
app.post('/api/update', async (req, res) => {
  const { exec } = require('child_process');
  const updateScript = path.join(OPENSTRAT_DIR, 'update-openstrat.sh');
  
  if (!fs.existsSync(updateScript)) {
    return res.status(404).json({ 
      success: false, 
      error: 'Script de mise à jour introuvable. Réinstallez OpenStrat.' 
    });
  }

  res.json({ success: true, message: 'Mise à jour en cours...' });

  // Exécuter la mise à jour en arrière-plan après avoir répondu
  setTimeout(() => {
    exec(`bash "${updateScript}"`, { cwd: OPENSTRAT_DIR, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Update failed:', err.message);
      } else {
        console.log('Update completed:', stdout);
      }
    });
  }, 100);
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
