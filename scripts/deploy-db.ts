/**
 * @fileoverview Database deployment script
 *
 * Reads all .sql files in the drizzle/ directory, replaces CREATE TABLE
 * with CREATE TABLE IF NOT EXISTS to make migrations idempotent, and then
 * runs wrangler d1 migrations apply DB --remote.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');
const MODIFIED_DIR = path.join(__dirname, '..', 'drizzle-modified');

function main() {
  console.log('🔍 Scanning drizzle directory for SQL files...');

  // Ensure the drizzle directory exists
  if (!fs.existsSync(DRIZZLE_DIR)) {
    console.error('❌ Error: drizzle directory not found');
    process.exit(1);
  }

  // Read all files in drizzle directory
  const files = fs.readdirSync(DRIZZLE_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));

  if (sqlFiles.length === 0) {
    console.log('✅ No SQL migration files found. Nothing to deploy.');
    return;
  }

  console.log(`📄 Found ${sqlFiles.length} SQL file(s):`);
  sqlFiles.forEach(f => console.log(`   - ${f}`));

  // Create a temporary modified directory
  if (fs.existsSync(MODIFIED_DIR)) {
    fs.rmSync(MODIFIED_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(MODIFIED_DIR, { recursive: true });

  // Copy meta directory if it exists
  const metaDir = path.join(DRIZZLE_DIR, 'meta');
  if (fs.existsSync(metaDir)) {
    const modifiedMetaDir = path.join(MODIFIED_DIR, 'meta');
    fs.mkdirSync(modifiedMetaDir, { recursive: true });
    const metaFiles = fs.readdirSync(metaDir);
    metaFiles.forEach(file => {
      fs.copyFileSync(
        path.join(metaDir, file),
        path.join(modifiedMetaDir, file)
      );
    });
  }

  console.log('\n🔧 Processing SQL files...');

  // Process each SQL file
  sqlFiles.forEach(file => {
    const filePath = path.join(DRIZZLE_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
    const modifiedContent = content.replace(
      /CREATE TABLE (`[^`]+`)/gi,
      'CREATE TABLE IF NOT EXISTS $1'
    );

    // Write modified file
    const modifiedFilePath = path.join(MODIFIED_DIR, file);
    fs.writeFileSync(modifiedFilePath, modifiedContent);

    console.log(`   ✓ ${file} (CREATE TABLE → CREATE TABLE IF NOT EXISTS)`);
  });

  console.log('\n🚀 Running wrangler d1 migrations apply...');

  try {
    // Temporarily move the original drizzle directory
    const backupDir = path.join(__dirname, '..', 'drizzle-backup');
    fs.renameSync(DRIZZLE_DIR, backupDir);

    // Move modified directory to drizzle
    fs.renameSync(MODIFIED_DIR, DRIZZLE_DIR);

    // Run wrangler command
    execSync('npx wrangler d1 migrations apply DB --remote', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    console.log('\n✅ Database migrations applied successfully!');

    // Restore original drizzle directory
    fs.rmSync(DRIZZLE_DIR, { recursive: true, force: true });
    fs.renameSync(backupDir, DRIZZLE_DIR);

  } catch (error) {
    console.error('\n❌ Error applying migrations:', error);

    // Attempt to restore original drizzle directory
    const backupDir = path.join(__dirname, '..', 'drizzle-backup');
    if (fs.existsSync(backupDir)) {
      if (fs.existsSync(DRIZZLE_DIR)) {
        fs.rmSync(DRIZZLE_DIR, { recursive: true, force: true });
      }
      fs.renameSync(backupDir, DRIZZLE_DIR);
    }

    // Clean up modified directory
    if (fs.existsSync(MODIFIED_DIR)) {
      fs.rmSync(MODIFIED_DIR, { recursive: true, force: true });
    }

    process.exit(1);
  }

  // Clean up any remaining modified directory
  if (fs.existsSync(MODIFIED_DIR)) {
    fs.rmSync(MODIFIED_DIR, { recursive: true, force: true });
  }
}

main();
