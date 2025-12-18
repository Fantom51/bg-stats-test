export class BGGRatingsService {
    constructor() {
        this.ratings = new Map();
        this.isLoaded = false;
    }

    async loadRatings() {
        try {
            console.log('🔄 Загружаю BGG рейтинги...');
            const response = await fetch('./assets/data/bgg-ratings.json');
            
            if (!response.ok) {
                console.log('⚠️ BGG файл не загрузился, работаем без рейтингов');
                return {};
            }
            
            const text = await response.text();
            
            // Проверяем что это JSON
            if (!text.trim().startsWith('{')) {
                console.log('⚠️ Файл не JSON, работаем без рейтингов');
                return {};
            }
            
            const ratings = JSON.parse(text);
            console.log(`✅ Загружено ${Object.keys(ratings).length} рейтингов BGG`);
            return ratings;
            
        } catch (error) {
            console.log('⚠️ Ошибка загрузки BGG, работаем без рейтингов:', error.message);
            return {};
        }
    }

    getRating(gameName) {
        if (!gameName || !this.isLoaded) return null;
        
        // 1. Точное совпадение (самый частый случай)
        const exactMatch = this.ratings.get(gameName);
        if (exactMatch) return exactMatch;
        
        // 2. Совпадение с триммингом пробелов
        const trimmedName = gameName.trim();
        if (trimmedName !== gameName) {
            const trimmedMatch = this.ratings.get(trimmedName);
            if (trimmedMatch) return trimmedMatch;
        }
        
        // 3. Нижний регистр (если все остальное не сработало)
        const lowerCaseName = gameName.toLowerCase();
        for (let [key, value] of this.ratings) {
            if (key.toLowerCase() === lowerCaseName) {
                return value;
            }
        }
        
        return null;
    }
}