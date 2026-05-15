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
    // whoami peut retourner un succès avec un stdout vide dans certains cas
    // On considère que auth = true UNIQUEMENT si on a un username non vide
    if (user) {
      return { installed: true, authenticated: true, user, error: null, instructions: null };
    }
    // Si stdout vide, on est probablement pas auth — on tombe dans le catch logique
    throw new Error('Empty username from vercel whoami');
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
 * Vérifie si un projet Vercel avec ce nom existe déjà pour l'utilisateur connecté.
 * Parse la sortie texte de `vercel list <name>` car --json n'est pas supporté
 * par toutes les versions de la CLI.
 * @param {string} projectName
 * @returns {Promise<{exists: boolean, url: string|null, projectUrl: string|null}>}
 */
async function checkProjectExists(projectName) {
  try {
    const { stdout } = await execPromise(`vercel list ${projectName}`, { timeout: 15000 });
    // Chercher une URL de type https://xxx.vercel.app dans la sortie
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
    if (urlMatch) {
      // Récupérer le username via whoami pour construire l'URL dashboard
      let username = '';
      try {
        const { stdout: whoami } = await execPromise('vercel whoami');
        username = whoami.trim();
      } catch {
        // ignore
      }

      // Récupérer le domaine personnalisé via `vercel project list`
      // Note: Vercel CLI écrit sur stderr, pas stdout
      let domain = null;
      try {
        const { stderr: projOut } = await execPromise('vercel project list', { timeout: 15000 });
        // Chercher la ligne du projet et extraire l'URL de production
        const lines = (projOut || '').split('\n');
        for (const line of lines) {
          if (line.trim().startsWith(projectName)) {
            // Format: "altuas         https://altuas.fr       8d        24.x"
            const parts = line.trim().split(/\s{2,}/);
            if (parts.length >= 2 && parts[1].startsWith('https://')) {
              domain = parts[1].trim();
            }
            break;
          }
        }
      } catch {
        // ignore
      }

      return {
        exists: true,
        url: urlMatch[0],
        projectUrl: username ? `https://vercel.com/${username}/${projectName}` : null,
        domain
      };
    }
    return { exists: false, url: null, projectUrl: null, domain: null };
  } catch {
    return { exists: false, url: null, projectUrl: null, domain: null };
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
 * Parse la sortie texte car --json n'est pas supporté par toutes les versions de la CLI.
 * @param {string} projectPath
 * @returns {Promise<{deploymentUrl: string|null, projectUrl: string|null}>}
 */
async function getDeploymentUrl(projectPath) {
  try {
    const projectName = path.basename(projectPath);
    const { stdout } = await execPromise(`vercel list ${projectName}`, { cwd: projectPath });
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
    if (urlMatch) {
      let username = '';
      try {
        const { stdout: whoami } = await execPromise('vercel whoami');
        username = whoami.trim();
      } catch {
        // ignore
      }
      return {
        deploymentUrl: urlMatch[0],
        projectUrl: username ? `https://vercel.com/${username}/${projectName}` : null
      };
    }
    return { deploymentUrl: null, projectUrl: null };
  } catch {
    return { deploymentUrl: null, projectUrl: null };
  }
}

module.exports = {
  checkStatus,
  deploy,
  getDeploymentUrl,
  checkProjectExists
};
