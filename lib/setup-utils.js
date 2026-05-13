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
 * @param {string} tool — 'gh' | 'vercel'
 * @returns {{installed: boolean, instructions: string[], authCommand: string, docsUrl: string}}
 */
function getInstallInstructions(tool) {
  const platform = process.platform;
  const isMac = platform === 'darwin';
  const isWin = platform === 'win32';
  const isLinux = platform === 'linux';

  if (tool === 'gh') {
    const installCmd = isMac 
      ? 'brew install gh' 
      : isWin 
        ? 'winget install --id GitHub.cli' 
        : isLinux 
          ? 'sudo apt install gh  (Debian/Ubuntu) ou sudo dnf install gh  (Fedora)'
          : 'voir https://github.com/cli/cli#installation';
    
    return {
      tool: 'GitHub CLI (gh)',
      installCommand: installCmd,
      authCommand: 'gh auth login',
      docsUrl: 'https://cli.github.com/manual/installation',
      instructions: [
        `1. Installez GitHub CLI : ${installCmd}`,
        `2. Connectez-vous : gh auth login`,
        `3. Revenez ici et cliquez "Vérifier"`
      ]
    };
  }

  if (tool === 'vercel') {
    const installCmd = isMac || isLinux
      ? 'npm install -g vercel'
      : isWin
        ? 'npm install -g vercel'
        : 'npm install -g vercel';
    
    return {
      tool: 'Vercel CLI',
      installCommand: installCmd,
      authCommand: 'vercel login',
      docsUrl: 'https://vercel.com/docs/cli',
      instructions: [
        `1. Installez Vercel CLI : ${installCmd}`,
        `2. Connectez-vous : vercel login`,
        `3. Revenez ici et cliquez "Vérifier"`
      ]
    };
  }

  return { tool, instructions: [] };
}

module.exports = {
  checkCommand,
  execPromise,
  execStream,
  slugifyRepoName,
  validateProjectPath,
  getInstallInstructions
};
