/**
 * github.js
 * Wrapper autour de GitHub CLI pour créer des repos et pousser le code initial.
 */

const { checkCommand, execPromise, execStream, slugifyRepoName, getInstallInstructions } = require('./setup-utils');
const fs = require('fs');
const path = require('path');

/**
 * Vérifie que gh est installé et que l'utilisateur est authentifié.
 * @returns {Promise<{installed: boolean, authenticated: boolean, user: string|null, error: string|null}>}
 */
async function checkStatus() {
  const installed = await checkCommand('gh');
  if (!installed) {
    const instructions = await getInstallInstructions('gh');
    return {
      installed: false,
      authenticated: false,
      user: null,
      error: 'GitHub CLI (gh) n\'est pas installé',
      instructions
    };
  }

  try {
    const { stdout } = await execPromise('gh auth status');
    // Extract username — gh output format varies by version and locale
    // Known formats: "Logged in to github.com as USERNAME" or "Logged in to github.com account USERNAME"
    const match = stdout.match(/Logged in to github\.com (?:as|account) (\S+)/);
    let user = match ? match[1] : null;

    // Fallback: ask GitHub API directly if regex failed
    if (!user) {
      try {
        const { stdout: apiOut } = await execPromise('gh api user -q .login');
        user = apiOut.trim() || null;
      } catch (apiErr) {
        // API fallback failed, keep user as null
      }
    }

    return { installed: true, authenticated: true, user, error: null, instructions: null };
  } catch (err) {
    const instructions = await getInstallInstructions('gh');
    return {
      installed: true,
      authenticated: false,
      user: null,
      error: err.stderr || err.message,
      instructions: {
        ...instructions,
        steps: [
          { text: '⚠️ GitHub CLI est installé mais vous n\'êtes pas connecté' },
          { text: '👉 Connectez-vous', command: 'gh auth login' },
          { text: 'Revenez ici et cliquez "Vérifier"' }
        ]
      }
    };
  }
}

/**
 * Crée un repo GitHub à partir d'un dossier local existant et pousse le code.
 * @param {string} projectPath — chemin absolu du projet local
 * @param {string} repoName — nom du repo (slugifié automatiquement)
 * @param {boolean} isPrivate — true par défaut
 * @param {function(string)} onLog — callback pour chaque ligne de log
 * @returns {Promise<{success: boolean, repoUrl: string|null, error: string|null}>}
 */
/**
 * Crée ou complète un .gitignore pour exclure les fichiers sensibles.
 * @param {string} projectPath
 * @param {function(string)} onLog
 */
function ensureGitignore(projectPath, onLog = () => {}) {
  const gitignorePath = path.join(projectPath, '.gitignore');

  const essentialRules = [
    '# --- OpenStrat: fichiers sensibles à ne JAMAIS publier ---',
    '.env',
    '.env.*',
    '.env.local',
    '.env.development',
    '.env.production',
    '',
    '# Dépendances',
    'node_modules/',
    'vendor/',
    '',
    '# Fichiers système',
    '.DS_Store',
    'Thumbs.db',
    '',
    '# Logs et caches',
    '*.log',
    'logs/',
    '.cache/',
    'dist/',
    'build/',
    '',
    '# Clés et certificats',
    '*.pem',
    '*.key',
    '*.crt',
    '*.p12',
    '',
    '# OpenStrat — ne pas inclure le dashboard dans le projet',
    'openstrat/',
    '',
    '# Configs locales IDE',
    '.idea/',
    '.vscode/',
    '*.swp',
    '*.swo'
  ];

  let existingContent = '';
  let needsUpdate = false;

  if (fs.existsSync(gitignorePath)) {
    existingContent = fs.readFileSync(gitignorePath, 'utf8');
    // Vérifie si les règles essentielles sont déjà présentes
    const hasEnvRule = existingContent.includes('.env');
    const hasNodeModules = existingContent.includes('node_modules');
    if (!hasEnvRule || !hasNodeModules) {
      needsUpdate = true;
    }
  } else {
    needsUpdate = true;
    onLog('🛡️  Creating .gitignore to protect sensitive files...');
  }

  if (needsUpdate) {
    const newContent = existingContent
      ? existingContent + '\n\n' + essentialRules.join('\n')
      : essentialRules.join('\n');
    fs.writeFileSync(gitignorePath, newContent + '\n', 'utf8');
    if (existingContent) {
      onLog('🛡️  Updated .gitignore with security rules');
    }
  }
}

async function createAndPushRepo(projectPath, repoName, isPrivate = true, onLog = () => {}) {
  const name = slugifyRepoName(repoName);
  const visibility = isPrivate ? '--private' : '--public';

  // Récupérer l'utilisateur authentifié
  const { user: ghUser } = await checkStatus();
  if (!ghUser) {
    return { success: false, repoUrl: null, error: 'Could not determine GitHub user. Run: gh auth login' };
  }

  onLog(`🔧 Creating GitHub repo: ${name} (${isPrivate ? 'private' : 'public'})...`);

  try {
    // 1. Créer le repo sur GitHub (sans push pour le moment, on veut gérer git manuellement)
    const { stdout: createOut } = await execPromise(
      `gh repo create ${name} ${visibility} --description "Side project generated with OpenStrat"`,
      { cwd: projectPath }
    );
    onLog(`✅ Repo created: ${createOut}`);

    // 2. Construire l'URL du repo
    const repoUrl = createOut.includes('https://') ? createOut.trim() : `https://github.com/${ghUser}/${name}`;

    // 3. Initialiser git localement si ce n'est pas déjà fait
    const hasGit = await execPromise('git rev-parse --git-dir', { cwd: projectPath }).then(() => true).catch(() => false);
    if (!hasGit) {
      onLog('📦 Initializing local git repository...');
      await execPromise('git init', { cwd: projectPath });
      await execPromise('git branch -M main', { cwd: projectPath });
    }

    // 3a. Configurer git user.name et user.email avec l'identité GitHub
    // Évite l'erreur Vercel : "commit email could not be matched to a GitHub account"
    try {
      const { stdout: ghEmail } = await execPromise('gh api user -q .email', { cwd: projectPath });
      const { stdout: ghName } = await execPromise('gh api user -q .name', { cwd: projectPath });
      const gitEmail = ghEmail.trim();
      const gitName = ghName.trim() || ghUser; // fallback sur le login si name vide
      if (gitEmail) {
        await execPromise(`git config user.email "${gitEmail}"`, { cwd: projectPath });
        await execPromise(`git config user.name "${gitName}"`, { cwd: projectPath });
        onLog(`🔧 Git configured with GitHub identity (${gitName} <${gitEmail}>)`);
      }
    } catch (gitConfigErr) {
      onLog('⚠️ Could not set git user config from GitHub API, using defaults');
    }

    // 3b. Protéger les fichiers sensibles avec .gitignore
    ensureGitignore(projectPath, onLog);

    // 4. Configurer le remote origin
    onLog('🔗 Setting up remote origin...');
    // D'abord retirer l'ancien remote s'il existe
    await execPromise('git remote remove origin', { cwd: projectPath }).catch(() => {});
    await execPromise(`git remote add origin https://github.com/${ghUser}/${name}.git`, { cwd: projectPath });

    // 5. Stage, commit et push
    onLog('📤 Staging files...');
    await execPromise('git add .', { cwd: projectPath });

    // Vérifier s'il y a des changements à committer
    const { stdout: statusOut } = await execPromise('git status --porcelain', { cwd: projectPath });
    if (statusOut.trim()) {
      onLog('💾 Committing files...');
      await execPromise('git commit -m "Initial commit from OpenStrat"', { cwd: projectPath });
    } else {
      onLog('ℹ️ No changes to commit');
    }

    onLog('🚀 Pushing to GitHub...');
    await execStream('git', ['push', '-u', 'origin', 'main'], { cwd: projectPath }, onLog);

    onLog(`✅ Successfully pushed to ${repoUrl}`);
    return { success: true, repoUrl, error: null };
  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    onLog(`❌ Error: ${msg}`);
    return { success: false, repoUrl: null, error: msg };
  }
}

/**
 * Récupère l'URL du repo GitHub pour un projet donné.
 * @param {string} projectPath
 * @returns {Promise<string|null>}
 */
async function getRepoUrl(projectPath) {
  try {
    const { stdout } = await execPromise('git remote get-url origin', { cwd: projectPath });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

module.exports = {
  checkStatus,
  createAndPushRepo,
  getRepoUrl
};
