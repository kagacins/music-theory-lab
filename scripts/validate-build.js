#!/usr/bin/env node
/**
 * validate-build.js
 *
 * Validates that all imports resolve correctly by attempting a build.
 * Run this after refactoring to catch import/path errors before committing.
 *
 * Usage: node scripts/validate-build.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function validateBuild() {
    console.log('🔍 Validating imports and build...\n');

    try {
        // Run vite build in check mode (doesn't output files)
        const { stdout, stderr } = await execAsync('npm run build 2>&1');

        // Check for build errors
        if (stderr && (stderr.includes('error') || stderr.includes('Failed to resolve'))) {
            console.error('❌ Build validation FAILED\n');
            console.error(stderr);
            process.exit(1);
        }

        if (stdout.includes('error') || stdout.includes('Failed to resolve')) {
            console.error('❌ Build validation FAILED\n');
            console.error(stdout);
            process.exit(1);
        }

        console.log('✅ Build validation PASSED - All imports resolve correctly\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Build validation FAILED\n');
        console.error(error.message);
        process.exit(1);
    }
}

validateBuild();
