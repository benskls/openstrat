/**
 * orchestrator.js
 * Orchestration complète : GitHub repo → Push → Vercel deploy.
 */

const github = require('./github');
const vercel = require('./vercel');
const { validateProjectPath } = require('./setup-utils');
const fs = require('fs');

/**
 * Effectue le setup complet GitHub + Vercel pour un projet.
 * @param {string} projectPath — chemin absolu du projet
 * @param {object} options
 * @param {string} options.repoName — nom du repo GitHub (défaut = basename du projet)
 * @param {boolean} options.isPrivate — true par défaut
 * @param {function(string)} options.onLog — callback log streaming
 * @returns {Promise<{success: boolean, steps: object[], error: string|null}>}
 */
async function fullSetup(projectPath, options = {}) {
  const { repoName, isPrivate = true, onLog = () => {} } = options;
  const name = repoName || require('path').basename(projectPath);

  const steps = [];

  // ─── Pré-vérifications ─────────────────────────────────────────────
  onLog('🔍 Checking prerequisites...');

  const ghStatus = await github.checkStatus();
  steps.push({ step: 'github-check', ...ghStatus });
  if (!ghStatus.installed) {
    return { success: false, steps, error: 'GitHub CLI (gh) is not installed. See docs/setup-github-vercel.md' };
  }
  if (!ghStatus.authenticated) {
    return { success: false, steps, error: 'Not authenticated with GitHub. Run: gh auth login' };
  }
  onLog(`✅ GitHub CLI ready (user: ${ghStatus.user})`);

  const vercelStatus = await vercel.checkStatus();
  steps.push({ step: 'vercel-check', ...vercelStatus });
  if (!vercelStatus.installed) {
    return { success: false, steps, error: 'Vercel CLI is not installed. See docs/setup-github-vercel.md' };
  }
  if (!vercelStatus.authenticated) {
    return { success: false, steps, error: 'Not authenticated with Vercel. Run: vercel login' };
  }
  onLog(`✅ Vercel CLI ready (user: ${vercelStatus.user})`);

  if (!fs.existsSync(projectPath)) {
    return { success: false, steps, error: `Project path does not exist: ${projectPath}` };
  }

  // ─── Étape 1 : GitHub ──────────────────────────────────────────────
  onLog('\n📦 Step 1/2 — GitHub Repository');
  const ghResult = await github.createAndPushRepo(projectPath, name, isPrivate, onLog);
  steps.push({ step: 'github-create', ...ghResult });
  if (!ghResult.success) {
    return { success: false, steps, error: ghResult.error };
  }

  // ─── Étape 2 : Vercel ──────────────────────────────────────────────
  onLog('\n🚀 Step 2/2 — Vercel Deployment');
  const vercelResult = await vercel.deploy(projectPath, onLog);
  steps.push({ step: 'vercel-deploy', ...vercelResult });
  if (!vercelResult.success) {
    return { success: false, steps, error: vercelResult.error };
  }

  onLog('\n🎉 Setup complete!');
  onLog(`   GitHub: ${ghResult.repoUrl}`);
  onLog(`   Vercel: ${vercelResult.deploymentUrl}`);

  return {
    success: true,
    steps,
    githubUrl: ghResult.repoUrl,
    vercelUrl: vercelResult.deploymentUrl,
    error: null
  };
}

/**
 * Effectue uniquement le setup GitHub (sans Vercel).
 */
async function setupGithubOnly(projectPath, options = {}) {
  const { repoName, isPrivate = true, onLog = () => {} } = options;
  const name = repoName || require('path').basename(projectPath);

  const ghStatus = await github.checkStatus();
  if (!ghStatus.installed) {
    return { success: false, error: 'GitHub CLI (gh) is not installed.' };
  }
  if (!ghStatus.authenticated) {
    return { success: false, error: 'Not authenticated with GitHub. Run: gh auth login' };
  }

  const result = await github.createAndPushRepo(projectPath, name, isPrivate, onLog);
  return { success: result.success, githubUrl: result.repoUrl, error: result.error };
}

/**
 * Effectue uniquement le déploiement Vercel (sans GitHub).
 */
async function setupVercelOnly(projectPath, onLog = () => {}) {
  const vercelStatus = await vercel.checkStatus();
  if (!vercelStatus.installed) {
    return { success: false, error: 'Vercel CLI is not installed.' };
  }
  if (!vercelStatus.authenticated) {
    return { success: false, error: 'Not authenticated with Vercel. Run: vercel login' };
  }

  const result = await vercel.deploy(projectPath, onLog);
  return { success: result.success, vercelUrl: result.deploymentUrl, error: result.error };
}

module.exports = {
  fullSetup,
  setupGithubOnly,
  setupVercelOnly
};
