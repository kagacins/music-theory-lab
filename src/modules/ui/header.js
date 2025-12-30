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

    // Detect if this is a minor key
    const isMinor = key.endsWith('m') && !key.endsWith('dim') && !key.endsWith('dom');

    // Get the relative major for minor keys (e.g., Gm -> Bb)
    // Minor key relative majors (same key signatures)
    const RELATIVE_MAJOR_MAP = {
        'Am': 'C', 'Em': 'G', 'Bm': 'D', 'F#m': 'A', 'C#m': 'E', 'G#m': 'B', 'D#m': 'F#', 'A#m': 'C#',
        'Dm': 'F', 'Gm': 'Bb', 'Cm': 'Eb', 'Fm': 'Ab', 'Bbm': 'Db', 'Ebm': 'Gb', 'Abm': 'Cb'
    };

    // Get the key to look up in KEY_SIGNATURE_TEXT (use relative major for minor keys)
    const lookupKey = isMinor ? RELATIVE_MAJOR_MAP[key] : key;
    const text = KEY_SIGNATURE_TEXT[lookupKey] || KEY_SIGNATURE_TEXT[key] || "Unknown Key";

    // Display with correct mode (Major or Minor)
    if (isMinor) {
        const keyRoot = key.slice(0, -1); // Remove 'm' suffix
        textDisplay.textContent = `Key: ${keyRoot} Minor (${text})`;
    } else {
        textDisplay.textContent = `Key: ${key} Major (${text})`;
    }

    // Handle image display - use relative major key for minor keys
    const imageKey = isMinor ? RELATIVE_MAJOR_MAP[key] : key;
    let enharmonicKeyUsed = null;
    let imageInfo = KEY_SIGNATURE_IMAGES[imageKey];

    // If no direct image, check for an enharmonic equivalent
    if (!imageInfo) {
        const enharmonicKey = ENHARMONIC_MAP[imageKey];
        if (enharmonicKey) {
            imageInfo = KEY_SIGNATURE_IMAGES[enharmonicKey];
            enharmonicKeyUsed = enharmonicKey;
        }
    }

    if (imageInfo && trebleImg) {
        // Use absolute path for consistent loading across environments
        const newSrc = `/key_signatures/${imageInfo.treble}`;

        // Only update if the src is actually different to avoid unnecessary reloads
        // Note: trebleImg.src is a full URL, so we check the filename
        if (!trebleImg.src.endsWith(imageInfo.treble)) {
            // Reset opacity and set up proper load/error handlers
            trebleImg.style.opacity = '0.3'; // Start faded until loaded

            // Set up load handler to show image when it loads successfully
            trebleImg.onload = () => {
                trebleImg.style.opacity = '1';
            };

            // Set up error handler (backup for HTML onerror)
            trebleImg.onerror = () => {
                trebleImg.style.opacity = '0.3';
                console.warn(`Failed to load key signature image: ${newSrc}`);
            };

            trebleImg.src = newSrc;
        }
    }

    // Show the enharmonic label if an equivalent key was used for the image
    if (enharmonicLabel) {
        enharmonicLabel.textContent = enharmonicKeyUsed || '';
        enharmonicLabel.classList.toggle('hidden', !enharmonicKeyUsed);
    }

    // Handle relative key display
    if (relativeMinorDisplay) {
        if (isMinor) {
            // For minor keys, show the relative MAJOR
            const relativeMajor = RELATIVE_MAJOR_MAP[key];
            if (relativeMajor) {
                relativeMinorDisplay.textContent = `${relativeMajor} Major`;
                relativeMinorDisplay.title = `Relative major of ${key.slice(0, -1)} Minor`;
            }
        } else {
            // For major keys, show the relative minor
            const relativeMinor = RELATIVE_MINOR_MAP[key];
            if (relativeMinor) {
                relativeMinorDisplay.textContent = relativeMinor;
                relativeMinorDisplay.title = `Relative minor of ${key} Major`;
            }
        }
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
