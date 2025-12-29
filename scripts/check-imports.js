#!/usr/bin/env node
/**
 * check-imports.js
 *
 * Validates that all ES module imports point to files that actually exist.
 * Run this after refactoring to catch broken import paths.
 *
 * Usage: node scripts/check-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Track errors
let totalFiles = 0;
let totalImports = 0;
let errorCount = 0;
const errors = [];

/**
 * Extract import paths from a file
 */
function extractImports(content) {
    const imports = [];

    // Remove JSDoc comments and multi-line comments first to avoid false positives
    const contentWithoutComments = content
        .replace(/\/\*\*[\s\S]*?\*\//g, '') // Remove JSDoc comments
        .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove multi-line comments
        .replace(/\/\/.*/g, '');             // Remove single-line comments

    // Match: import { ... } from 'path';
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(contentWithoutComments)) !== null) {
        imports.push(match[1]);
    }

    return imports;
}

/**
 * Resolve import path relative to the importing file
 */
function resolveImportPath(importPath, fromFile) {
    // Skip external packages (don't start with . or /)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        return null;
    }

    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);

    // Try with .js extension if not present
    if (!resolved.endsWith('.js')) {
        return resolved + '.js';
    }

    return resolved;
}

/**
 * Check all imports in a file
 */
function checkFileImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = extractImports(content);

    totalImports += imports.length;

    for (const importPath of imports) {
        const resolvedPath = resolveImportPath(importPath, filePath);

        // Skip external packages
        if (!resolvedPath) continue;

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            errorCount++;
            errors.push({
                file: path.relative(rootDir, filePath),
                import: importPath,
                resolved: path.relative(rootDir, resolvedPath)
            });
        }
    }
}

/**
 * Recursively find all .js files
 */
function findJsFiles(dir) {
    const files = [];

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        // Skip node_modules, dist, etc.
        if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.git') {
            continue;
        }

        if (item.isDirectory()) {
            files.push(...findJsFiles(fullPath));
        } else if (item.isFile() && item.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Main validation
 */
function validateImports() {
    console.log('🔍 Checking all import paths...\n');

    const srcDir = path.join(rootDir, 'src');
    const jsFiles = findJsFiles(srcDir);

    totalFiles = jsFiles.length;

    for (const file of jsFiles) {
        checkFileImports(file);
    }

    console.log(`📊 Checked ${totalFiles} files, ${totalImports} imports\n`);

    if (errorCount === 0) {
        console.log('✅ All imports resolve correctly!\n');
        process.exit(0);
    } else {
        console.error(`❌ Found ${errorCount} broken imports:\n`);

        for (const error of errors) {
            console.error(`  File: ${error.file}`);
            console.error(`  Import: ${error.import}`);
            console.error(`  Resolved to: ${error.resolved} (NOT FOUND)`);
            console.error('');
        }

        process.exit(1);
    }
}

validateImports();
