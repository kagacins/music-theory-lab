/**
 * Header UI Module
 * Handles header display updates including key signature display
 *
 * State Dependencies:
 * - Depends on global constants: KEY_SIGNATURE_TEXT, KEY_SIGNATURE_IMAGES,
 *   ENHARMONIC_MAP, RELATIVE_MINOR_MAP
 */

/**
 * Update the key signature display in the header
 * @param {string} key - The key to display (e.g., "C", "G", "F#")
 * Depends on: global KEY_SIGNATURE_TEXT, KEY_SIGNATURE_IMAGES, ENHARMONIC_MAP, RELATIVE_MINOR_MAP
 */
export function updateKeySignatureDisplay(key) {
    // Access global constants with safety checks
    const KEY_SIGNATURE_TEXT = window.KEY_SIGNATURE_TEXT;
    const KEY_SIGNATURE_IMAGES = window.KEY_SIGNATURE_IMAGES;
    const ENHARMONIC_MAP = window.ENHARMONIC_MAP;
    const RELATIVE_MINOR_MAP = window.RELATIVE_MINOR_MAP;

    // Safety check - if constants aren't loaded yet, return early
    if (!KEY_SIGNATURE_TEXT || !KEY_SIGNATURE_IMAGES || !ENHARMONIC_MAP || !RELATIVE_MINOR_MAP) {
        console.warn('Key signature constants not yet loaded');
        return;
    }

    if (!key) return;

    const textDisplay = document.getElementById('key-signature-text');
    const trebleImg = document.getElementById('treble-clef-img');
    const enharmonicLabel = document.getElementById('enharmonic-key-label');
    const relativeMinorDisplay = document.getElementById('relative-minor-display');

    if (!textDisplay || !trebleImg) return;

    const text = KEY_SIGNATURE_TEXT[key] || "Unknown Key";
    textDisplay.textContent = `Key: ${key} Major (${text})`;

    // Handle image display with enharmonic fallback
    let enharmonicKeyUsed = null;
    let imageInfo = KEY_SIGNATURE_IMAGES[key];
    // If no direct image, check for an enharmonic equivalent
    if (!imageInfo) {
        const enharmonicKey = ENHARMONIC_MAP[key];
        if (enharmonicKey) {
            imageInfo = KEY_SIGNATURE_IMAGES[enharmonicKey];
            enharmonicKeyUsed = enharmonicKey;
        }
    }

    if (imageInfo && trebleImg) {
        // Use absolute path for consistent loading across environments
        const newSrc = `/key_signatures/${imageInfo.treble}`;

        // Only update if the src is actually different to avoid unnecessary reloads
        if (trebleImg.src !== newSrc && !trebleImg.src.endsWith(imageInfo.treble)) {
            trebleImg.style.opacity = '1'; // Reset opacity in case of previous error
            trebleImg.src = newSrc;
        }
    }

    // Show the enharmonic label if an equivalent key was used for the image
    enharmonicLabel.textContent = enharmonicKeyUsed;
    enharmonicLabel.classList.toggle('hidden', !enharmonicKeyUsed);

    // Handle relative minor display
    const relativeMinor = RELATIVE_MINOR_MAP[key];
    if (relativeMinor && relativeMinorDisplay) {
        relativeMinorDisplay.textContent = relativeMinor;
        relativeMinorDisplay.title = `Relative minor of ${key} Major`;
    }
}

/**
 * Toggle display panel visibility
 * Note: This function may not be currently used in the codebase
 */
export function toggleDisplayPanel() {
    // Implementation placeholder - add logic if needed
    // This function was mentioned in requirements but not found in original code
    console.warn('toggleDisplayPanel not yet implemented');
}

/**
 * Setup responsive title
 * Previously abbreviated to "IMTL" when wrapping - now always shows full title
 */
export function setupResponsiveTitle() {
    const titleElement = document.getElementById('main-title');
    if (!titleElement) return;

    const fullText = "Interactive Music Theory Lab";

    // Function to ensure title is set correctly
    function updateTitle() {
        // Check if title has HTML content (tab title format) or just text (base title)
        const hasHTML = titleElement.children.length > 0;

        if (hasHTML) {
            // Tab title format - preserve any tab-specific span
            const tabTitleSpan = titleElement.querySelector('span');
            if (tabTitleSpan) {
                const spanClasses = tabTitleSpan.className;
                const spanText = tabTitleSpan.textContent;
                titleElement.innerHTML = `${fullText}:<br><span class="${spanClasses}">${spanText}</span>`;
            }
        } else {
            // Base title format: just text - always use full text
            titleElement.textContent = fullText;
        }
    }
    
    // Expose update function globally so tabs.js can call it after updating title
    window.updateResponsiveTitle = updateTitle;
    
    // Initial check
    updateTitle();
    
    // Use ResizeObserver to watch for size changes
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            updateTitle();
        });
        
        // Observe the title element and its parent container
        resizeObserver.observe(titleElement);
        if (titleElement.parentElement) {
            resizeObserver.observe(titleElement.parentElement);
        }
        
        // Also observe the header to catch layout changes
        const header = document.getElementById('main-header');
        if (header) {
            resizeObserver.observe(header);
        }
    } else {
        // Fallback: use window resize event
        window.addEventListener('resize', updateTitle);
    }
    
    // Also check after a short delay to catch any layout changes
    setTimeout(updateTitle, 100);
    setTimeout(updateTitle, 500);
}
