/**
 * setup-utils.js
 * Utilitaires pour l'exécution de commandes shell et la vérification des outils.
 */

const { exec, spawn } = require('child_process');
const path = require('path');

/**
 * Vérifie si une commande est disponible dans le PATH.
 * Cherche aussi dans les chemins absolus usuels (utile si le processus
 * a été démarré avant l'installation de la commande).
 * @param {string} cmd
 * @returns {Promise<boolean>}
 */
async function checkCommand(cmd) {
  // 1. Vérifier via which/where (PATH du processus)
  const inPath = await new Promise((resolve) => {
    const platform = process.platform === 'win32' ? 'where' : 'which';
    exec(`${platform} ${cmd}`, (err) => resolve(!err));
  });
  if (inPath) return true;

  // 2. Fallback : chemins absolus usuels
  const commonPaths = [
    `/usr/local/bin/${cmd}`,
    `/opt/homebrew/bin/${cmd}`,
    `/usr/bin/${cmd}`,
    `/bin/${cmd}`,
    `/home/linuxbrew/.linuxbrew/bin/${cmd}`
  ];
  for (const p of commonPaths) {
    try {
      await execPromise(`test -x "${p}"`);
      return true;
    } catch (e) {
      // continue
    }
  }
  return false;
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
 * Vérifie si brew est installé même si son chemin n'est pas dans le PATH (Mac Apple Silicon).
 * @returns {Promise<{inPath: boolean, installPath: string|null}>}
 */
async function checkBrewPath() {
  const inPath = await checkCommand('brew');
  if (inPath) return { inPath: true, installPath: null };

  // Sur Mac Apple Silicon (M1/M2/M3), brew est souvent dans /opt/homebrew
  const commonPaths = [
    '/opt/homebrew/bin/brew',
    '/usr/local/bin/brew',
    '/home/linuxbrew/.linuxbrew/bin/brew'
  ];
  for (const p of commonPaths) {
    try {
      await execPromise(`test -x "${p}"`);
      return { inPath: false, installPath: p };
    } catch (e) {
      // continue
    }
  }
  return { inPath: false, installPath: null };
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
      const brewCheck = await checkBrewPath();
      if (brewCheck.inPath) {
        steps.push({ text: '1. Installez GitHub CLI', command: 'brew install gh' });
      } else if (brewCheck.installPath) {
        // Brew est installé mais pas dans le PATH (cas Apple Silicon classique)
        const isAppleSilicon = brewCheck.installPath === '/opt/homebrew/bin/brew';
        if (isAppleSilicon) {
          steps.push({
            text: '1. Connectez Homebrew au terminal',
            note: 'Homebrew est installé mais pas reconnu par votre terminal. Exécutez les commandes ci-dessous pour le connecter.'
          });
          steps.push({ text: '   → Ajouter au PATH', command: 'echo \'eval "$(/opt/homebrew/bin/brew shellenv)"\' >> ~/.zprofile' });
          steps.push({ text: '   → Appliquer maintenant', command: 'eval "$(/opt/homebrew/bin/brew shellenv)"' });
        } else {
          steps.push({
            text: '1. Connectez Homebrew au terminal',
            command: `eval "\$(${brewCheck.installPath} shellenv)"`
          });
        }
        steps.push({ text: '2. Installez GitHub CLI', command: 'brew install gh' });
      } else {
        steps.push({
          text: '1. Installez GitHub CLI',
          note: 'Téléchargez le fichier .pkg depuis la page ci-dessous, double-cliquez pour l\'installer.'
        });
      }
    } else if (isWin) {
      steps.push({ text: '1. Installez GitHub CLI', command: 'winget install --id GitHub.cli' });
    } else if (isLinux) {
      steps.push({ text: '1. Installez GitHub CLI', command: 'sudo apt install gh    # Debian/Ubuntu\nsudo dnf install gh    # Fedora' });
    } else {
      steps.push({ text: '1. Installez GitHub CLI', note: 'Téléchargez l\'installer pour votre système depuis le lien ci-dessous.' });
    }
    steps.push({ text: '2. Connectez-vous à GitHub', command: 'gh auth login' });
    steps.push({ text: '3. Revenez ici et cliquez "Vérifier"' });
    return { tool: 'GitHub CLI (gh)', steps, docsUrl: 'https://github.com/cli/cli/releases/latest' };
  }

  if (tool === 'vercel') {
    const steps = [];
    const hasNpm = await checkCommand('npm');
    let n = 1;
    if (!hasNpm) {
      steps.push({
        text: `${n++}. Installez Node.js (requis)`,
        note: 'Node.js n\'est pas détecté. Téléchargez l\'installer sur https://nodejs.org, installez-le, puis relancez la vérification.'
      });
    }
    steps.push({ text: `${n++}. Installez Vercel CLI`, command: 'npm install -g vercel' });
    steps.push({
      text: '   ℹ️ Si une erreur de permission apparaît',
      note: 'Essayez avec : sudo npm install -g vercel'
    });
    steps.push({ text: `${n++}. Connectez-vous à Vercel`, command: 'vercel login' });
    steps.push({ text: `${n++}. Revenez ici et cliquez "Vérifier"` });
    return { tool: 'Vercel CLI', steps, docsUrl: 'https://vercel.com/docs/cli' };
  }

  if (tool === 'git') {
    const steps = [];
    if (isMac) {
      steps.push({
        text: '1. Installez Git',
        note: 'Ouvrez le Terminal, tapez "git --version" et appuyez sur Entrée. macOS vous proposera d\'installer les outils de développement. Sinon, téléchargez-le sur https://git-scm.com/download/mac'
      });
    } else if (isWin) {
      steps.push({ text: '1. Installez Git', note: 'Téléchargez l\'installer sur https://git-scm.com/download/win' });
    } else if (isLinux) {
      steps.push({ text: '1. Installez Git', command: 'sudo apt install git    # Debian/Ubuntu\nsudo dnf install git    # Fedora' });
    } else {
      steps.push({ text: '1. Installez Git', note: 'Voir https://git-scm.com/downloads' });
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
