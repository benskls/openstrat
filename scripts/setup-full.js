#!/usr/bin/env node
/**
 * scripts/setup-full.js
 * Script CLI standalone pour le workflow complet GitHub + Vercel.
 * Usage: node scripts/setup-full.js <project-path> [repo-name] [--public]
 */

const path = require('path');
const { fullSetup } = require('../lib/orchestrator');

const args = process.argv.slice(2);
const projectPath = args[0];
const isPublic = args.includes('--public');
const repoNameArg = args.find((_, i) => i > 0 && args[i - 1] !== '--public' && !args[i].startsWith('--'));

if (!projectPath) {
  console.error('Usage: node scripts/setup-full.js <project-path> [repo-name] [--public]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/setup-full.js ../mon-projet');
  console.error('  node scripts/setup-full.js ../mon-projet mon-repo --public');
  process.exit(1);
}

const resolvedPath = path.resolve(projectPath);
const repoName = repoNameArg || path.basename(resolvedPath);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  OpenStrat — Setup GitHub + Vercel                       ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`Project : ${resolvedPath}`);
console.log(`Repo    : ${repoName} (${isPublic ? 'public' : 'private'})\n`);

fullSetup(resolvedPath, {
  repoName,
  isPrivate: !isPublic,
  onLog: (line) => process.stdout.write(line + (line.endsWith('\n') ? '' : '\n'))
})
  .then((result) => {
    if (result.success) {
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║  ✅ Setup Complete!                                      ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`GitHub  : ${result.githubUrl}`);
      console.log(`Vercel  : ${result.vercelUrl}`);
      process.exit(0);
    } else {
      console.error('\n╔══════════════════════════════════════════════════════════╗');
      console.error('║  ❌ Setup Failed                                         ║');
      console.error('╚══════════════════════════════════════════════════════════╝');
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`\n💥 Unexpected error: ${err.message}`);
    process.exit(1);
  });
