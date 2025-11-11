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

    // Initialize Sortable for sidebar tabs (drag-and-drop reordering)
    if (typeof Sortable !== 'undefined') {
        new Sortable(sidebar, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '[data-section-id]', // Only tabs are draggable
            forceFallback: false,
            fallbackOnBody: true,
            scrollSensitivity: 40,
            scrollSpeed: 10,
            direction: 'vertical',
            onEnd: function(evt) {
                if (evt.oldIndex !== evt.newIndex && evt.oldIndex !== undefined && evt.newIndex !== undefined) {
                    // Reorder the actual sections in the container to match sidebar order
                    reorderSectionsFromSidebar(sidebar, container, sectionClass);
                }
            }
        });
    }

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
    sidebar.className = 'section-sidebar absolute left-0 top-0 w-16 bg-gray-800/90 backdrop-blur-sm text-white z-5 flex flex-col items-center py-4 gap-2 transition-all duration-300 border-r border-gray-700';
    sidebar.style.display = 'none'; // Hidden by default, shown when sections are collapsed
    sidebar.style.minHeight = '100%'; // Start with full height
    sidebar.style.height = 'auto'; // Allow height to grow with content
    
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
        // Update height when showing sidebar
        updateSidebarHeight(sidebar);
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
    
    // Create tooltip that appears immediately on hover (no delay)
    const tooltipText = toggle.textContent.trim() || sectionId;
    tab.setAttribute('title', tooltipText);
    tab.style.position = 'relative';
    
    // Add custom tooltip for immediate display
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap opacity-0 transition-opacity duration-0 z-50';
    tooltip.textContent = tooltipText;
    tab.appendChild(tooltip);
    
    // Show tooltip immediately on hover
    tab.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
    });
    tab.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
    });
    
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
    
    // Update sidebar height to fit all tabs without scrolling
    updateSidebarHeight(sidebar);
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
    
    // Update sidebar height after removing tab
    updateSidebarHeight(sidebar);
}

/**
 * Update sidebar height to fit all tabs without scrolling
 * @param {HTMLElement} sidebar - The sidebar element
 */
function updateSidebarHeight(sidebar) {
    if (!sidebar || sidebar.style.display === 'none') return;
    
    // Get the tab content container (parent of sidebar)
    const tabContent = sidebar.closest('.tab-content');
    if (!tabContent) return;
    
    // Calculate total height needed: padding + (tab height + gap) * number of tabs
    const tabs = sidebar.querySelectorAll('[data-section-id]');
    const tabHeight = 48; // w-12 h-12 = 48px
    const gap = 8; // gap-2 = 8px
    const padding = 32; // py-4 = 16px top + 16px bottom = 32px
    const totalHeight = padding + (tabs.length * (tabHeight + gap)) - gap; // Subtract last gap
    
    // Set sidebar height to fit content, but at least match tab content height
    const tabContentHeight = tabContent.offsetHeight;
    sidebar.style.height = `${Math.max(totalHeight, tabContentHeight)}px`;
    sidebar.style.minHeight = `${Math.max(totalHeight, tabContentHeight)}px`;
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
 * Reorder sections in container based on sidebar tab order
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {HTMLElement} container - The container element
 * @param {string} sectionClass - The section class name
 */
function reorderSectionsFromSidebar(sidebar, container, sectionClass) {
    // Get sidebar tab order
    const tabs = Array.from(sidebar.querySelectorAll('[data-section-id]'));
    const sidebarOrder = tabs.map(tab => tab.getAttribute('data-section-id'));
    
    // Get all sections (including hidden ones)
    const sections = Array.from(container.querySelectorAll(`.${sectionClass}`));
    const sectionMap = new Map();
    
    sections.forEach(section => {
        const toggle = section.querySelector('button[id$="-toggle"]');
        if (toggle) {
            const sectionId = toggle.id.replace('-toggle', '');
            sectionMap.set(sectionId, section);
        }
    });
    
    // Get all section IDs in current container order
    const currentOrder = Array.from(container.children).map(section => {
        const toggle = section.querySelector('button[id$="-toggle"]');
        return toggle ? toggle.id.replace('-toggle', '') : null;
    }).filter(id => id !== null);
    
    // Create new order: sidebar order first (collapsed), then remaining sections
    const newOrder = [];
    const remainingSections = new Set(currentOrder);
    
    // Add collapsed sections in sidebar order
    sidebarOrder.forEach(sectionId => {
        if (sectionMap.has(sectionId)) {
            newOrder.push(sectionId);
            remainingSections.delete(sectionId);
        }
    });
    
    // Add remaining sections (expanded) in their current order
    currentOrder.forEach(sectionId => {
        if (remainingSections.has(sectionId)) {
            newOrder.push(sectionId);
        }
    });
    
    // Reorder sections in container
    newOrder.forEach(sectionId => {
        const section = sectionMap.get(sectionId);
        if (section) {
            container.appendChild(section);
        }
    });
    
    // Save the new order to localStorage (if sectionDragDrop module is available)
    const tabId = container.closest('.tab-content')?.id.replace('tab-', '');
    if (tabId && typeof localStorage !== 'undefined') {
        try {
            const finalOrder = Array.from(container.children).map(section => {
                const toggle = section.querySelector('button[id$="-toggle"]');
                return toggle ? toggle.id.replace('-toggle', '') : null;
            }).filter(id => id !== null);
            localStorage.setItem(`sectionOrder_${tabId}`, JSON.stringify(finalOrder));
        } catch (e) {
            console.warn('Error saving section order:', e);
        }
    }
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

