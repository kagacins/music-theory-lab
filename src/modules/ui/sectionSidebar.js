/**
 * Section Sidebar Module
 * Manages a left sidebar that shows collapsed sections as tabs
 * When a section is collapsed, it appears in the sidebar
 * When expanded, it shows in the main content area
 */

let sectionSidebarInstances = new Map(); // Track sidebar instances per tab

/**
 * Initialize the sidebar system for a tab
 * @param {string} tabId - The tab ID ('builder', 'trainer', 'melody')
 * @param {string} containerId - The container ID for the sections
 * @param {string} sectionClass - The class name for draggable sections
 */
export function initSectionSidebar(tabId, containerId, sectionClass) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Section sidebar: Container ${containerId} not found`);
        return;
    }

    // Create sidebar if it doesn't exist
    let sidebar = document.getElementById(`${tabId}-section-sidebar`);
    if (!sidebar) {
        sidebar = createSidebar(tabId);
        const tabContent = container.closest('.tab-content');
        if (tabContent) {
            // Ensure tab content has relative positioning
            if (getComputedStyle(tabContent).position === 'static') {
                tabContent.style.position = 'relative';
            }
            // Insert sidebar at the beginning of tab content
            tabContent.insertBefore(sidebar, tabContent.firstChild);
            // Adjust container margin to make room for sidebar when visible
            container.style.marginLeft = '0';
            container.style.transition = 'margin-left 0.3s ease';
        } else {
            console.warn(`Section sidebar: Tab content not found for ${tabId}`);
        }
    }

    // Track which sections are collapsed
    const collapsedSections = new Set();
    
    // Observe panel visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const panel = mutation.target;
                // Find the parent section
                const section = panel.closest(`.${sectionClass}`);
                if (section) {
                    updateSectionState(section, sidebar, collapsedSections, container);
                }
            }
        });
    });

    // Observe all sections and their panels
    const sections = container.querySelectorAll(`.${sectionClass}`);
    sections.forEach(section => {
        const panel = section.querySelector('[id$="-panel"]');
        if (panel) {
            // Observe the panel for class changes
            observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
            // Check initial state
            updateSectionState(section, sidebar, collapsedSections, container);
        }
    });

    // Observe container for child order changes (drag-and-drop)
    const orderObserver = new MutationObserver(() => {
        syncSidebarOrder(sidebar, container);
    });
    
    // Observe child list changes for drag-and-drop reordering
    orderObserver.observe(container, { childList: true });

    // Store instance
    sectionSidebarInstances.set(tabId, { sidebar, container, sectionClass, collapsedSections, observer, orderObserver });
}

/**
 * Create the sidebar element
 * @param {string} tabId - The tab ID
 * @returns {HTMLElement} The sidebar element
 */
function createSidebar(tabId) {
    const sidebar = document.createElement('div');
    sidebar.id = `${tabId}-section-sidebar`;
    sidebar.className = 'section-sidebar absolute left-0 top-0 h-full w-16 bg-gray-800/90 backdrop-blur-sm text-white z-30 flex flex-col items-center py-4 gap-2 overflow-y-auto transition-all duration-300 border-r border-gray-700';
    sidebar.style.display = 'none'; // Hidden by default, shown when sections are collapsed
    
    return sidebar;
}

/**
 * Update section state (collapsed/expanded)
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {Set} collapsedSections - Set of collapsed section IDs
 * @param {HTMLElement} container - The container element
 */
function updateSectionState(section, sidebar, collapsedSections, container) {
    const toggle = section.querySelector('button[id$="-toggle"]');
    if (!toggle) return;

    const sectionId = toggle.id.replace('-toggle', '');
    const panel = section.querySelector('[id$="-panel"]');
    
    if (!panel) return;

    const isCollapsed = panel.classList.contains('hidden');
    
    if (isCollapsed && !collapsedSections.has(sectionId)) {
        // Section just collapsed - hide the entire section and add to sidebar
        section.style.display = 'none';
        addToSidebar(section, sidebar, sectionId, collapsedSections, container);
        syncSidebarOrder(sidebar, container);
    } else if (!isCollapsed && collapsedSections.has(sectionId)) {
        // Section just expanded - show the section and remove from sidebar
        section.style.display = '';
        removeFromSidebar(section, sidebar, sectionId, collapsedSections);
    }

    // Show/hide sidebar based on whether any sections are collapsed
    if (collapsedSections.size > 0) {
        sidebar.style.display = 'flex';
        if (container) {
            container.style.marginLeft = '4rem'; // 64px = w-16
        }
    } else {
        sidebar.style.display = 'none';
        if (container) {
            container.style.marginLeft = '0';
        }
    }
}

/**
 * Add a section to the sidebar
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {string} sectionId - The section ID
 * @param {Set} collapsedSections - Set of collapsed section IDs
 * @param {HTMLElement} container - The container element
 */
function addToSidebar(section, sidebar, sectionId, collapsedSections, container) {
    // Check if already in sidebar
    if (sidebar.querySelector(`[data-section-id="${sectionId}"]`)) return;

    const toggle = section.querySelector('button[id$="-toggle"]');
    if (!toggle) return;

    // Extract gradient colors from toggle button
    const toggleClasses = toggle.className;
    let gradientClasses = '';
    const gradientMatch = toggleClasses.match(/bg-gradient-to-r\s+from-[\w-]+\s+to-[\w-]+/);
    if (gradientMatch) {
        gradientClasses = gradientMatch[0];
    }
    
    // Extract hover gradient if available
    const hoverMatch = toggleClasses.match(/hover:from-[\w-]+\s+hover:to-[\w-]+/);
    const hoverClasses = hoverMatch ? hoverMatch[0] : '';

    // Create sidebar tab with matching colors
    const tab = document.createElement('button');
    if (gradientClasses) {
        tab.className = `section-sidebar-tab w-12 h-12 rounded-lg ${gradientClasses} ${hoverClasses} text-white transition-all flex items-center justify-center text-xs font-semibold p-2 text-center shadow-md`;
    } else {
        // Fallback to gray if no gradient found
        tab.className = 'section-sidebar-tab w-12 h-12 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all flex items-center justify-center text-xs font-semibold p-2 text-center';
    }
    tab.setAttribute('data-section-id', sectionId);
    tab.title = toggle.textContent.trim() || sectionId;
    
    // Get icon from toggle button
    const icon = toggle.querySelector('svg:not(.drag-handle):not([id$="-chevron"])');
    if (icon) {
        const iconClone = icon.cloneNode(true);
        // Use setAttribute for SVG elements instead of className
        iconClone.setAttribute('class', 'w-6 h-6');
        tab.appendChild(iconClone);
    } else {
        tab.textContent = sectionId.charAt(0).toUpperCase();
    }

    // Click handler to expand section
    tab.addEventListener('click', () => {
        const toggleBtn = document.getElementById(`${sectionId}-toggle`);
        if (toggleBtn) {
            // Trigger the toggle button click
            toggleBtn.click();
        }
    });

    sidebar.appendChild(tab);
    collapsedSections.add(sectionId);
}

/**
 * Remove a section from the sidebar
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {string} sectionId - The section ID
 * @param {Set} collapsedSections - Set of collapsed section IDs
 */
function removeFromSidebar(section, sidebar, sectionId, collapsedSections) {
    const tab = sidebar.querySelector(`[data-section-id="${sectionId}"]`);
    if (tab) {
        tab.remove();
    }
    collapsedSections.delete(sectionId);
}

/**
 * Sync sidebar tab order with the container's section order
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {HTMLElement} container - The container element
 */
function syncSidebarOrder(sidebar, container) {
    // Get all sections in their current order (including hidden ones)
    const sections = Array.from(container.children);
    const sectionOrder = sections.map(section => {
        const toggle = section.querySelector('button[id$="-toggle"]');
        return toggle ? toggle.id.replace('-toggle', '') : null;
    }).filter(id => id !== null);

    // Get all sidebar tabs
    const tabs = Array.from(sidebar.querySelectorAll('[data-section-id]'));
    
    // Reorder tabs to match section order (only include collapsed sections)
    sectionOrder.forEach(sectionId => {
        const tab = tabs.find(t => t.getAttribute('data-section-id') === sectionId);
        if (tab) {
            sidebar.appendChild(tab);
        }
    });
}

/**
 * Initialize sidebar for all tabs
 */
export function initAllSectionSidebars() {
    initSectionSidebar('builder', 'builder-sections-container', 'builder-section-item');
    initSectionSidebar('trainer', 'trainer-sections-container', 'trainer-section-item');
    initSectionSidebar('melody', 'melody-sections-container', 'melody-section-item');
}

/**
 * Clean up sidebar instances
 */
export function cleanupSectionSidebars() {
    sectionSidebarInstances.forEach((instance, tabId) => {
        if (instance.observer) {
            instance.observer.disconnect();
        }
        if (instance.orderObserver) {
            instance.orderObserver.disconnect();
        }
    });
    sectionSidebarInstances.clear();
}

