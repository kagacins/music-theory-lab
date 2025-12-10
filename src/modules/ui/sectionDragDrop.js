/**
 * Section Drag and Drop Module
 * Enables drag-and-drop reordering of collapsible sections within each tab
 */

/**
 * Initialize drag-and-drop for sections in a specific tab
 * @param {string} tabId - The tab ID ('builder', 'trainer', 'melody')
 * @param {string} containerId - The container ID for the sections
 * @param {string} sectionClass - The class name for draggable sections
 */
export function initSectionDragDrop(tabId, containerId, sectionClass) {
    const container = document.getElementById(containerId);
    if (!container || typeof Sortable === 'undefined') {
        return;
    }

    // Destroy existing Sortable instance if it exists
    if (container.sortableInstance) {
        try {
            container.sortableInstance.destroy();
            container.sortableInstance = null;
        } catch (e) {
            console.warn('Error destroying Sortable:', e);
        }
    }

    // Load saved order from localStorage
    const savedOrder = loadSectionOrder(tabId);
    if (savedOrder && savedOrder.length > 0) {
        reorderSections(container, sectionClass, savedOrder);
    }

    // Add event listeners to drag handles to prevent button clicks
    const handles = container.querySelectorAll('.drag-handle');
    handles.forEach(handle => {
        // Ensure handle can receive pointer events
        handle.style.pointerEvents = 'auto';
        handle.style.userSelect = 'none';
        handle.style.webkitUserSelect = 'none';
        
        // Only stop propagation, don't prevent default - let SortableJS handle the drag
        handle.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            // Don't prevent default - SortableJS needs the mousedown event
        }, true); // Use capture phase
        
        handle.addEventListener('click', function(e) {
            // Only prevent if we actually dragged
            if (e.detail === 0) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    });

    // Initialize Sortable
    container.sortableInstance = new Sortable(container, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.drag-handle', // Only allow dragging from the handle icon
        draggable: `.${sectionClass}`, // Only direct children with the section class
        forceFallback: false, // Try native HTML5 drag first
        fallbackOnBody: true,
        fallbackTolerance: 0,
        scrollSensitivity: 40,
        scrollSpeed: 10,
        bubbleScroll: true,
        swapThreshold: 0.5, // Lower threshold for easier swapping
        invertSwap: false,
        direction: 'vertical', // Explicitly set vertical direction
        onStart: function(evt) {
            // Prevent button click when starting drag
            if (evt.item) {
                const button = evt.item.querySelector('button[id$="-toggle"]');
                if (button) {
                    // Store original onclick
                    button._originalOnclick = button.onclick;
                    button.onclick = null;
                    button.style.pointerEvents = 'none';
                }
            }
        },
        onMove: function(evt, originalEvent) {
            // Allow movement - return true to allow, false to prevent
            return true;
        },
        onEnd: function(evt) {
            // Restore button functionality
            if (evt.item) {
                const button = evt.item.querySelector('button[id$="-toggle"]');
                if (button) {
                    button.style.pointerEvents = '';
                    if (button._originalOnclick) {
                        button.onclick = button._originalOnclick;
                        delete button._originalOnclick;
                    }
                }
            }
            
            // Check if item was actually moved
            if (evt.oldIndex !== evt.newIndex && evt.oldIndex !== undefined && evt.newIndex !== undefined) {
                // Save the new order to localStorage
                const newOrder = getSectionOrder(container, sectionClass);
                saveSectionOrder(tabId, newOrder);
            }
        }
    });
}

/**
 * Get the current order of sections
 * @param {HTMLElement} container - The container element
 * @param {string} sectionClass - The class name for sections
 * @returns {Array<string>} Array of section IDs in current order
 */
function getSectionOrder(container, sectionClass) {
    const sections = Array.from(container.querySelectorAll(`.${sectionClass}`));
    return sections.map(section => {
        // Find the toggle button ID to identify the section
        const toggle = section.querySelector('button[id$="-toggle"]');
        return toggle ? toggle.id.replace('-toggle', '') : null;
    }).filter(id => id !== null);
}

/**
 * Reorder sections based on saved order
 * @param {HTMLElement} container - The container element
 * @param {string} sectionClass - The class name for sections
 * @param {Array<string>} order - Array of section IDs in desired order
 */
function reorderSections(container, sectionClass, order) {
    const sections = Array.from(container.querySelectorAll(`.${sectionClass}`));
    const sectionMap = new Map();
    
    sections.forEach(section => {
        const toggle = section.querySelector('button[id$="-toggle"]');
        if (toggle) {
            const sectionId = toggle.id.replace('-toggle', '');
            sectionMap.set(sectionId, section);
        }
    });

    // Reorder sections based on saved order
    order.forEach(sectionId => {
        const section = sectionMap.get(sectionId);
        if (section) {
            container.appendChild(section);
        }
    });
}

/**
 * Save section order to localStorage
 * @param {string} tabId - The tab ID
 * @param {Array<string>} order - Array of section IDs in current order
 */
function saveSectionOrder(tabId, order) {
    try {
        localStorage.setItem(`sectionOrder_${tabId}`, JSON.stringify(order));
    } catch (e) {
        console.warn('Error saving section order:', e);
    }
}

/**
 * Load section order from localStorage
 * @param {string} tabId - The tab ID
 * @returns {Array<string>|null} Array of section IDs in saved order, or null if not found
 */
function loadSectionOrder(tabId) {
    try {
        const saved = localStorage.getItem(`sectionOrder_${tabId}`);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('Error loading section order:', e);
        return null;
    }
}

/**
 * Initialize drag-and-drop for all tabs
 */
export function initAllSectionDragDrop() {
    // Initialize for Chord Builder tab
    initSectionDragDrop('builder', 'builder-sections-container', 'builder-section-item');

    // Initialize for Progression Builder tab
    initSectionDragDrop('trainer', 'trainer-sections-container', 'trainer-section-item');

    // Initialize for Melody Composer tab (new dashboard layout)
    initSectionDragDrop('melody', 'melody-dashboard-sections-container', 'melody-section-item');
}

/**
 * Reinitialize drag-and-drop for a specific tab
 * Call this after dynamically adding new sections to ensure they're draggable
 * @param {string} tabId - The tab ID ('builder', 'trainer', 'melody')
 */
export function reinitSectionDragDrop(tabId) {
    const containerMap = {
        'builder': { containerId: 'builder-sections-container', sectionClass: 'builder-section-item' },
        'trainer': { containerId: 'trainer-sections-container', sectionClass: 'trainer-section-item' },
        'melody': { containerId: 'melody-dashboard-sections-container', sectionClass: 'melody-section-item' }
    };

    const config = containerMap[tabId];
    if (config) {
        initSectionDragDrop(tabId, config.containerId, config.sectionClass);
    }
}

// Expose reinit function globally for dynamically created panels
window.reinitSectionDragDrop = reinitSectionDragDrop;

