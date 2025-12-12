/**
 * Storage Utilities Module
 * Handles LocalStorage operations with error handling and compression
 */

const STORAGE_PREFIX = 'musicTheoryLab_';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Save data to LocalStorage
 * @param {string} key - Storage key (will be prefixed)
 * @param {any} data - Data to store (will be JSON stringified)
 * @returns {boolean} Success status
 */
export function saveToStorage(key, data) {
    try {
        const fullKey = STORAGE_PREFIX + key;
        const jsonString = JSON.stringify(data);

        // Check storage size
        if (jsonString.length > MAX_STORAGE_SIZE) {

            return false;
        }

        localStorage.setItem(fullKey, jsonString);
        return true;
    } catch (error) {

        if (error.name === 'QuotaExceededError') {

        }
        return false;
    }
}

/**
 * Load data from LocalStorage
 * @param {string} key - Storage key (will be prefixed)
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Parsed data or default value
 */
export function loadFromStorage(key, defaultValue = null) {
    try {
        const fullKey = STORAGE_PREFIX + key;
        const jsonString = localStorage.getItem(fullKey);

        if (jsonString === null) {
            return defaultValue;
        }

        return JSON.parse(jsonString);
    } catch (error) {

        return defaultValue;
    }
}

/**
 * Remove data from LocalStorage
 * @param {string} key - Storage key (will be prefixed)
 * @returns {boolean} Success status
 */
export function removeFromStorage(key) {
    try {
        const fullKey = STORAGE_PREFIX + key;
        localStorage.removeItem(fullKey);
        return true;
    } catch (error) {

        return false;
    }
}

/**
 * Get all keys with our prefix
 * @returns {string[]} Array of keys (without prefix)
 */
export function getAllKeys() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                keys.push(key.substring(STORAGE_PREFIX.length));
            }
        }
        return keys;
    } catch (error) {

        return [];
    }
}

/**
 * Clear all app data from LocalStorage
 * @returns {boolean} Success status
 */
export function clearAllStorage() {
    try {
        const keys = getAllKeys();
        keys.forEach(key => removeFromStorage(key));
        return true;
    } catch (error) {

        return false;
    }
}

/**
 * Get storage usage statistics
 * @returns {object} Storage stats
 */
export function getStorageStats() {
    try {
        let totalSize = 0;
        const keys = getAllKeys();

        keys.forEach(key => {
            const fullKey = STORAGE_PREFIX + key;
            const item = localStorage.getItem(fullKey);
            if (item) {
                totalSize += item.length;
            }
        });

        return {
            itemCount: keys.length,
            totalSize: totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            percentUsed: ((totalSize / MAX_STORAGE_SIZE) * 100).toFixed(2)
        };
    } catch (error) {

        return {
            itemCount: 0,
            totalSize: 0,
            totalSizeKB: '0',
            totalSizeMB: '0',
            percentUsed: '0'
        };
    }
}

/**
 * Check if LocalStorage is available
 * @returns {boolean} Whether LocalStorage is available
 */
export function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        return false;
    }
}
