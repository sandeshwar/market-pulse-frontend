import feather from 'feather-icons';

/**
 * Singleton instance of Feather Icons
 * @type {Object|null}
 */
let featherInstance = null;

// Preload Feather icons
initFeather().catch(error => console.error('Failed to preload Feather icons:', error));

/**
 * Initialize Feather Icons library
 * @returns {Promise<Object>} Initialized Feather instance
 * @throws {Error} If initialization fails
 */
export async function initFeather() {
    if (!featherInstance) {
        try {
            featherInstance = feather;

            if (!featherInstance?.replace) {
                throw new Error('Invalid Feather icons instance - missing replace method');
            }
        } catch (error) {
            console.error('Failed to initialize Feather icons:', error);
            throw error;
        }
    }
    return featherInstance;
}

/**
 * Replace all [data-feather] elements with SVG icons
 * @returns {Promise<void>}
 */
export async function replaceIcons() {
    try {
        const instance = await initFeather();
        instance.replace();
    } catch (error) {
        console.error('Failed to replace icons:', error);
        throw error;
    }
}

/**
 * Get a specific icon's SVG string
 * @param {string} name - Icon name
 * @param {Object} [attrs={}] - Additional attributes for the icon
 * @returns {Promise<string>} SVG string for the icon
 */
export async function getIcon(name, attrs = {}) {
    try {
        const instance = await initFeather();
        return instance.icons[name]?.toSvg(attrs);
    } catch (error) {
        console.error(`Failed to get icon ${name}:`, error);
        throw error;
    }
}