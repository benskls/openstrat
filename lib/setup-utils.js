/**
 * setup-utils.js
 * Utilitaires pour l'exécution de commandes shell et la vérification des outils.
 */

const { exec, spawn } = require('child_process');
const path = require('path');

/**
 * Vérifie si une commande est disponible dans le PATH.
 * @param {string} cmd
 * @returns {Promise<boolean>}
 */
function checkCommand(cmd) {
  return new Promise((resolve) => {
    const platform = process.platform === 'win32' ? 'where' : 'which';
    exec(`${platform} ${cmd}`, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Exécute une commande shell et retourne une Promise (stdout/stderr).
 * @param {string} cmd
 * @param {object} opts — options child_process.exec (cwd, env, etc.)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execPromise(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Exécute une commande en streaming (pour les longues opérations comme push/deploy).
 * Appelle onData pour chaque ligne de sortie.
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} opts
 * @param {function(string)} onData
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function execStream(cmd, args, opts = {}, onData = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      ...opts,
      shell: process.platform === 'win32',
      env: { ...process.env, ...opts.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const line = data.toString();
      stdout += line;
      onData(line);
    });

    child.stderr.on('data', (data) => {
      const line = data.toString();
      stderr += line;
      onData(line); // On redirige stderr aussi vers onData pour le log en temps réel
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(`Command failed with code ${code}: ${cmd} ${args.join(' ')}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        return reject(err);
      }
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Sécurise un nom de repo GitHub (slugify).
 */
function slugifyRepoName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Vérifie que le chemin de projet est valide et ne tente pas de sortir du répertoire parent.
 */
function validateProjectPath(projectPath, parentDir) {
  const resolved = path.resolve(projectPath);
  const parentResolved = path.resolve(parentDir);
  if (!resolved.startsWith(parentResolved)) {
    throw new Error(`Invalid project path: ${projectPath} is outside parent directory`);
  }
  return resolved;
}

/**
 * Retourne les instructions d'installation pour un outil CLI donné.
 * Détecte automatiquement si brew/npm sont disponibles sur la machine locale.
 * @param {string} tool — 'gh' | 'vercel'
 * @returns {Promise<{tool: string, steps: {text: string, command?: string, note?: string}[], docsUrl: string}>}
 */
async function getInstallInstructions(tool) {
  const platform = process.platform;
  const isMac = platform === 'darwin';
  const isWin = platform === 'win32';
  const isLinux = platform === 'linux';

  if (tool === 'gh') {
    const steps = [];
    if (isMac) {
      const hasBrew = await checkCommand('brew');
      if (hasBrew) {
        steps.push({ text: 'Installez GitHub CLI', command: 'brew install gh' });
      } else {
        steps.push({
          text: 'Installez GitHub CLI',
          note: 'Homebrew n\'est pas détecté sur ce Mac. Téléchargez le fichier .pkg depuis le lien ci-dessous, double-cliquez pour l\'installer, puis revenez ici.'
        });
      }
    } else if (isWin) {
      steps.push({ text: 'Installez GitHub CLI', command: 'winget install --id GitHub.cli' });
    } else if (isLinux) {
      steps.push({ text: 'Installez GitHub CLI', command: 'sudo apt install gh    # Debian/Ubuntu\nsudo dnf install gh    # Fedora' });
    } else {
      steps.push({ text: 'Installez GitHub CLI', note: 'Voir la documentation officielle pour votre système.' });
    }
    steps.push({ text: 'Revenez ici et cliquez "Vérifier"' });
    return { tool: 'GitHub CLI (gh)', steps, docsUrl: 'https://cli.github.com/manual/installation' };
  }

  if (tool === 'vercel') {
    const steps = [];
    const hasNpm = await checkCommand('npm');
    if (!hasNpm) {
      steps.push({
        text: 'Installez Node.js (requis)',
        note: 'Node.js n\'est pas détecté. Téléchargez l\'installer sur https://nodejs.org, installez-le, puis relancez la vérification.'
      });
    }
    steps.push({ text: 'Installez Vercel CLI', command: 'npm install -g vercel' });
    steps.push({ text: 'Revenez ici et cliquez "Vérifier"' });
    return { tool: 'Vercel CLI', steps, docsUrl: 'https://vercel.com/docs/cli' };
  }

  if (tool === 'git') {
    const steps = [];
    if (isMac) {
      steps.push({
        text: 'Installez Git',
        note: 'Ouvrez le Terminal, tapez "git --version" et appuyez sur Entrée. macOS vous proposera d\'installer les outils de développement. Sinon, téléchargez-le sur https://git-scm.com/download/mac'
      });
    } else if (isWin) {
      steps.push({ text: 'Installez Git', note: 'Téléchargez l\'installer sur https://git-scm.com/download/win' });
    } else if (isLinux) {
      steps.push({ text: 'Installez Git', command: 'sudo apt install git    # Debian/Ubuntu\nsudo dnf install git    # Fedora' });
    } else {
      steps.push({ text: 'Installez Git', note: 'Voir https://git-scm.com/downloads' });
    }
    return { tool: 'Git', steps, docsUrl: 'https://git-scm.com/downloads' };
  }

  return { tool, steps: [], docsUrl: '' };
}

module.exports = {
  checkCommand,
  execPromise,
  execStream,
  slugifyRepoName,
  validateProjectPath,
  getInstallInstructions
};
