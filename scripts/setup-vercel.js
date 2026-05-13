#!/usr/bin/env node
/**
 * scripts/setup-vercel.js
 * Script CLI standalone pour déployer sur Vercel.
 * Usage: node scripts/setup-vercel.js <project-path>
 */

const path = require('path');
const { setupVercelOnly } = require('../lib/orchestrator');

const args = process.argv.slice(2);
const projectPath = args[0];

if (!projectPath) {
  console.error('Usage: node scripts/setup-vercel.js <project-path>');
  process.exit(1);
}

const resolvedPath = path.resolve(projectPath);

console.log(`Deploying to Vercel: ${resolvedPath}\n`);

setupVercelOnly(resolvedPath, (line) => process.stdout.write(line + (line.endsWith('\n') ? '' : '\n')))
  .then((result) => {
    if (result.success) {
      console.log(`\n✅ Deployed to: ${result.vercelUrl}`);
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
