/**
 * Admin FAB (Floating Action Button) Integration
 *
 * Adds an admin button to the FAB menu that only appears for admins.
 * Launches the admin dashboard modal when clicked.
 */

import { checkAdminStatus, clearAdminCache } from './adminService.js';
import { showAdminDashboard } from './adminDashboardModal.js';
import { onAuthStateChange } from '../community/authService.js';

let adminButtonElement = null;
let isAdmin = false;

/**
 * Initialize the admin FAB button
 * Checks admin status and adds button if user is admin
 */
export async function initAdminFab() {
    // Check admin status on init
    await updateAdminButton();

    // Re-check when auth state changes
    onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            clearAdminCache();
            isAdmin = false;
            removeAdminButton();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await updateAdminButton();
        }
    });
}

/**
 * Check admin status and show/hide button accordingly
 */
async function updateAdminButton() {
    try {
        const status = await checkAdminStatus();
        isAdmin = status.isAdmin;

        if (isAdmin) {
            addAdminButton();
        } else {
            removeAdminButton();
        }
    } catch (error) {
        console.error('[AdminFab] Error checking admin status:', error);
        removeAdminButton();
    }
}

/**
 * Add the admin button to the FAB menu
 */
function addAdminButton() {
    if (adminButtonElement) return; // Already exists

    // Find the FAB menu container (mobile-fab-menu is the expandable menu)
    const fabMenu = document.getElementById('mobile-fab-menu');
    if (!fabMenu) {
        console.warn('[AdminFab] FAB menu not found');
        return;
    }

    // Create admin button - match existing FAB category button style
    adminButtonElement = document.createElement('div');
    adminButtonElement.className = 'fab-category relative';
    adminButtonElement.innerHTML = `
        <button id="fab-admin-btn" class="fab-category-btn w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Admin Dashboard">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
        </button>
        <span class="fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Admin</span>
    `;

    // Add click handler to the button
    const btn = adminButtonElement.querySelector('button');
    if (btn) {
        btn.addEventListener('click', handleAdminClick);
    }

    // Insert at the beginning of the FAB menu (before other items)
    fabMenu.insertBefore(adminButtonElement, fabMenu.firstChild);

}

/**
 * Remove the admin button from the FAB menu
 */
function removeAdminButton() {
    if (adminButtonElement) {
        adminButtonElement.remove();
        adminButtonElement = null;
        console.log('[AdminFab] Admin button removed from FAB');
    }
}

/**
 * Handle admin button click
 */
function handleAdminClick() {
    // Close the FAB menu
    const fabMenu = document.getElementById('mobile-fab-menu');
    const fabButton = document.getElementById('mobile-fab-main');

    if (fabMenu) {
        fabMenu.classList.add('hidden');
    }
    if (fabButton) {
        fabButton.querySelector('svg')?.classList.remove('rotate-45');
    }

    // Show admin dashboard
    showAdminDashboard();
}

// Export functions for external use
export { showAdminDashboard };
window.showAdminDashboard = showAdminDashboard;
