export class BGGRatingsService {
    constructor() {
        this.ratings = new Map(); // Оставляем Map
        this.isLoaded = false;
    }

    async loadRatings() {
        try {
            console.log('🔄 Загружаю BGG рейтинги...');
            const repoName = 'bg-stats-test';
            const response = await fetch(`/${repoName}/assets/data/bgg-ratings.json`);          
            
            if (!response.ok) {
                console.log('⚠️ BGG файл не загрузился, работаем без рейтингов');
                this.isLoaded = true; // Все равно помечаем как загружено
                return;
            }
            
            const text = await response.text();
            
            if (!text.trim().startsWith('{')) {
                console.log('⚠️ Файл не JSON, работаем без рейтингов');
                this.isLoaded = true;
                return;
            }
            
            const ratings = JSON.parse(text);
            
            // 🔥 ИСПРАВЛЕНИЕ 1: Конвертируем объект в Map
            this.ratings = new Map(Object.entries(ratings));
            
            // 🔥 ИСПРАВЛЕНИЕ 2: Помечаем как загружено
            this.isLoaded = true;
            
            console.log(`✅ Загружено ${this.ratings.size} рейтингов BGG`);
            
        } catch (error) {
            console.log('⚠️ Ошибка загрузки BGG, работаем без рейтингов:', error.message);
            this.isLoaded = true; // Все равно помечаем
        }
    }

    getRating(gameName) {
        // 🔥 УБРАТЬ проверку isLoaded если хотим всегда искать
        if (!gameName || !this.isLoaded) return null;
        
        // 1. Точное совпадение
        const exactMatch = this.ratings.get(gameName);
        if (exactMatch) return exactMatch;
        
        // 2. Совпадение с триммингом пробелов
        const trimmedName = gameName.trim();
        if (trimmedName !== gameName) {
            const trimmedMatch = this.ratings.get(trimmedName);
            if (trimmedMatch) return trimmedMatch;
        }
        
        // 3. Нижний регистр
        const lowerCaseName = gameName.toLowerCase();
        for (let [key, value] of this.ratings) {
            if (key.toLowerCase() === lowerCaseName) {
                return value;
            }
        }
        
        return null;
    }
    
    // 🔥 ДОБАВИТЬ метод для отладки
    getAllRatings() {
        return Object.fromEntries(this.ratings);
    }
}