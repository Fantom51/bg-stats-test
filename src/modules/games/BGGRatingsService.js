export class BGGRatingsService {
    constructor() {
        this.ratings = new Map();
        this.isLoaded = false;
    }

    async loadRatings() {
        if (this.isLoaded) return;
        
        try {
            const response = await fetch('/assets/data/bgg-ratings.json');
            const data = await response.json();
            this.ratings = new Map(Object.entries(data));
            this.isLoaded = true;
            console.log(`✅ Загружено ${this.ratings.size} рейтингов BGG`);
        } catch (error) {
            console.error('❌ Не удалось загрузить рейтинги BGG:', error);
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