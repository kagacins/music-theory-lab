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
            draggable: '[data-section-id]', // Only section tabs are draggable, not the toggle all button
            forceFallback: false,
            fallbackOnBody: true,
            scrollSensitivity: 40,
            scrollSpeed: 10,
            direction: 'vertical',
            filter: '[data-toggle-all]', // Prevent dragging the collapse/expand all buttons
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
    
    // Initialize toggle all button state
    if (sidebar._updateToggleAllButton) {
        setTimeout(() => sidebar._updateToggleAllButton(), 100);
    }
}

/**
 * Create the sidebar element
 * @param {string} tabId - The tab ID
 * @returns {HTMLElement} The sidebar element
 */
function createSidebar(tabId) {
    const sidebar = document.createElement('div');
    sidebar.id = `${tabId}-section-sidebar`;
    sidebar.className = 'section-sidebar absolute left-0 top-0 w-16 bg-gray-800/90 backdrop-blur-sm text-white z-[1] flex flex-col items-center py-2 gap-2 transition-all duration-300 border-r border-gray-700';
    sidebar.style.display = 'none'; // Hidden by default, shown when sections are collapsed
    sidebar.style.minHeight = '100%'; // Start with full height
    sidebar.style.height = 'auto'; // Allow height to grow with content
    sidebar.style.overflow = 'visible'; // Ensure tooltips are not clipped
    
    // Add separate collapse/expand all buttons at the top
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'w-12 bg-gray-700 hover:bg-gray-600 text-white text-[9px] font-semibold transition-colors flex items-center justify-center shadow-sm';
    collapseAllBtn.setAttribute('data-toggle-all', 'true');
    collapseAllBtn.setAttribute('data-action', 'collapse');
    collapseAllBtn.textContent = '−';
    collapseAllBtn.title = 'Collapse All';
    collapseAllBtn.style.height = '20px';
    collapseAllBtn.style.padding = '0';
    collapseAllBtn.style.lineHeight = '1';
    collapseAllBtn.style.minHeight = '20px';
    
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'w-12 bg-gray-700 hover:bg-gray-600 text-white text-[9px] font-semibold transition-colors flex items-center justify-center shadow-sm';
    expandAllBtn.setAttribute('data-toggle-all', 'true');
    expandAllBtn.setAttribute('data-action', 'expand');
    expandAllBtn.textContent = '+';
    expandAllBtn.title = 'Expand All';
    expandAllBtn.style.height = '20px';
    expandAllBtn.style.padding = '0';
    expandAllBtn.style.lineHeight = '1';
    expandAllBtn.style.minHeight = '20px';
    
    // Update button visibility based on current sections
    const updateToggleAllButtons = () => {
        const tabContent = sidebar.closest('.tab-content');
        if (!tabContent) return;
        
        // Get all sections in this tab
        const container = tabContent.querySelector('[id$="-sections-container"]');
        if (!container) return;
        
        const sections = container.querySelectorAll('[id$="-panel"]');
        let allCollapsed = true;
        let allExpanded = true;
        
        sections.forEach(panel => {
            if (panel.classList.contains('hidden')) {
                allExpanded = false;
            } else {
                allCollapsed = false;
            }
        });
        
        if (sections.length === 0) {
            collapseAllBtn.style.display = 'none';
            expandAllBtn.style.display = 'none';
            return;
        }
        
        // Show collapse button when at least one section is expanded
        collapseAllBtn.style.display = allCollapsed ? 'none' : 'flex';
        // Show expand button when at least one section is collapsed
        expandAllBtn.style.display = allExpanded ? 'none' : 'flex';
    };
    
    collapseAllBtn.addEventListener('click', () => {
        if (window.collapseAllCurrentTab) {
            window.collapseAllCurrentTab();
        }
        // Update button visibility after a short delay to allow DOM updates
        setTimeout(updateToggleAllButtons, 100);
    });
    
    expandAllBtn.addEventListener('click', () => {
        if (window.expandAllCurrentTab) {
            window.expandAllCurrentTab();
        }
        // Update button visibility after a short delay to allow DOM updates
        setTimeout(updateToggleAllButtons, 100);
    });
    
    // Create container for the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex flex-col gap-0.5 mb-1';
    buttonContainer.style.padding = '0';
    buttonContainer.appendChild(collapseAllBtn);
    buttonContainer.appendChild(expandAllBtn);
    
    sidebar.appendChild(buttonContainer);
    
    // Store update function on sidebar for later use
    sidebar._updateToggleAllButton = updateToggleAllButtons;
    
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
        // Section just collapsed - animate to sidebar
        animateToSidebar(section, toggle, sidebar, sectionId, collapsedSections, container);
        // Update sidebar visibility immediately since we're adding a section
        sidebar.style.display = 'flex';
        if (container) {
            container.style.marginLeft = '4rem'; // 64px = w-16
        }
        // Update toggle all button state
        if (sidebar._updateToggleAllButton) {
            setTimeout(() => sidebar._updateToggleAllButton(), 50);
        }
    } else if (!isCollapsed && collapsedSections.has(sectionId)) {
        // Section just expanded - animate from sidebar
        // Note: We'll update sidebar visibility after animation completes
        animateFromSidebar(section, sidebar, sectionId, collapsedSections, container);
    } else {
        // No state change, just update sidebar visibility
        updateSidebarVisibility(sidebar, collapsedSections, container);
    }
}

/**
 * Update sidebar visibility based on collapsed sections
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {Set} collapsedSections - Set of collapsed section IDs
 * @param {HTMLElement} container - The container element
 */
function updateSidebarVisibility(sidebar, collapsedSections, container) {
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
    
    // Update toggle all button state
    if (sidebar._updateToggleAllButton) {
        setTimeout(() => sidebar._updateToggleAllButton(), 50);
    }
}

/**
 * Animate section collapsing to sidebar
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} toggle - The toggle button
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {string} sectionId - The section ID
 * @param {Set} collapsedSections - Set of collapsed section IDs
 * @param {HTMLElement} container - The container element
 */
function animateToSidebar(section, toggle, sidebar, sectionId, collapsedSections, container) {
    // Get the icon from the toggle button
    const icon = toggle.querySelector('svg:not(.drag-handle):not([id$="-chevron"])');
    if (!icon) {
        // Fallback to non-animated version
        section.style.display = 'none';
        addToSidebar(section, sidebar, sectionId, collapsedSections, container);
        syncSidebarOrder(sidebar, container);
        return;
    }

    // Get positions
    const toggleRect = toggle.getBoundingClientRect();
    const tabContent = sidebar.closest('.tab-content');
    if (!tabContent) {
        section.style.display = 'none';
        addToSidebar(section, sidebar, sectionId, collapsedSections, container);
        syncSidebarOrder(sidebar, container);
        return;
    }

    // Create animated clone with darker, more visible styling
    const clone = icon.cloneNode(true);
    clone.style.width = '24px';
    clone.style.height = '24px';
    clone.style.color = '#1f2937'; // Dark gray for better visibility
    clone.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))';
    
    // Wrap in container for background
    const animContainer = document.createElement('div');
    animContainer.style.position = 'fixed';
    animContainer.style.left = `${toggleRect.left + toggleRect.width / 2 - 14}px`;
    animContainer.style.top = `${toggleRect.top + toggleRect.height / 2 - 14}px`;
    animContainer.style.width = '28px';
    animContainer.style.height = '28px';
    animContainer.style.zIndex = '9999';
    animContainer.style.pointerEvents = 'none';
    animContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    animContainer.style.borderRadius = '6px';
    animContainer.style.padding = '2px';
    animContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4), 0 0 4px rgba(0, 0, 0, 0.2)';
    animContainer.style.display = 'flex';
    animContainer.style.alignItems = 'center';
    animContainer.style.justifyContent = 'center';
    animContainer.appendChild(clone);
    document.body.appendChild(animContainer);

    // Hide the section immediately
    section.style.display = 'none';

    // Ensure sidebar is visible for positioning
    const wasSidebarVisible = sidebar.style.display !== 'none';
    if (!wasSidebarVisible) {
        sidebar.style.display = 'flex';
        if (container) {
            container.style.marginLeft = '4rem';
        }
    }

    // Add the tab to sidebar (but make it invisible initially)
    addToSidebar(section, sidebar, sectionId, collapsedSections, container);
    const tab = sidebar.querySelector(`[data-section-id="${sectionId}"]`);
    if (tab) {
        tab.style.opacity = '0';
    }

    // Calculate target position (center of sidebar tab)
    requestAnimationFrame(() => {
        if (!tab) {
            document.body.removeChild(animContainer);
            return;
        }
        const tabRect = tab.getBoundingClientRect();
        const targetX = tabRect.left + tabRect.width / 2 - 12;
        const targetY = tabRect.top + tabRect.height / 2 - 12;

        // Animate
        animContainer.animate([
            {
                left: `${toggleRect.left + toggleRect.width / 2 - 14}px`,
                top: `${toggleRect.top + toggleRect.height / 2 - 14}px`,
                transform: 'scale(1)',
                opacity: 1
            },
            {
                left: `${targetX - 2}px`,
                top: `${targetY - 2}px`,
                transform: 'scale(0.75)',
                opacity: 0.9
            }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards'
        }).onfinish = () => {
            document.body.removeChild(animContainer);
            if (tab) {
                tab.style.opacity = '1';
                tab.style.transition = 'opacity 0.2s';
            }
            syncSidebarOrder(sidebar, container);
            updateSidebarHeight(sidebar);
        };
    });
}

/**
 * Animate section expanding from sidebar
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {string} sectionId - The section ID
 * @param {Set} collapsedSections - Set of collapsed section IDs
 * @param {HTMLElement} container - The container element
 */
function animateFromSidebar(section, sidebar, sectionId, collapsedSections, container) {
    const tab = sidebar.querySelector(`[data-section-id="${sectionId}"]`);
    if (!tab) {
        section.style.display = '';
        removeFromSidebar(section, sidebar, sectionId, collapsedSections);
        updateSidebarVisibility(sidebar, collapsedSections, container);
        return;
    }

    // Get the icon from the tab
    const tabIcon = tab.querySelector('svg');
    if (!tabIcon) {
        section.style.display = '';
        removeFromSidebar(section, sidebar, sectionId, collapsedSections);
        updateSidebarVisibility(sidebar, collapsedSections, container);
        return;
    }

    // Get positions
    const tabRect = tab.getBoundingClientRect();
    const toggle = section.querySelector('button[id$="-toggle"]');
    if (!toggle) {
        section.style.display = '';
        removeFromSidebar(section, sidebar, sectionId, collapsedSections);
        updateSidebarVisibility(sidebar, collapsedSections, container);
        return;
    }

    // Create animated clone with darker, more visible styling
    const clone = tabIcon.cloneNode(true);
    clone.style.width = '24px';
    clone.style.height = '24px';
    clone.style.color = '#1f2937'; // Dark gray for better visibility
    clone.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))';
    
    // Wrap in container for background
    const animContainer = document.createElement('div');
    animContainer.style.position = 'fixed';
    animContainer.style.left = `${tabRect.left + tabRect.width / 2 - 14}px`;
    animContainer.style.top = `${tabRect.top + tabRect.height / 2 - 14}px`;
    animContainer.style.width = '28px';
    animContainer.style.height = '28px';
    animContainer.style.zIndex = '9999';
    animContainer.style.pointerEvents = 'none';
    animContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    animContainer.style.borderRadius = '6px';
    animContainer.style.padding = '2px';
    animContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4), 0 0 4px rgba(0, 0, 0, 0.2)';
    animContainer.style.display = 'flex';
    animContainer.style.alignItems = 'center';
    animContainer.style.justifyContent = 'center';
    animContainer.appendChild(clone);
    document.body.appendChild(animContainer);

    // Hide the tab immediately
    tab.style.opacity = '0';

    // Show the section (but make toggle invisible initially)
    section.style.display = '';
    const sectionIcon = toggle.querySelector('svg:not(.drag-handle):not([id$="-chevron"])');
    if (sectionIcon) {
        sectionIcon.style.opacity = '0';
    }

    // Calculate target position (center of toggle button)
    requestAnimationFrame(() => {
        const toggleRect = toggle.getBoundingClientRect();
        const targetX = toggleRect.left + toggleRect.width / 2 - 12;
        const targetY = toggleRect.top + toggleRect.height / 2 - 12;

        // Animate
        animContainer.animate([
            {
                left: `${tabRect.left + tabRect.width / 2 - 14}px`,
                top: `${tabRect.top + tabRect.height / 2 - 14}px`,
                transform: 'scale(0.75)',
                opacity: 0.9
            },
            {
                left: `${targetX - 2}px`,
                top: `${targetY - 2}px`,
                transform: 'scale(1)',
                opacity: 1
            }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards'
        }).onfinish = () => {
            document.body.removeChild(animContainer);
            if (sectionIcon) {
                sectionIcon.style.opacity = '1';
                sectionIcon.style.transition = 'opacity 0.2s';
            }
            removeFromSidebar(section, sidebar, sectionId, collapsedSections);
            // Update sidebar visibility after removing section
            updateSidebarVisibility(sidebar, collapsedSections, container);
        };
    });
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
    // Remove title attribute to prevent browser default tooltip delay
    tab.removeAttribute('title');
    tab.style.position = 'relative';
    
    // Add custom tooltip for immediate display (no transition for instant appearance)
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap';
    tooltip.textContent = tooltipText;
    // Pre-configure for instant display - keep it in DOM but hidden
    tooltip.style.position = 'absolute';
    tooltip.style.left = '100%';
    tooltip.style.marginLeft = '8px';
    tooltip.style.top = '50%';
    tooltip.style.transform = 'translateY(-50%)';
    tooltip.style.backgroundColor = '#111827';
    tooltip.style.color = 'white';
    tooltip.style.fontSize = '12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '4px 8px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.zIndex = '9999';
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    tooltip.style.transition = 'none';
    tooltip.style.transitionDelay = '0s';
    tooltip.style.transitionDuration = '0s';
    tooltip.style.willChange = 'opacity, visibility';
    tab.appendChild(tooltip);
    
    // Show tooltip immediately on hover (absolutely no delay)
    tab.addEventListener('mouseenter', () => {
        // Force immediate display with multiple methods
        tooltip.style.transition = 'none';
        tooltip.style.transitionDelay = '0s';
        tooltip.style.transitionDuration = '0s';
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
        // Force reflow to ensure immediate rendering
        void tooltip.offsetHeight;
    }, { passive: true });
    
    tab.addEventListener('mouseleave', () => {
        // Hide immediately
        tooltip.style.transition = 'none';
        tooltip.style.transitionDelay = '0s';
        tooltip.style.transitionDuration = '0s';
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        // Keep display as block so element stays in layout
        tooltip.style.display = 'block';
    }, { passive: true });
    
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
 * Create instant tooltips for all elements with title attributes
 * Replaces browser default tooltips which have delay with custom instant ones
 */
export function initInstantTooltips() {
    // Find all elements with title attributes
    document.querySelectorAll('[title]').forEach(element => {
        // Skip if already has a tooltip child
        if (element.querySelector('.instant-tooltip')) return;
        
        const titleText = element.getAttribute('title');
        if (!titleText) return;
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'instant-tooltip absolute bottom-full mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap';
        tooltip.textContent = titleText;
        
        // Style it for instant display
        tooltip.style.position = 'absolute';
        tooltip.style.bottom = '100%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.marginBottom = '8px';
        tooltip.style.backgroundColor = '#111827';
        tooltip.style.color = 'white';
        tooltip.style.fontSize = '12px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.padding = '4px 8px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.zIndex = '9999';
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';
        tooltip.style.transition = 'none';
        tooltip.style.transitionDelay = '0s';
        tooltip.style.transitionDuration = '0s';
        tooltip.style.willChange = 'opacity, visibility';
        
        // Set element position to relative so tooltip positions from it
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        // Append tooltip to element
        element.appendChild(tooltip);
        
        // Remove title attribute to prevent browser default tooltip
        element.removeAttribute('title');
        
        // Add event listeners for instant display
        element.addEventListener('mouseenter', () => {
            tooltip.style.transition = 'none';
            tooltip.style.transitionDelay = '0s';
            tooltip.style.transitionDuration = '0s';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            void tooltip.offsetHeight; // Force reflow
        }, { passive: true });
        
        element.addEventListener('mouseleave', () => {
            tooltip.style.transition = 'none';
            tooltip.style.transitionDelay = '0s';
            tooltip.style.transitionDuration = '0s';
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        }, { passive: true });
    });
}

/**
 * Initialize sidebar for all tabs
 */
export function initAllSectionSidebars() {
    initSectionSidebar('builder', 'builder-sections-container', 'builder-section-item');
    initSectionSidebar('trainer', 'trainer-sections-container', 'trainer-section-item');
    initSectionSidebar('melody', 'melody-sections-container', 'melody-section-item');
    
    // Initialize instant tooltips for all floating controls and other buttons
    initInstantTooltips();
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

