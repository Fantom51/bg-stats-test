console.log('📦 storage.js загружается');

export class StorageManager {
    constructor() {
        this.prefix = 'bgstats_';
    }

    get(key, defaultValue = null) {
        try {
            const fullKey = this.prefix + key;
            const item = localStorage.getItem(fullKey);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('❌ Storage error:', error);
            return defaultValue;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('❌ Storage error:', error);
            return false;
        }
    }
}
