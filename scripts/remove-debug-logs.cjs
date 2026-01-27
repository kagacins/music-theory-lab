/**
 * Script to safely remove console.log statements.
 * Handles both single-line and multi-line console.log statements.
 *
 * Usage: node scripts/remove-debug-logs.cjs <filepath> [--all] [--dry-run]
 *
 * Options:
 *   --all      Remove ALL console.log statements (not just [Module] pattern)
 *   --dry-run  Show what would be removed without making changes
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
const removeAll = process.argv.includes('--all');
const dryRun = process.argv.includes('--dry-run');

if (!filePath) {
    console.error('Usage: node scripts/remove-debug-logs.cjs <filepath> [--all] [--dry-run]');
    process.exit(1);
}

const fullPath = path.resolve(filePath);
if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
}

const content = fs.readFileSync(fullPath, 'utf8');
const lines = content.split('\n');

let removedCount = 0;
let inMultiLineLog = false;
let parenDepth = 0;
const linesToRemove = new Set();

// Pattern to match console.log statements
// If --all flag, match any console.log
// Otherwise only match console.log('[...
const pattern = removeAll
    ? /console\.log\s*\(/
    : /console\.log\s*\(\s*['"`]\[/;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inMultiLineLog) {
        // Count parens to find the end of the multi-line statement
        for (const char of line) {
            if (char === '(') parenDepth++;
            if (char === ')') parenDepth--;
        }

        linesToRemove.add(i);

        if (parenDepth === 0) {
            inMultiLineLog = false;
            removedCount++;
        }
    } else if (pattern.test(trimmed)) {
        // Found a console.log statement

        // Count opening and closing parens on this line
        parenDepth = 0;
        let inString = false;
        let stringChar = '';

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const prevChar = j > 0 ? line[j-1] : '';

            // Track string state (simplified - doesn't handle all escape sequences)
            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar && prevChar !== '\\') {
                inString = false;
            }

            if (!inString) {
                if (char === '(') parenDepth++;
                if (char === ')') parenDepth--;
            }
        }

        linesToRemove.add(i);

        if (parenDepth > 0) {
            // Multi-line console.log
            inMultiLineLog = true;
        } else {
            removedCount++;
        }
    }
}

// Build new content without the removed lines
const newLines = lines.filter((_, i) => !linesToRemove.has(i));
const newContent = newLines.join('\n');

if (dryRun) {
    console.log(`[DRY RUN] Would remove ${removedCount} console.log statements from ${filePath}`);
    if (linesToRemove.size > 0) {
        console.log(`[DRY RUN] Lines to remove: ${Array.from(linesToRemove).sort((a,b) => a-b).slice(0, 20).join(', ')}${linesToRemove.size > 20 ? '...' : ''}`);
    }
} else {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`Removed ${removedCount} console.log statements from ${filePath}`);
}
