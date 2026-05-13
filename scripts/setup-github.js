#!/usr/bin/env node
/**
 * scripts/setup-github.js
 * Script CLI standalone pour créer un repo GitHub et pousser le code.
 * Usage: node scripts/setup-github.js <project-path> [repo-name] [--public]
 */

const path = require('path');
const { setupGithubOnly } = require('../lib/orchestrator');

const args = process.argv.slice(2);
const projectPath = args[0];
const isPublic = args.includes('--public');
const repoNameArg = args.find((_, i) => i > 0 && args[i - 1] !== '--public' && !args[i].startsWith('--'));

if (!projectPath) {
  console.error('Usage: node scripts/setup-github.js <project-path> [repo-name] [--public]');
  process.exit(1);
}

const resolvedPath = path.resolve(projectPath);
const repoName = repoNameArg || path.basename(resolvedPath);

console.log(`Setting up GitHub repo for: ${resolvedPath}`);
console.log(`Repo name: ${repoName} (${isPublic ? 'public' : 'private'})\n`);

setupGithubOnly(resolvedPath, {
  repoName,
  isPrivate: !isPublic,
  onLog: (line) => process.stdout.write(line + (line.endsWith('\n') ? '' : '\n'))
})
  .then((result) => {
    if (result.success) {
      console.log(`\n✅ GitHub repo created: ${result.githubUrl}`);
      process.exit(0);
    } else {
      console.error(`\n❌ Failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`\n💥 Unexpected error: ${err.message}`);
    process.exit(1);
  });
