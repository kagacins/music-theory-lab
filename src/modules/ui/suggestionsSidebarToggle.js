/**
 * Suggestions Sidebar Toggle Module
 * Handles collapsing/expanding the chord and melody suggestions sidebar
 * Integrates with the section sidebar to show a lightbulb icon when collapsed
 */

let isSuggestionsSidebarCollapsed = false;
let sidebarTab = null; // Reference to the sidebar tab element

/**
 * Toggle the suggestions sidebar collapsed/expanded state
 */
export function toggleSuggestionsSidebar() {
    const sidebar = document.getElementById('chord-recommendations-sidebar');
    if (!sidebar) return;

    isSuggestionsSidebarCollapsed = !isSuggestionsSidebarCollapsed;

    if (isSuggestionsSidebarCollapsed) {
        collapseSuggestionsSidebar(sidebar);
    } else {
        expandSuggestionsSidebar(sidebar);
    }

    // Save state to localStorage
    saveSidebarState();
}

/**
 * Collapse the suggestions sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
function collapseSuggestionsSidebar(sidebar) {
    // Animate the collapse with slide-out and fade
    sidebar.style.transition = 'all 0.3s ease';
    sidebar.style.opacity = '0';
    sidebar.style.transform = 'translateX(20px)';

    // After animation, hide it completely
    setTimeout(() => {
        sidebar.style.display = 'none';

        // Add the tab to the section sidebar
        addSuggestionTabToSectionSidebar();

        // Adjust the main content width to fill the space
        adjustMelodyContentWidth(true);
    }, 300);
}

/**
 * Expand the suggestions sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
function expandSuggestionsSidebar(sidebar) {
    // Remove the tab from the section sidebar first
    removeSuggestionTabFromSectionSidebar();

    // Show the sidebar
    sidebar.style.display = '';
    sidebar.style.transition = 'all 0.3s ease';

    // Force a reflow to ensure the transition works
    void sidebar.offsetHeight;

    // Animate in
    sidebar.style.opacity = '1';
    sidebar.style.transform = 'translateX(0)';

    // Adjust the main content width
    adjustMelodyContentWidth(false);
}

/**
 * Add a lightbulb tab to the section sidebar
 */
function addSuggestionTabToSectionSidebar() {
    const sectionSidebar = document.getElementById('melody-section-sidebar');
    if (!sectionSidebar) {
        console.warn('Section sidebar not found for melody tab');
        return;
    }

    // Don't add if already exists
    if (sectionSidebar.querySelector('[data-section-id="suggestions-sidebar"]')) {
        return;
    }

    // Create the tab element with a lightbulb icon
    sidebarTab = document.createElement('button');
    sidebarTab.className = 'section-sidebar-tab w-12 h-12 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white transition-all flex items-center justify-center text-xs font-semibold p-2 text-center shadow-md';
    sidebarTab.setAttribute('data-section-id', 'suggestions-sidebar');
    sidebarTab.style.width = '48px';
    sidebarTab.style.height = '48px';
    sidebarTab.style.minHeight = '48px';
    sidebarTab.style.minWidth = '48px';

    // Lightbulb SVG icon
    const lightbulbIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lightbulbIcon.setAttribute('class', 'w-6 h-6');
    lightbulbIcon.setAttribute('fill', 'currentColor');
    lightbulbIcon.setAttribute('viewBox', '0 0 20 20');
    lightbulbIcon.innerHTML = '<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>';

    sidebarTab.appendChild(lightbulbIcon);

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-section-tooltip bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap';
    tooltip.textContent = 'Chord & Melody Suggestions';
    tooltip.style.position = 'fixed';
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
    document.body.appendChild(tooltip);

    // Show tooltip on hover
    sidebarTab.addEventListener('mouseenter', () => {
        const tabRect = sidebarTab.getBoundingClientRect();
        tooltip.style.left = `${tabRect.right + 8}px`;
        tooltip.style.top = `${tabRect.top + tabRect.height / 2}px`;
        tooltip.style.transform = 'translateY(-50%)';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    });

    sidebarTab.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });

    // Click handler to expand the sidebar
    sidebarTab.addEventListener('click', () => {
        toggleSuggestionsSidebar();
    });

    // Append to section sidebar
    sectionSidebar.appendChild(sidebarTab);

    // Force the section sidebar to be visible (it will now have at least one tab)
    sectionSidebar.style.display = 'flex';
    const container = document.querySelector('#melody-sections-container');
    if (container) {
        container.style.marginLeft = '4rem';
    }

    // Update section sidebar height
    if (window.updateTabSidebarHeight) {
        setTimeout(() => window.updateTabSidebarHeight('melody'), 50);
    }
}

/**
 * Remove the suggestion tab from the section sidebar
 */
function removeSuggestionTabFromSectionSidebar() {
    const sectionSidebar = document.getElementById('melody-section-sidebar');
    if (!sectionSidebar) return;

    const tab = sectionSidebar.querySelector('[data-section-id="suggestions-sidebar"]');
    if (tab) {
        // Remove tooltip
        const tooltips = document.querySelectorAll('.sidebar-section-tooltip');
        tooltips.forEach(tooltip => {
            if (tooltip.textContent === 'Chord & Melody Suggestions') {
                tooltip.remove();
            }
        });

        tab.remove();
        sidebarTab = null;

        // Check if section sidebar should be hidden
        const remainingTabs = sectionSidebar.querySelectorAll('[data-section-id]');
        if (remainingTabs.length === 0) {
            sectionSidebar.style.display = 'none';
            const container = document.querySelector('#melody-sections-container');
            if (container) {
                container.style.marginLeft = '0';
            }
        }

        // Update section sidebar height
        if (window.updateTabSidebarHeight) {
            setTimeout(() => window.updateTabSidebarHeight('melody'), 50);
        }
    }
}

/**
 * Adjust the melody content width when sidebar is collapsed/expanded
 * @param {boolean} isCollapsed - Whether the sidebar is collapsed
 */
function adjustMelodyContentWidth(isCollapsed) {
    const melodyContent = document.querySelector('#tab-melody .flex.gap-4');
    if (!melodyContent) return;

    // When collapsed, the main content should expand to fill the space
    // The flex container will naturally adjust, but we can add smooth transitions
    melodyContent.style.transition = 'all 0.3s ease';
}

/**
 * Save sidebar collapsed state to localStorage
 */
function saveSidebarState() {
    try {
        localStorage.setItem('suggestionsSidebarCollapsed', JSON.stringify(isSuggestionsSidebarCollapsed));
    } catch (e) {
        console.warn('Could not save suggestions sidebar state:', e);
    }
}

/**
 * Restore sidebar collapsed state from localStorage
 */
export function restoreSuggestionsSidebarState() {
    try {
        const saved = localStorage.getItem('suggestionsSidebarCollapsed');
        if (saved !== null) {
            isSuggestionsSidebarCollapsed = JSON.parse(saved);

            const sidebar = document.getElementById('chord-recommendations-sidebar');
            if (sidebar && isSuggestionsSidebarCollapsed) {
                // Immediately apply collapsed state without animation
                sidebar.style.display = 'none';
                addSuggestionTabToSectionSidebar();
                adjustMelodyContentWidth(true);
            }
        }
    } catch (e) {
        console.warn('Could not restore suggestions sidebar state:', e);
    }
}

/**
 * Initialize suggestions sidebar toggle functionality
 */
export function initSuggestionsSidebarToggle() {
    // Restore state when initialized
    restoreSuggestionsSidebarState();

    // Make toggle function available globally
    window.toggleSuggestionsSidebar = toggleSuggestionsSidebar;
}
