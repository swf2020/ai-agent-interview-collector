#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_NAME = 'interview-collector';
const SOURCE_DIR = path.join(__dirname, '..');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const TARGET_DIR = path.join(SKILLS_DIR, SKILL_NAME);

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function install() {
  console.log(`Installing ${SKILL_NAME}...`);

  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  // Remove old installation if exists
  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  }

  // Copy skill files
  copyDirRecursive(SOURCE_DIR, TARGET_DIR);

  console.log(`Installed to ${TARGET_DIR}`);
  console.log('You can now use this skill in Claude Code.');
}

function uninstall() {
  console.log(`Uninstalling ${SKILL_NAME}...`);

  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    console.log(`Removed ${TARGET_DIR}`);
  } else {
    console.log('Not installed.');
  }
}

function update() {
  console.log(`Updating ${SKILL_NAME}...`);
  install();
}

const command = process.argv[2] || 'install';

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'update':
    update();
    break;
  default:
    console.log(`Usage: npx interview-collector [install|update|uninstall]`);
    break;
}
