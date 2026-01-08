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
    unblockUser
} from './adminService.js';

let modalElement = null;
let currentTab = 'overview';
let submissionsPage = 1;
let usersPage = 1;
let submissionsData = null;
let usersData = null;

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
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';

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
                <button data-tab="users" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Users
                </button>
                <button data-tab="audit" class="admin-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent hover:border-gray-400 transition-colors" style="color: #374151; -webkit-text-fill-color: #374151;">
                    Audit Log
                </button>
            </div>

            <!-- Content -->
            <div id="admin-content" class="flex-1 overflow-y-auto p-6 bg-white">
                <div class="flex items-center justify-center py-12">
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
 * Load content for current tab
 */
async function loadTabContent() {
    const content = modalElement?.querySelector('#admin-content');
    if (!content) return;

    content.innerHTML = `
        <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
    `;

    try {
        switch (currentTab) {
            case 'overview':
                await renderOverview(content);
                break;
            case 'submissions':
                await renderSubmissions(content);
                break;
            case 'users':
                await renderUsers(content);
                break;
            case 'audit':
                await renderAuditLog(content);
                break;
        }
    } catch (error) {
        console.error('[AdminDashboard] Error loading tab:', error);
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
        <!-- Stats Cards - Row 1 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #2563eb; -webkit-text-fill-color: #2563eb;">Total Submissions</p>
                <p class="text-3xl font-bold" style="color: #1d4ed8; -webkit-text-fill-color: #1d4ed8;">${data.stats?.totalSubmissions || 0}</p>
            </div>
            <div class="bg-indigo-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #4f46e5; -webkit-text-fill-color: #4f46e5;">Progressions</p>
                <p class="text-3xl font-bold" style="color: #4338ca; -webkit-text-fill-color: #4338ca;">${data.stats?.totalProgressions || 0}</p>
            </div>
            <div class="bg-violet-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #7c3aed; -webkit-text-fill-color: #7c3aed;">Compositions</p>
                <p class="text-3xl font-bold" style="color: #6d28d9; -webkit-text-fill-color: #6d28d9;">${data.stats?.totalCompositions || 0}</p>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #16a34a; -webkit-text-fill-color: #16a34a;">Total Users</p>
                <p class="text-3xl font-bold" style="color: #15803d; -webkit-text-fill-color: #15803d;">${data.stats?.totalUsers || 0}</p>
            </div>
        </div>
        <!-- Stats Cards - Row 2 -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-red-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #dc2626; -webkit-text-fill-color: #dc2626;">Blocked Users</p>
                <p class="text-3xl font-bold" style="color: #b91c1c; -webkit-text-fill-color: #b91c1c;">${data.stats?.blockedUsers || 0}</p>
            </div>
            <div class="bg-emerald-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #059669; -webkit-text-fill-color: #059669;">Published</p>
                <p class="text-3xl font-bold" style="color: #047857; -webkit-text-fill-color: #047857;">${data.stats?.submissionsByStatus?.published || 0}</p>
            </div>
            <div class="bg-amber-50 rounded-lg p-4">
                <p class="text-sm mb-1" style="color: #d97706; -webkit-text-fill-color: #d97706;">Drafts</p>
                <p class="text-3xl font-bold" style="color: #b45309; -webkit-text-fill-color: #b45309;">${data.stats?.submissionsByStatus?.draft || 0}</p>
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
async function renderSubmissions(container) {
    const searchHtml = `
        <div class="flex gap-4 mb-6">
            <input type="text" id="admin-sub-search" placeholder="Search submissions..."
                   class="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
            <select id="admin-sub-status" class="px-4 py-2 border border-gray-300 rounded-lg bg-white" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
            </select>
            <button id="admin-sub-search-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Search
            </button>
        </div>
        <div id="admin-submissions-list"></div>
    `;

    container.innerHTML = searchHtml;

    // Load submissions
    await loadSubmissionsList();

    // Event listeners
    container.querySelector('#admin-sub-search-btn').addEventListener('click', () => {
        submissionsPage = 1;
        loadSubmissionsList();
    });
    container.querySelector('#admin-sub-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submissionsPage = 1;
            loadSubmissionsList();
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

async function loadSubmissionsList() {
    const listContainer = modalElement?.querySelector('#admin-submissions-list');
    if (!listContainer) return;

    const search = modalElement.querySelector('#admin-sub-search')?.value || '';
    const status = modalElement.querySelector('#admin-sub-status')?.value || '';

    listContainer.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></div>';

    try {
        submissionsData = await getSubmissions({ search, status, page: submissionsPage, limit: 10 });

        if (!submissionsData.submissions?.length) {
            listContainer.innerHTML = '<p class="text-center py-8" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">No submissions found</p>';
            return;
        }

        listContainer.innerHTML = `
            <div class="space-y-4">
                ${submissionsData.submissions.map(s => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200" data-submission-id="${s.id}">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h4 class="font-medium" style="color: #1f2937; -webkit-text-fill-color: #1f2937;">${escapeHtml(s.title)}</h4>
                                <p class="text-sm mt-1 line-clamp-2" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">${escapeHtml(s.description || 'No description')}</p>
                                <div class="flex items-center gap-4 mt-2 text-xs" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                                    <span>By ${escapeHtml(s.author?.username ? `@${s.author.username}` : s.author?.displayName || 'Unknown')}</span>
                                    <span>Upvotes: <strong class="upvote-count">${s.upvoteCount || 0}</strong></span>
                                    <span class="px-2 py-0.5 rounded-full ${s.status === 'published' ? 'bg-green-100' : 'bg-gray-200'}" style="color: ${s.status === 'published' ? '#166534' : '#4b5563'}; -webkit-text-fill-color: ${s.status === 'published' ? '#166534' : '#4b5563'};">${s.status}</span>
                                </div>
                            </div>
                            <div class="flex gap-2 ml-4">
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
    } catch (error) {
        listContainer.innerHTML = `<p class="text-center text-red-500 py-8">Error: ${error.message}</p>`;
    }
}

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
                                    ? `<img src="${u.avatarUrl}" class="w-10 h-10 rounded-full" alt="">`
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
                            ${auditLog.map(entry => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm">
                                        <span class="px-2 py-1 rounded-full text-xs ${getActionColor(entry.action)}">
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
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error loading audit log: ${error.message}</p>`;
    }
}

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
    if (action.includes('delete') || action.includes('block')) {
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    }
    if (action.includes('unblock')) {
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
    }
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
}

// ==========================================
// WINDOW EXPOSED FUNCTIONS
// ==========================================

window.adminPageChange = (type, page) => {
    if (type === 'submissions') {
        submissionsPage = page;
        loadSubmissionsList();
    } else if (type === 'users') {
        usersPage = page;
        loadUsersList();
    }
};

window.editSubmission = async (id) => {
    const submission = submissionsData?.submissions?.find(s => s.id === id);
    if (!submission) return;

    // Create edit modal
    const editModal = document.createElement('div');
    editModal.id = 'admin-edit-modal';
    editModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4';
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
            alert('Title is required');
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
            alert('Error updating submission: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    };
};

function showAdminToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl z-[70] flex items-center gap-3`;
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
    const reason = prompt('Reason for deletion (required):');
    if (!reason) {
        alert('Deletion cancelled - reason is required');
        return;
    }

    if (!confirm('Are you sure you want to delete this submission? This cannot be undone.')) {
        return;
    }

    try {
        await deleteSubmission(id, reason);
        alert('Submission deleted successfully!');
        loadSubmissionsList();
    } catch (error) {
        alert('Error deleting submission: ' + error.message);
    }
};

window.toggleUserBlock = async (userId, isCurrentlyBlocked) => {
    if (isCurrentlyBlocked) {
        const reason = prompt('Reason for unblocking (optional):');
        try {
            await unblockUser(userId, reason);
            alert('User unblocked successfully!');
            loadUsersList();
        } catch (error) {
            alert('Error unblocking user: ' + error.message);
        }
    } else {
        const reason = prompt('Reason for blocking (required):');
        if (!reason) {
            alert('Block cancelled - reason is required');
            return;
        }
        try {
            await blockUser(userId, reason);
            alert('User blocked successfully!');
            loadUsersList();
        } catch (error) {
            alert('Error blocking user: ' + error.message);
        }
    }
};

// Functions are already exported inline above
