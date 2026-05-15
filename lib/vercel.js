/**
 * vercel.js
 * Wrapper autour de Vercel CLI pour déployer des projets.
 */

const { execPromise, execStream, getInstallInstructions } = require('./setup-utils');
const path = require('path');

/**
 * Vérifie que vercel CLI est installé et que l'utilisateur est authentifié.
 * On essaie directement `vercel whoami` au lieu de checkCommand() pour éviter
 * les problèmes de PATH hérité par le processus Node.
 * @returns {Promise<{installed: boolean, authenticated: boolean, user: string|null, error: string|null}>}
 */
async function checkStatus() {
  try {
    const { stdout } = await execPromise('vercel whoami');
    const user = stdout.trim() || null;
    return { installed: true, authenticated: true, user, error: null, instructions: null };
  } catch (err) {
    const msg = (err.stderr || err.message || '').toLowerCase();
    const isNotFound = msg.includes('command not found') || msg.includes('not found') || msg.includes('no such file') || err.code === 'ENOENT';

    if (isNotFound) {
      const instructions = await getInstallInstructions('vercel');
      return {
        installed: false,
        authenticated: false,
        user: null,
        error: 'Vercel CLI n\'est pas installé',
        instructions
      };
    }

    // La commande a été trouvée mais a échoué (probablement non authentifié)
    const instructions = await getInstallInstructions('vercel');
    return {
      installed: true,
      authenticated: false,
      user: null,
      error: err.stderr || err.message,
      instructions: {
        ...instructions,
        steps: [
          { text: '⚠️ Vercel CLI est installé mais vous n\'êtes pas connecté' },
          { text: '👉 Connectez-vous', command: 'vercel login' },
          { text: 'Revenez ici et cliquez "Vérifier"' }
        ]
      }
    };
  }
}

/**
 * Déploie un projet sur Vercel.
 * @param {string} projectPath — chemin absolu du projet
 * @param {function(string)} onLog — callback pour chaque ligne de log
 * @returns {Promise<{success: boolean, deploymentUrl: string|null, projectUrl: string|null, error: string|null}>}
 */
async function deploy(projectPath, onLog = () => {}) {
  onLog('🚀 Deploying to Vercel...');

  try {
    // vercel --yes accepte automatiquement les defaults
    const { stdout } = await execStream('vercel', ['--yes'], { cwd: projectPath }, onLog);

    // Extraire l'URL de déploiement depuis stdout
    // Vercel affiche généralement: https://<project>-<hash>.vercel.app
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
    const deploymentUrl = urlMatch ? urlMatch[0] : null;

    // Récupérer l'URL du projet (dashboard Vercel)
    let projectUrl = null;
    try {
      const projectName = path.basename(projectPath);
      const { stdout: listOut } = await execPromise(`vercel ls ${projectName} --meta`, { cwd: projectPath });
      // Chercher une URL de type https://vercel.com/USER/PROJECT
      const projectMatch = listOut.match(/https:\/\/vercel\.com\/[^\s]+/);
      projectUrl = projectMatch ? projectMatch[0] : null;
    } catch {
      // Ignore, projectUrl est optionnel
    }

    onLog(`✅ Deployed: ${deploymentUrl || 'URL not extracted'}`);
    return { success: true, deploymentUrl, projectUrl, error: null };
  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    onLog(`❌ Error: ${msg}`);
    return { success: false, deploymentUrl: null, projectUrl: null, error: msg };
  }
}

/**
 * Récupère l'URL du dernier déploiement pour un projet.
 * @param {string} projectPath
 * @returns {Promise<{deploymentUrl: string|null, projectUrl: string|null}>}
 */
async function getDeploymentUrl(projectPath) {
  try {
    const projectName = path.basename(projectPath);
    // Essayer avec --json pour un parsing fiable
    const { stdout } = await execPromise(`vercel list ${projectName} --json`, { cwd: projectPath });
    const deployments = JSON.parse(stdout);
    if (Array.isArray(deployments) && deployments.length > 0) {
      // Prendre le premier déploiement (le plus récent)
      const latest = deployments[0];
      const deploymentUrl = latest.url || null;
      // Construire l'URL du projet Vercel dashboard
      const projectUrl = latest.projectId
        ? `https://vercel.com/${latest.creator?.username || ''}/${projectName}`
        : null;
      return { deploymentUrl, projectUrl };
    }
    return { deploymentUrl: null, projectUrl: null };
  } catch {
    return { deploymentUrl: null, projectUrl: null };
  }
}

module.exports = {
  checkStatus,
  deploy,
  getDeploymentUrl
};
