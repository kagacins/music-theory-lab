/**
 * Admin Dashboard Modal
 *
 * Main UI for admin moderation features.
 * Tabs: Overview, Submissions, Users, Audit Log
 */

import {
    getAdminStats,
    getSubmissions,
    updateSubmission,
    deleteSubmission,
    getUsers,
    blockUser,
    unblockUser,
    getFlags,
    updateFlag,
    deleteFlag,
    getAppSettings,
    updateAppSetting
} from './adminService.js';
import { showPromptModal, showConfirmModal, showAlertModal } from '../ui/modals.js';
import { toast } from '../ui/toastNotifications.js';
import { getAuthToken } from '../community/authService.js';

let modalElement = null;
let currentTab = 'overview';
let submissionsPage = 1;
let usersPage = 1;
let flagsPage = 1;
let submissionsData = null;
let usersData = null;
let flagsData = null;

/**
 * Show the admin dashboard modal
 */
export async function showAdminDashboard() {
    // Remove existing modal if any
    if (modalElement) {
        modalElement.remove();
    }

    // Create modal
    modalElement = document.createElement('div');
    modalElement.id = 'admin-dashboard-modal';
    // Use high z-index to appear above fullscreen tabs (z-[100]) and other modals
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4';

    modalElement.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <h2 class="text-xl font-bold">Admin Dashboard</h2>
                </div>
                <button id="admin-close-btn" class="p-1 hover:bg-white/20 rounded-lg transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-gray-300 bg-gray-100">
                <button data-tab="overview" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Overview
                </button>
                <button data-tab="submissions" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Submissions
                </button>
                <button data-tab="flags" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Flags
                </button>
                <button data-tab="comments" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Comments
                </button>
                <button data-tab="users" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Users
                </button>
                <button data-tab="audit" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Audit Log
                </button>
                <button data-tab="settings" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Settings
                </button>
            </div>

            <!-- Content -->
            <div id="admin-content" class="flex-1 overflow-y-auto p-6 bg-white min-h-[400px] relative">
                <div id="admin-loading-overlay" class="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    // Event listeners
    modalElement.querySelector('#admin-close-btn').addEventListener('click', closeAdminDashboard);
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) closeAdminDashboard();
    });

    // Tab switching
    modalElement.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            updateTabUI();
            loadTabContent();
        });
    });

    // ESC to close
    const escHandler = (e) => {
        if (e.key === 'Escape') closeAdminDashboard();
    };
    document.addEventListener('keydown', escHandler);
    modalElement._escHandler = escHandler;

    // Initialize
    updateTabUI();
    await loadTabContent();
}

/**
 * Close the admin dashboard
 */
export function closeAdminDashboard() {
    if (modalElement) {
        if (modalElement._escHandler) {
            document.removeEventListener('keydown', modalElement._escHandler);
        }
        modalElement.remove();
        modalElement = null;
    }
}

/**
 * Update tab UI to show active state
 */
function updateTabUI() {
    if (!modalElement) return;

    modalElement.querySelectorAll('.admin-tab').forEach(tab => {
        if (tab.dataset.tab === currentTab) {
            tab.classList.add('border-red-600');
            tab.classList.remove('border-transparent');
            tab.style.color = '#dc2626';
            tab.style.webkitTextFillColor = '#dc2626';
        } else {
            tab.classList.remove('border-red-600');
            tab.classList.add('border-transparent');
            tab.style.color = '#374151';
            tab.style.webkitTextFillColor = '#374151';
        }
    });
}

/**
 * Show/hide loading overlay
 */
function showLoadingOverlay(show = true) {
    let overlay = modalElement?.querySelector('#admin-loading-overlay');
    if (!overlay && show) {
        // Create overlay if it doesn't exist
        const content = modalElement?.querySelector('#admin-content');
        if (content) {
            overlay = document.createElement('div');
            overlay.id = 'admin-loading-overlay';
            overlay.className = 'absolute inset-0 bg-white/80 flex items-center justify-center z-10';
            overlay.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>';
            content.appendChild(overlay);
        }
    }
    if (overlay) {
        overlay.classList.toggle('hidden', !show);
    }
}

/**
 * Load content for current tab
 */
async function loadTabContent() {
    const content = modalElement?.querySelector('#admin-content');
    if (!content) return;

    // Show loading overlay instead of replacing content
    showLoadingOverlay(true);

    try {
        switch (currentTab) {
            case 'overview':
                await renderOverview(content);
                break;
            case 'submissions':
                await renderSubmissions(content);
                break;
            case 'flags':
                await renderFlags(content);
                break;
            case 'comments':
                await renderComments(content);
                break;
            case 'users':
                await renderUsers(content);
                break;
            case 'audit':
                await renderAuditLog(content);
                break;
            case 'settings':
                await renderSettings(content);
                break;
        }
        // Hide loading overlay after content loads
        showLoadingOverlay(false);
    } catch (error) {
        console.error('[AdminDashboard] Error loading tab:', error);
        showLoadingOverlay(false);
        content.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-500 mb-4">Error loading data: ${error.message}</p>
                <button onclick="window.loadAdminTab && window.loadAdminTab()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Retry
                </button>
            </div>
        `;
    }
}

// Expose for retry button
window.loadAdminTab = loadTabContent;

/**
 * Render Overview tab
 */
async function renderOverview(container) {
    const data = await getAdminStats();

    container.innerHTML = `
        <!-- Stats Cards - Compact Single Row -->
        <div class="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            <div class="bg-blue-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #2563eb; -webkit-text-fill-color: #2563eb;">Submissions</p>
                <p class="text-xl font-bold" style="color: #1d4ed8; -webkit-text-fill-color: #1d4ed8;">${data.stats?.totalSubmissions || 0}</p>
            </div>
            <div class="bg-indigo-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #4f46e5; -webkit-text-fill-color: #4f46e5;">Progressions</p>
                <p class="text-xl font-bold" style="color: #4338ca; -webkit-text-fill-color: #4338ca;">${data.stats?.totalProgressions || 0}</p>
            </div>
            <div class="bg-violet-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #7c3aed; -webkit-text-fill-color: #7c3aed;">Compositions</p>
                <p class="text-xl font-bold" style="color: #6d28d9; -webkit-text-fill-color: #6d28d9;">${data.stats?.totalCompositions || 0}</p>
            </div>
            <div class="bg-green-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #16a34a; -webkit-text-fill-color: #16a34a;">Users</p>
                <p class="text-xl font-bold" style="color: #15803d; -webkit-text-fill-color: #15803d;">${data.stats?.totalUsers || 0}</p>
            </div>
            <div class="bg-emerald-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #059669; -webkit-text-fill-color: #059669;">Published</p>
                <p class="text-xl font-bold" style="color: #047857; -webkit-text-fill-color: #047857;">${data.stats?.submissionsByStatus?.published || 0}</p>
            </div>
            <div class="bg-amber-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #d97706; -webkit-text-fill-color: #d97706;">Drafts</p>
                <p class="text-xl font-bold" style="color: #b45309; -webkit-text-fill-color: #b45309;">${data.stats?.submissionsByStatus?.draft || 0}</p>
            </div>
            <div class="bg-orange-50 rounded-lg p-2 text-center ${(data.stats?.pendingFlags || 0) > 0 ? 'ring-2 ring-orange-400 animate-pulse' : ''}">
                <p class="text-xs" style="color: #ea580c; -webkit-text-fill-color: #ea580c;">Flags</p>
                <p class="text-xl font-bold" style="color: #c2410c; -webkit-text-fill-color: #c2410c;">${data.stats?.pendingFlags || 0}</p>
            </div>
            <div class="bg-red-50 rounded-lg p-2 text-center">
                <p class="text-xs" style="color: #dc2626; -webkit-text-fill-color: #dc2626;">Blocked</p>
                <p class="text-xl font-bold" style="color: #b91c1c; -webkit-text-fill-color: #b91c1c;">${data.stats?.blockedUsers || 0}</p>
            </div>
        </div>

        <!-- Recent Submissions -->
        <div class="mb-8">
            <h3 class="text-lg font-semibold mb-4" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Recent Submissions</h3>
            <div class="bg-gray-50 rounded-lg overflow-hidden">
                ${(data.recentSubmissions || []).length === 0 ? `
                    <p class="p-4 text-center" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No submissions yet</p>
                ` : `
                    <table class="w-full">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Title</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Type</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Author</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Upvotes</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${data.recentSubmissions.map(s => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm" style="color: #111827; -webkit-text-fill-color: #111827;">${escapeHtml(s.title)}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 text-xs rounded-full ${s.type === 'chord-progression' ? 'bg-indigo-100' : 'bg-violet-100'}" style="color: ${s.type === 'chord-progression' ? '#4338ca' : '#6d28d9'}; -webkit-text-fill-color: ${s.type === 'chord-progression' ? '#4338ca' : '#6d28d9'};">
                                            ${s.type === 'chord-progression' ? 'Progression' : 'Composition'}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-sm" style="color: #374151; -webkit-text-fill-color: #374151;">${escapeHtml(s.author || 'Unknown')}</td>
                                    <td class="px-4 py-3 text-sm" style="color: #374151; -webkit-text-fill-color: #374151;">${s.upvotes || 0}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 text-xs rounded-full ${s.status === 'published' ? 'bg-green-100' : 'bg-gray-200'}" style="color: ${s.status === 'published' ? '#166534' : '#4b5563'}; -webkit-text-fill-color: ${s.status === 'published' ? '#166534' : '#4b5563'};">
                                            ${s.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>

        <!-- Recent Audit Log -->
        <div>
            <h3 class="text-lg font-semibold mb-4" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Recent Admin Actions</h3>
            <div class="bg-gray-50 rounded-lg overflow-hidden">
                ${(data.recentAuditLog || []).length === 0 ? `
                    <p class="p-4 text-center" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No admin actions recorded</p>
                ` : `
                    <div class="divide-y divide-gray-200 bg-white">
                        ${data.recentAuditLog.map(entry => `
                            <div class="px-4 py-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                                        ${formatActionType(entry.action)}
                                    </span>
                                    <span class="text-xs" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                        ${formatDate(entry.createdAt)}
                                    </span>
                                </div>
                                <p class="text-xs mt-1" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                    by ${entry.adminEmail || 'Unknown'} ${entry.reason ? `- ${entry.reason}` : ''}
                                </p>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

/**
 * Render Submissions tab
 */
// Track selected submissions for bulk actions
let selectedSubmissions = new Set();

async function renderSubmissions(container) {
    selectedSubmissions.clear();

    const searchHtml = `
        <div class="flex flex-wrap items-end gap-3 mb-4">
            <div class="flex-1 min-w-48">
                <label class="block text-xs font-medium mb-1" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">Search</label>
                <input type="text" id="admin-sub-search" placeholder="Search by title or description..."
                       class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">Type</label>
                <select id="admin-sub-type" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                    <option value="">All Types</option>
                    <option value="chord-progression">Progressions</option>
                    <option value="full-composition">Compositions</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">Status</label>
                <select id="admin-sub-status" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                    <option value="">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                </select>
            </div>
        </div>
        <!-- Bulk actions bar -->
        <div id="admin-bulk-actions" class="hidden flex items-center gap-4 mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="admin-select-all" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span class="text-sm font-medium" style="color: #4f46e5; -webkit-text-fill-color: #4f46e5;">Select All</span>
            </label>
            <span id="admin-selection-count" class="text-sm" style="color: #6366f1; -webkit-text-fill-color: #6366f1;">0 selected</span>
            <div class="flex-1"></div>
            <button id="admin-bulk-delete-btn" class="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Delete Selected
            </button>
        </div>
        <div id="admin-submissions-list"></div>
    `;

    container.innerHTML = searchHtml;

    // Load submissions
    await loadSubmissionsList();

    // Auto-filter helper with debounce for text input
    let searchDebounceTimer = null;
    const triggerFilter = () => {
        submissionsPage = 1;
        selectedSubmissions.clear();
        loadSubmissionsList();
    };

    // Text search with debounce (waits 300ms after typing stops)
    container.querySelector('#admin-sub-search').addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(triggerFilter, 300);
    });

    // Enter key for immediate search
    container.querySelector('#admin-sub-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchDebounceTimer);
            triggerFilter();
        }
    });

    // Dropdown changes trigger immediate filter
    container.querySelector('#admin-sub-type').addEventListener('change', triggerFilter);
    container.querySelector('#admin-sub-status').addEventListener('change', triggerFilter);

    // Select All checkbox
    container.querySelector('#admin-select-all')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = container.querySelectorAll('.admin-sub-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            const id = cb.dataset.id;
            if (isChecked) {
                selectedSubmissions.add(id);
            } else {
                selectedSubmissions.delete(id);
            }
        });
        updateBulkActionsUI();
    });

    // Bulk delete button
    container.querySelector('#admin-bulk-delete-btn')?.addEventListener('click', () => {
        showBulkDeleteConfirmation();
    });

    // Ensure standard keyboard shortcuts work in input fields
    container.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        });
    });
}

async function loadSubmissionsList() {
    const listContainer = modalElement?.querySelector('#admin-submissions-list');
    if (!listContainer) return;

    const search = modalElement.querySelector('#admin-sub-search')?.value || '';
    const type = modalElement.querySelector('#admin-sub-type')?.value || '';
    const status = modalElement.querySelector('#admin-sub-status')?.value || '';

    listContainer.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></div>';

    try {
        submissionsData = await getSubmissions({ search, type, status, page: submissionsPage, limit: 10 });

        // Show/hide bulk actions bar
        const bulkActionsBar = modalElement.querySelector('#admin-bulk-actions');
        if (bulkActionsBar) {
            bulkActionsBar.classList.toggle('hidden', !submissionsData.submissions?.length);
        }

        if (!submissionsData.submissions?.length) {
            listContainer.innerHTML = '<p class="text-center py-8" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No submissions found</p>';
            return;
        }

        listContainer.innerHTML = `
            <div class="space-y-4">
                ${submissionsData.submissions.map(s => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 ${selectedSubmissions.has(s.id) ? 'ring-2 ring-indigo-400' : ''}" data-submission-id="${s.id}">
                        <div class="flex items-start gap-3">
                            <!-- Checkbox -->
                            <label class="flex items-center pt-1 cursor-pointer">
                                <input type="checkbox" class="admin-sub-checkbox w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                       data-id="${s.id}" ${selectedSubmissions.has(s.id) ? 'checked' : ''}
                                       onchange="window.toggleSubmissionSelection('${s.id}', this.checked)">
                            </label>
                            <div class="flex-1">
                                <h4 class="font-medium" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">${escapeHtml(s.title)}</h4>
                                <p class="text-sm mt-1 line-clamp-2" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">${escapeHtml(s.description || 'No description')}</p>
                                <div class="flex items-center gap-3 mt-2 text-xs flex-wrap" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                    <span>By ${escapeHtml(s.author?.username ? `@${s.author.username}` : s.author?.displayName || 'Unknown')}</span>
                                    <span>Upvotes: <strong class="upvote-count">${s.upvoteCount || 0}</strong></span>
                                    <span class="px-2 py-0.5 rounded-full font-medium ${s.type === 'chord-progression' ? 'bg-indigo-500' : 'bg-violet-500'}" style="color: #ffffff; -webkit-text-fill-color: #ffffff;">${s.type === 'chord-progression' ? 'Progression' : 'Composition'}</span>
                                    <span class="px-2 py-0.5 rounded-full ${s.status === 'published' ? 'bg-green-100' : 'bg-gray-200'}" style="color: ${s.status === 'published' ? '#166534' : '#4b5563'}; -webkit-text-fill-color: ${s.status === 'published' ? '#166534' : '#4b5563'};">${s.status}</span>
                                </div>
                            </div>
                            <div class="flex gap-2 ml-4 shrink-0">
                                <button onclick="window.editSubmission('${s.id}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                                    Edit
                                </button>
                                <button onclick="window.deleteSubmissionConfirm('${s.id}')" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Pagination -->
            ${renderPagination(submissionsData.pagination, 'submissions')}
        `;

        // Update bulk actions UI based on current selections
        updateBulkActionsUI();
    } catch (error) {
        listContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error: ${error.message}</p>`;
    }
}

/**
 * Render Flags tab
 */
async function renderFlags(container) {
    const searchHtml = `
        <div class="flex gap-4 mb-6">
            <select id="admin-flag-status" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                <option value="">All Status</option>
                <option value="pending" selected>Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
            </select>
            <select id="admin-flag-reason" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                <option value="">All Reasons</option>
                <option value="spam">Spam</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="copyright">Copyright</option>
                <option value="low_quality">Low Quality</option>
                <option value="other">Other</option>
            </select>
            <button id="admin-flag-search-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Filter
            </button>
        </div>
        <div id="admin-flags-list"></div>
    `;

    container.innerHTML = searchHtml;

    // Load flags
    await loadFlagsList();

    // Event listeners
    container.querySelector('#admin-flag-search-btn').addEventListener('click', () => {
        flagsPage = 1;
        loadFlagsList();
    });
}

/**
 * Load flags list with current filters
 */
async function loadFlagsList() {
    const listContainer = document.getElementById('admin-flags-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
    `;

    try {
        const status = document.getElementById('admin-flag-status')?.value || 'pending';
        const reason = document.getElementById('admin-flag-reason')?.value || '';

        flagsData = await getFlags({
            status: status || undefined,
            reason: reason || undefined,
            page: flagsPage,
            limit: 20
        });

        if (!flagsData.flags || flagsData.flags.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-gray-500" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No flags found</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="space-y-4">
                ${flagsData.flags.map(f => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200" data-flag-id="${f.id}">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <!-- Flag header -->
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="px-2 py-0.5 text-xs rounded-full font-medium ${getReasonBadgeClass(f.reason)}">
                                        ${formatReason(f.reason)}
                                    </span>
                                    <span class="px-2 py-0.5 text-xs rounded-full font-medium ${getStatusBadgeClass(f.status)}">
                                        ${f.status}
                                    </span>
                                    <span class="text-xs text-gray-500" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                        ${formatDate(f.createdAt)}
                                    </span>
                                </div>

                                <!-- Submission info -->
                                <div class="mb-2">
                                    <p class="font-medium" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                                        Submission: ${escapeHtml(f.submission?.title || 'Unknown')}
                                    </p>
                                    <p class="text-sm text-gray-600" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">
                                        by ${f.submission?.author?.displayName || f.submission?.author?.username || 'Anonymous'}
                                    </p>
                                </div>

                                <!-- Reporter info -->
                                <p class="text-sm text-gray-500 mb-2" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                    Reported by: ${f.reporter?.displayName || f.reporter?.username || 'Anonymous'}
                                </p>

                                <!-- Description if provided -->
                                ${f.description ? `
                                    <p class="text-sm text-gray-600 bg-gray-100 p-2 rounded" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">
                                        "${escapeHtml(f.description)}"
                                    </p>
                                ` : ''}

                                <!-- Resolution notes if any -->
                                ${f.resolutionNotes ? `
                                    <p class="text-sm text-green-600 mt-2" style="color: #059669; -webkit-text-fill-color: #059669;">
                                        Resolution: ${escapeHtml(f.resolutionNotes)}
                                    </p>
                                ` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex flex-col gap-2 shrink-0">
                                ${f.status === 'pending' ? `
                                    <button onclick="window.resolveFlagWithAction('${f.id}', 'delete')"
                                            class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                                        Delete Submission
                                    </button>
                                    <button onclick="window.resolveFlagWithAction('${f.id}', 'dismiss')"
                                            class="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">
                                        Dismiss Flag
                                    </button>
                                ` : ''}
                                <button onclick="window.viewFlagSubmission('${f.submission?.id}')"
                                        class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                                    View Submission
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Pagination -->
            ${renderPagination(flagsData.pagination, 'flags')}
        `;
    } catch (error) {
        listContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error: ${error.message}</p>`;
    }
}

/**
 * Get CSS class for reason badge
 */
function getReasonBadgeClass(reason) {
    const classes = {
        'spam': 'bg-yellow-100 text-yellow-800',
        'inappropriate': 'bg-red-100 text-red-800',
        'copyright': 'bg-purple-100 text-purple-800',
        'low_quality': 'bg-gray-100 text-gray-800',
        'other': 'bg-blue-100 text-blue-800'
    };
    return classes[reason] || 'bg-gray-100 text-gray-800';
}

/**
 * Get CSS class for status badge
 */
function getStatusBadgeClass(status) {
    const classes = {
        'pending': 'bg-orange-100 text-orange-800',
        'reviewed': 'bg-blue-100 text-blue-800',
        'resolved': 'bg-green-100 text-green-800',
        'dismissed': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Format reason for display
 */
function formatReason(reason) {
    const labels = {
        'spam': 'Spam',
        'inappropriate': 'Inappropriate',
        'copyright': 'Copyright',
        'low_quality': 'Low Quality',
        'other': 'Other'
    };
    return labels[reason] || reason;
}

/**
 * Resolve a flag with an action
 */
window.resolveFlagWithAction = async (flagId, action) => {
    const actionLabel = action === 'delete' ? 'delete the submission' : 'dismiss this flag';
    if (!confirm(`Are you sure you want to ${actionLabel}?`)) return;

    try {
        if (action === 'delete') {
            // Get the flag to find the submission ID
            const flag = flagsData?.flags?.find(f => f.id === flagId);
            if (flag?.submission?.id) {
                // Delete the submission first
                await deleteSubmission(flag.submission.id, 'Deleted due to flag report');
            }
            // Mark flag as resolved
            await updateFlag(flagId, 'resolved', 'Submission deleted');
        } else {
            // Just dismiss the flag
            await updateFlag(flagId, 'dismissed', 'Flag dismissed by admin');
        }

        // Reload the list
        await loadFlagsList();
    } catch (error) {
        toast.error('Error: ' + error.message);
    }
};

/**
 * View a flagged submission (opens detail modal on top of admin dashboard)
 */
window.viewFlagSubmission = async (submissionId) => {
    if (!submissionId) {
        toast.error('Submission not found');
        return;
    }
    // Keep admin dashboard open - the submission modal appears on top of admin dashboard
    if (window.viewCommunitySubmission) {
        window.viewCommunitySubmission(submissionId);
    }
};

// Comments moderation state
let commentsData = null;
let commentsPage = 1;

/**
 * Render Comments moderation tab
 */
async function renderComments(container) {
    const searchHtml = `
        <div class="flex gap-4 mb-6">
            <input type="text" id="admin-comment-search" placeholder="Search comments..."
                   class="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
            <label class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg">
                <input type="checkbox" id="admin-comment-include-deleted" class="rounded">
                <span class="text-sm" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Show deleted</span>
            </label>
            <button id="admin-comment-search-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Search
            </button>
        </div>
        <div id="admin-comments-list"></div>
    `;

    container.innerHTML = searchHtml;

    // Load comments
    await loadCommentsList();

    // Event listeners
    container.querySelector('#admin-comment-search-btn').addEventListener('click', () => {
        commentsPage = 1;
        loadCommentsList();
    });
    container.querySelector('#admin-comment-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            commentsPage = 1;
            loadCommentsList();
        }
    });
}

/**
 * Load comments list for admin
 */
async function loadCommentsList() {
    const listContainer = document.getElementById('admin-comments-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
    `;

    try {
        const search = document.getElementById('admin-comment-search')?.value || '';
        const includeDeleted = document.getElementById('admin-comment-include-deleted')?.checked || false;

        const token = await getAuthToken();
        const params = new URLSearchParams({
            page: commentsPage.toString(),
            limit: '20',
            includeDeleted: includeDeleted.toString()
        });
        if (search) params.set('search', search);

        const response = await fetch(`/.netlify/functions/admin-comments?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load comments');
        }

        commentsData = result;

        if (!commentsData.comments || commentsData.comments.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <p class="text-gray-500" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No comments found</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="space-y-3">
                ${commentsData.comments.map(c => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 ${c.isDeleted ? 'opacity-50 border-l-4 border-l-red-400' : ''}" data-comment-id="${c.id}">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <!-- Comment header -->
                                <div class="flex items-center gap-2 mb-2 flex-wrap">
                                    ${c.author?.avatarUrl
                                        ? `<img src="${c.author.avatarUrl}" class="w-6 h-6 rounded-full" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-6 h-6 rounded-full bg-gray-300 items-center justify-center text-xs font-bold" style="display:none; color: #4b5563; -webkit-text-fill-color: #4b5563;">${(c.author?.displayName || '?').charAt(0).toUpperCase()}</div>`
                                        : `<div class="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">${(c.author?.displayName || '?').charAt(0).toUpperCase()}</div>`
                                    }
                                    <span class="font-medium text-sm" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                                        ${escapeHtml(c.author?.displayName || 'Unknown')}
                                    </span>
                                    <span class="text-xs text-gray-500" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                        ${formatDate(c.createdAt)}
                                    </span>
                                    ${c.isEdited ? '<span class="text-xs text-gray-400">(edited)</span>' : ''}
                                    ${c.isDeleted ? '<span class="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">Deleted</span>' : ''}
                                    ${c.parentId ? '<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Reply</span>' : ''}
                                </div>

                                <!-- Comment content -->
                                <p class="text-sm mb-2" style="color: #374151; -webkit-text-fill-color: #374151;">
                                    ${escapeHtml(c.content)}
                                </p>

                                <!-- Submission link -->
                                ${c.submission ? `
                                    <p class="text-xs text-gray-500" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                        On: <a href="#" onclick="window.viewAdminSubmission && window.viewAdminSubmission('${c.submission.id}'); return false;" class="text-indigo-500 hover:underline">${escapeHtml(c.submission.title)}</a>
                                    </p>
                                ` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-2 shrink-0">
                                ${!c.isDeleted ? `
                                    <button onclick="window.deleteAdminComment('${c.id}')"
                                            class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                                        Delete
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Pagination -->
            ${renderCommentsPagination(commentsData.pagination)}
        `;
    } catch (error) {
        console.error('[AdminComments] Error:', error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error: ${error.message}</p>`;
    }
}

/**
 * Render pagination for comments
 */
function renderCommentsPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) return '';

    return `
        <div class="flex items-center justify-center gap-4 mt-6">
            <button onclick="window.prevCommentsPage()"
                    class="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                    ${pagination.page <= 1 ? 'disabled' : ''}>
                Previous
            </button>
            <span class="text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                Page ${pagination.page} of ${pagination.totalPages}
            </span>
            <button onclick="window.nextCommentsPage()"
                    class="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                    ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>
                Next
            </button>
        </div>
    `;
}

// Window functions for comments moderation
window.deleteAdminComment = async (commentId) => {
    if (!confirm('Permanently delete this comment?')) return;

    try {
        const token = await getAuthToken();
        const response = await fetch(`/.netlify/functions/admin-comments?commentId=${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to delete comment');
        }

        toast.success('Comment deleted');
        loadCommentsList();
    } catch (error) {
        toast.error(error.message || 'Failed to delete comment');
    }
};

window.prevCommentsPage = () => {
    if (commentsPage > 1) {
        commentsPage--;
        loadCommentsList();
    }
};

window.nextCommentsPage = () => {
    if (commentsData?.pagination?.totalPages && commentsPage < commentsData.pagination.totalPages) {
        commentsPage++;
        loadCommentsList();
    }
};

/**
 * Render Users tab
 */
async function renderUsers(container) {
    const searchHtml = `
        <div class="flex gap-4 mb-6">
            <input type="text" id="admin-user-search" placeholder="Search users..."
                   class="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
            <select id="admin-user-blocked" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                <option value="">All Users</option>
                <option value="true">Blocked Only</option>
                <option value="false">Not Blocked</option>
            </select>
            <button id="admin-user-search-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Search
            </button>
        </div>
        <div id="admin-users-list"></div>
    `;

    container.innerHTML = searchHtml;

    // Load users
    await loadUsersList();

    // Event listeners
    container.querySelector('#admin-user-search-btn').addEventListener('click', () => {
        usersPage = 1;
        loadUsersList();
    });
    container.querySelector('#admin-user-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            usersPage = 1;
            loadUsersList();
        }
    });

    // Ensure standard keyboard shortcuts work in input fields
    container.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        });
    });
}

async function loadUsersList() {
    const listContainer = modalElement?.querySelector('#admin-users-list');
    if (!listContainer) return;

    const search = modalElement.querySelector('#admin-user-search')?.value || '';
    const blocked = modalElement.querySelector('#admin-user-blocked')?.value || '';

    listContainer.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></div>';

    try {
        usersData = await getUsers({
            search,
            blocked: blocked || undefined,
            page: usersPage,
            limit: 10
        });

        if (!usersData.users?.length) {
            listContainer.innerHTML = '<p class="text-center py-8" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No users found</p>';
            return;
        }

        listContainer.innerHTML = `
            <div class="space-y-4">
                ${usersData.users.map(u => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 ${u.isBlocked ? 'border-l-4 border-l-red-500' : ''}" data-user-id="${u.id}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                ${u.avatarUrl
                                    ? `<img src="${u.avatarUrl}" class="w-10 h-10 rounded-full" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-10 h-10 rounded-full bg-gray-300 items-center justify-center font-bold" style="display:none; color: #4b5563; -webkit-text-fill-color: #4b5563;">${(u.displayName || u.username || '?').charAt(0).toUpperCase()}</div>`
                                    : `<div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">${(u.displayName || u.username || '?').charAt(0).toUpperCase()}</div>`
                                }
                                <div>
                                    <h4 class="font-medium" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                                        ${escapeHtml(u.username ? `@${u.username}` : u.displayName || 'No name')}
                                        ${u.isAdmin ? '<span class="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Admin</span>' : ''}
                                        ${u.isBlocked ? '<span class="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">Blocked</span>' : ''}
                                    </h4>
                                    <p class="text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">${u.submissionCount || 0} submissions</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-right text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                    <p>Joined ${formatDate(u.createdAt)}</p>
                                </div>
                                ${u.isAdmin ? `
                                    <button disabled
                                            class="px-3 py-1 text-sm bg-gray-300 text-gray-500 rounded cursor-not-allowed"
                                            title="Cannot block admin users">
                                        Block
                                    </button>
                                ` : `
                                    <button onclick="window.toggleUserBlock('${u.id}', ${u.isBlocked})"
                                            class="px-3 py-1 text-sm ${u.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded">
                                        ${u.isBlocked ? 'Unblock' : 'Block'}
                                    </button>
                                `}
                            </div>
                        </div>
                        ${u.isBlocked && u.blockInfo ? `
                            <div class="mt-3 p-2 bg-red-50 rounded text-sm" style="color: #b91c1c; -webkit-text-fill-color: #b91c1c;">
                                <strong>Blocked:</strong> ${escapeHtml(u.blockInfo.reason || 'No reason')}
                                <span class="text-xs ml-2">(${formatDate(u.blockInfo.blockedAt)})</span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>

            <!-- Pagination -->
            ${renderPagination(usersData.pagination, 'users')}
        `;
    } catch (error) {
        listContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error: ${error.message}</p>`;
    }
}

/**
 * Render Audit Log tab
 */
async function renderAuditLog(container) {
    try {
        const data = await getAdminStats();
        const auditLog = data.recentAuditLog || [];

        container.innerHTML = `
            <h3 class="text-lg font-semibold mb-4" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Admin Action History</h3>
            ${auditLog.length === 0 ? `
                <p class="text-center py-8" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No admin actions recorded yet</p>
            ` : `
                <div class="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <table class="w-full">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Action</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Target</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Admin</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Reason</th>
                                <th class="px-4 py-2 text-left text-xs font-medium uppercase" style="color: #374151; -webkit-text-fill-color: #374151;">Date</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${auditLog.map(entry => {
                                const actionStyle = getActionColor(entry.action);
                                return `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${actionStyle.bgClass}" style="color: ${actionStyle.textColor}; -webkit-text-fill-color: ${actionStyle.textColor};">
                                            ${formatActionType(entry.action)}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-sm" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">
                                        ${entry.targetType} ${entry.targetId ? `(${entry.targetId.substring(0, 8)}...)` : ''}
                                    </td>
                                    <td class="px-4 py-3 text-sm" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">${escapeHtml(entry.adminEmail || 'Unknown')}</td>
                                    <td class="px-4 py-3 text-sm max-w-xs truncate" style="color: #4b5563; -webkit-text-fill-color: #4b5563;">${escapeHtml(entry.reason || '-')}</td>
                                    <td class="px-4 py-3 text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">${formatDate(entry.createdAt)}</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error loading audit log: ${error.message}</p>`;
    }
}

/**
 * Render Settings tab
 */
async function renderSettings(container) {
    try {
        let data;
        let settings = {};

        try {
            data = await getAppSettings();
            settings = data.settings || {};
        } catch (fetchError) {
            // Table might not exist yet - show setup instructions
            if (fetchError.message.includes('app_settings') || fetchError.message.includes('schema cache')) {
                container.innerHTML = `
                    <h3 class="text-lg font-semibold mb-6" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Application Settings</h3>

                    <div class="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
                        <div class="flex items-start gap-3">
                            <svg class="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <div>
                                <h4 class="font-semibold mb-2" style="color: #92400e; -webkit-text-fill-color: #92400e;">Database Setup Required</h4>
                                <p class="text-sm mb-3" style="color: #a16207; -webkit-text-fill-color: #a16207;">
                                    The <code class="bg-amber-100 px-1 rounded">app_settings</code> table needs to be created in your Supabase database.
                                </p>
                                <p class="text-sm mb-2" style="color: #a16207; -webkit-text-fill-color: #a16207;">
                                    Run the migration script located at:
                                </p>
                                <code class="block bg-amber-100 px-3 py-2 rounded text-xs mb-3" style="color: #92400e; -webkit-text-fill-color: #92400e;">
                                    docs/migrations/003_add_app_settings_table.sql
                                </code>
                                <p class="text-xs" style="color: #b45309; -webkit-text-fill-color: #b45309;">
                                    Go to your Supabase dashboard → SQL Editor → paste the migration script and run it.
                                </p>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }
            throw fetchError;
        }

        // Get progression chord limit setting
        const chordLimitSetting = settings.progression_chord_limit?.value || { limit: null, enabled: false };
        const isEnabled = chordLimitSetting.enabled;
        const limitValue = chordLimitSetting.limit;

        container.innerHTML = `
            <h3 class="text-lg font-semibold mb-6" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Application Settings</h3>

            <!-- Submission Settings Section -->
            <div class="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
                <h4 class="text-md font-semibold mb-4 flex items-center gap-2" style="color: #374151; -webkit-text-fill-color: #374151;">
                    <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    Submission Settings
                </h4>

                <!-- Chord Progression Limit -->
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h5 class="font-medium mb-1" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">Chord Progression Limit</h5>
                            <p class="text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                Set a maximum number of chords allowed in chord progression submissions.
                                This does not affect full compositions or existing submissions.
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 mb-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="chord-limit-enabled"
                                   ${isEnabled ? 'checked' : ''}
                                   onchange="window.toggleChordLimitEnabled(this.checked)"
                                   class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                            <span class="text-sm font-medium" style="color: #374151; -webkit-text-fill-color: #374151;">Enable chord limit</span>
                        </label>
                    </div>

                    <div id="chord-limit-controls" class="${isEnabled ? '' : 'opacity-50 pointer-events-none'}">
                        <div class="flex items-center gap-3">
                            <label class="text-sm" style="color: #374151; -webkit-text-fill-color: #374151;">Maximum chords:</label>
                            <input type="number" id="chord-limit-value"
                                   value="${limitValue || ''}"
                                   placeholder="e.g., 16"
                                   min="1" max="100"
                                   class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                   style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                            <button onclick="window.saveChordLimit()"
                                    class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors">
                                Save
                            </button>
                            <button onclick="window.clearChordLimit()"
                                    class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                                No Limit
                            </button>
                        </div>
                        <p class="text-xs mt-2" style="color: #9ca3af; -webkit-text-fill-color: #9ca3af;">
                            ${limitValue ? `Current limit: ${limitValue} chords` : 'No limit set (unlimited chords allowed)'}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Future Settings Sections can go here -->
            <div class="text-center py-4">
                <p class="text-sm" style="color: #9ca3af; -webkit-text-fill-color: #9ca3af;">
                    More settings coming soon...
                </p>
            </div>
        `;

    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error loading settings: ${error.message}</p>`;
    }
}

/**
 * Toggle chord limit enabled state
 */
window.toggleChordLimitEnabled = async (enabled) => {
    const controls = document.getElementById('chord-limit-controls');
    if (controls) {
        controls.classList.toggle('opacity-50', !enabled);
        controls.classList.toggle('pointer-events-none', !enabled);
    }

    // If disabling, save immediately with enabled: false
    if (!enabled) {
        try {
            const valueInput = document.getElementById('chord-limit-value');
            const currentLimit = valueInput?.value ? parseInt(valueInput.value, 10) : null;
            await updateAppSetting('progression_chord_limit', {
                limit: currentLimit,
                enabled: false
            });
            showToast('Chord limit disabled', 'success');
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    }
};

/**
 * Save chord limit value
 */
window.saveChordLimit = async () => {
    const enabledCb = document.getElementById('chord-limit-enabled');
    const valueInput = document.getElementById('chord-limit-value');
    const value = valueInput?.value ? parseInt(valueInput.value, 10) : null;

    if (!value || value < 1 || value > 100) {
        showToast('Please enter a valid limit between 1 and 100', 'error');
        return;
    }

    try {
        await updateAppSetting('progression_chord_limit', {
            limit: value,
            enabled: enabledCb?.checked ?? true
        });
        showToast(`Chord limit set to ${value}`, 'success');
        // Reload to update the display
        loadTabContent();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

/**
 * Clear chord limit (set to no limit)
 */
window.clearChordLimit = async () => {
    const enabledCb = document.getElementById('chord-limit-enabled');

    try {
        await updateAppSetting('progression_chord_limit', {
            limit: null,
            enabled: enabledCb?.checked ?? false
        });
        showToast('Chord limit removed (no limit)', 'success');
        // Reload to update the display
        loadTabContent();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function renderPagination(pagination, type) {
    if (!pagination || pagination.totalPages <= 1) return '';

    return `
        <div class="flex items-center justify-between mt-6">
            <p class="text-sm" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)
            </p>
            <div class="flex gap-2">
                <button onclick="window.adminPageChange('${type}', ${pagination.page - 1})"
                        ${pagination.page <= 1 ? 'disabled' : ''}
                        class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    Previous
                </button>
                <button onclick="window.adminPageChange('${type}', ${pagination.page + 1})"
                        ${pagination.page >= pagination.totalPages ? 'disabled' : ''}
                        class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatActionType(action) {
    const labels = {
        'update_submission': 'Updated Submission',
        'delete_submission': 'Deleted Submission',
        'block_user': 'Blocked User',
        'unblock_user': 'Unblocked User'
    };
    return labels[action] || action;
}

function getActionColor(action) {
    // Return object with background class and inline color style for proper contrast
    if (action.includes('delete')) {
        return {
            bgClass: 'bg-red-600',
            textColor: '#ffffff'
        };
    }
    if (action.includes('block') && !action.includes('unblock')) {
        return {
            bgClass: 'bg-orange-600',
            textColor: '#ffffff'
        };
    }
    if (action.includes('unblock')) {
        return {
            bgClass: 'bg-green-600',
            textColor: '#ffffff'
        };
    }
    if (action.includes('update')) {
        return {
            bgClass: 'bg-blue-600',
            textColor: '#ffffff'
        };
    }
    if (action.includes('review') || action.includes('flag')) {
        return {
            bgClass: 'bg-purple-600',
            textColor: '#ffffff'
        };
    }
    return {
        bgClass: 'bg-gray-600',
        textColor: '#ffffff'
    };
}

// ==========================================
// BULK ACTIONS HELPERS
// ==========================================

/**
 * Update the bulk actions UI based on current selections
 */
function updateBulkActionsUI() {
    const countEl = modalElement?.querySelector('#admin-selection-count');
    const deleteBtn = modalElement?.querySelector('#admin-bulk-delete-btn');
    const selectAllCb = modalElement?.querySelector('#admin-select-all');

    if (countEl) {
        countEl.textContent = `${selectedSubmissions.size} selected`;
    }
    if (deleteBtn) {
        deleteBtn.disabled = selectedSubmissions.size === 0;
    }

    // Update Select All checkbox state
    if (selectAllCb && submissionsData?.submissions) {
        const allChecked = submissionsData.submissions.every(s => selectedSubmissions.has(s.id));
        const someChecked = submissionsData.submissions.some(s => selectedSubmissions.has(s.id));
        selectAllCb.checked = allChecked;
        selectAllCb.indeterminate = someChecked && !allChecked;
    }
}

/**
 * Show bulk delete confirmation modal
 */
function showBulkDeleteConfirmation() {
    if (selectedSubmissions.size === 0) return;

    const confirmModal = document.createElement('div');
    confirmModal.id = 'bulk-delete-modal';
    // Use higher z-index than admin dashboard (z-[10000])
    confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center p-4';
    confirmModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    Confirm Bulk Delete
                </h3>
            </div>
            <div class="p-6">
                <p class="mb-4" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Are you sure you want to delete <strong>${selectedSubmissions.size}</strong> submission${selectedSubmissions.size === 1 ? '' : 's'}?
                </p>
                <p class="text-sm mb-4" style="color: #dc2626; -webkit-text-fill-color: #dc2626;">
                    This action cannot be undone.
                </p>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-1" style="color: #374151; -webkit-text-fill-color: #374151;">Reason for deletion (optional)</label>
                    <input type="text" id="bulk-delete-reason" placeholder="e.g., Spam cleanup, policy violation..."
                           class="w-full px-4 py-2 border border-gray-300 rounded-lg" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button id="bulk-delete-cancel" class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                    Cancel
                </button>
                <button id="bulk-delete-confirm" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Delete ${selectedSubmissions.size} Submission${selectedSubmissions.size === 1 ? '' : 's'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);

    // Event listeners
    confirmModal.querySelector('#bulk-delete-cancel').addEventListener('click', () => {
        confirmModal.remove();
    });
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.remove();
    });

    confirmModal.querySelector('#bulk-delete-confirm').addEventListener('click', async () => {
        const reason = confirmModal.querySelector('#bulk-delete-reason')?.value || 'Bulk deletion by admin';
        const confirmBtn = confirmModal.querySelector('#bulk-delete-confirm');

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin inline mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Deleting...
        `;

        try {
            // Delete submissions one by one
            const ids = Array.from(selectedSubmissions);
            let deleted = 0;
            let failed = 0;

            for (const id of ids) {
                try {
                    await deleteSubmission(id, reason);
                    deleted++;
                } catch (e) {
                    console.error(`Failed to delete ${id}:`, e);
                    failed++;
                }
            }

            // Clear selections and reload
            selectedSubmissions.clear();
            confirmModal.remove();

            // Show result
            if (deleted > 0 && failed === 0) {
                toast.success(`Deleted ${deleted} submission(s).`);
            } else if (failed > 0) {
                toast.warning(`Deleted ${deleted} submission(s). Failed to delete ${failed}.`);
            }

            // Reload list
            await loadSubmissionsList();

        } catch (error) {
            console.error('[BulkDelete] Error:', error);
            toast.error('Error during bulk delete: ' + error.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
        }
    });
}

// ==========================================
// WINDOW EXPOSED FUNCTIONS
// ==========================================

/**
 * Toggle a single submission's selection state
 */
window.toggleSubmissionSelection = (id, isChecked) => {
    if (isChecked) {
        selectedSubmissions.add(id);
    } else {
        selectedSubmissions.delete(id);
    }
    updateBulkActionsUI();

    // Update card visual
    const card = modalElement?.querySelector(`[data-submission-id="${id}"]`);
    if (card) {
        card.classList.toggle('ring-2', isChecked);
        card.classList.toggle('ring-indigo-400', isChecked);
    }
};

window.adminPageChange = (type, page) => {
    if (type === 'submissions') {
        submissionsPage = page;
        loadSubmissionsList();
    } else if (type === 'users') {
        usersPage = page;
        loadUsersList();
    } else if (type === 'flags') {
        flagsPage = page;
        loadFlagsList();
    }
};

window.editSubmission = async (id) => {
    const submission = submissionsData?.submissions?.find(s => s.id === id);
    if (!submission) return;

    // Create edit modal
    const editModal = document.createElement('div');
    editModal.id = 'admin-edit-modal';
    // Use higher z-index than admin dashboard (z-[10000])
    editModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center p-4';
    editModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-xl">
                <h3 class="text-lg font-bold text-white">Edit Submission</h3>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: #374151; -webkit-text-fill-color: #374151;">Title</label>
                    <input type="text" id="edit-title" value="${escapeHtml(submission.title)}"
                           class="w-full px-4 py-2 border border-gray-300 rounded-lg" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: #374151; -webkit-text-fill-color: #374151;">Description</label>
                    <textarea id="edit-description" rows="4"
                              class="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">${escapeHtml(submission.description || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: #374151; -webkit-text-fill-color: #374151;">Reason for edit (optional)</label>
                    <input type="text" id="edit-reason" placeholder="e.g., Fixed typo, updated description..."
                           class="w-full px-4 py-2 border border-gray-300 rounded-lg" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button id="edit-cancel" class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                    Cancel
                </button>
                <button id="edit-save" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(editModal);

    // Ensure standard keyboard shortcuts work in input fields (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
    editModal.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        });
    });

    // Handle cancel
    const closeModal = () => editModal.remove();
    editModal.querySelector('#edit-cancel').onclick = closeModal;
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });

    // Handle save
    editModal.querySelector('#edit-save').onclick = async () => {
        const newTitle = editModal.querySelector('#edit-title').value.trim();
        const newDescription = editModal.querySelector('#edit-description').value.trim();
        const reason = editModal.querySelector('#edit-reason').value.trim();

        if (!newTitle) {
            toast.warning('Title is required');
            return;
        }

        const saveBtn = editModal.querySelector('#edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            await updateSubmission(id, {
                title: newTitle,
                description: newDescription
            }, reason || null);
            closeModal();
            showAdminToast('Submission updated successfully!', 'success');
            loadSubmissionsList();
        } catch (error) {
            toast.error('Error updating submission: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    };
};

function showAdminToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    // Use higher z-index than admin modals (z-[10001])
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl z-[10002] flex items-center gap-3`;
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="font-semibold">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.deleteSubmissionConfirm = async (id) => {
    const reason = await showPromptModal({
        title: 'Delete Submission',
        message: 'Reason for deletion (required):',
        placeholder: 'Enter reason for deletion...',
        required: true,
        confirmText: 'Continue',
    });

    if (!reason) {
        return;
    }

    const confirmed = await showConfirmModal({
        title: 'Confirm Deletion',
        message: 'Are you sure you want to delete this submission? This cannot be undone.',
        confirmText: 'Delete',
        danger: true,
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteSubmission(id, reason);
        await showAlertModal({ message: 'Submission deleted successfully!', type: 'success' });
        loadSubmissionsList();
    } catch (error) {
        await showAlertModal({ message: 'Error deleting submission: ' + error.message, type: 'error' });
    }
};

window.toggleUserBlock = async (userId, isCurrentlyBlocked) => {
    if (isCurrentlyBlocked) {
        const reason = await showPromptModal({
            title: 'Unblock User',
            message: 'Reason for unblocking (optional):',
            placeholder: 'Enter reason...',
            confirmText: 'Unblock',
        });

        // null means cancelled, empty string is valid (optional field)
        if (reason === null) {
            return;
        }

        try {
            await unblockUser(userId, reason || null);
            await showAlertModal({ message: 'User unblocked successfully!', type: 'success' });
            loadUsersList();
        } catch (error) {
            await showAlertModal({ message: 'Error unblocking user: ' + error.message, type: 'error' });
        }
    } else {
        const reason = await showPromptModal({
            title: 'Block User',
            message: 'Reason for blocking (required):',
            placeholder: 'Enter reason for blocking...',
            required: true,
            confirmText: 'Block User',
        });

        if (!reason) {
            return;
        }

        try {
            await blockUser(userId, reason);
            await showAlertModal({ message: 'User blocked successfully!', type: 'success' });
            loadUsersList();
        } catch (error) {
            await showAlertModal({ message: 'Error blocking user: ' + error.message, type: 'error' });
        }
    }
};

// Functions are already exported inline above
