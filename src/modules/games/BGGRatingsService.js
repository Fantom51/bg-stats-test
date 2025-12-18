// frontend/modules/games/BGGRatingsService.js
class BGGRatingsService {
    constructor() {
        this.ratings = new Map();
        this.isLoaded = false;
        
        // Автоматически загружаем данные
        this.loadBggRatings();
    }
    
    async loadBggRatings() {
        try {
            console.log('🌐 Загрузка BGG рейтингов...');
            
            // 🔥 ИСПРАВЛЕНИЕ: используем PathResolver
            const path = PathResolver.resolve('./assets/data/bgg-ratings.json');
            console.log('📁 Загружаю по пути:', path);
            
            const response = await fetch(path);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Загружено ${Object.keys(data).length} BGG рейтингов`);
            
            // Конвертируем в Map
            for (const [game, rating] of Object.entries(data)) {
                this.ratings.set(game, rating);
            }
            
            this.isLoaded = true;
            
            // Для отладки: показываем несколько примеров
            const sample = Array.from(this.ratings.entries()).slice(0, 3);
            console.log('📊 Примеры:', sample);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки BGG рейтингов:', error);
            
            // Fallback: создаем минимальный набор рейтингов
            console.log('🛠️ Создаю fallback рейтинги...');
            this.ratings = new Map([
                ["7 Wonders", 7.8],
                ["Carcassonne", 7.4],
                ["Codenames", 7.8],
                ["Dixit", 7.3],
                ["Loonacy", 5.8],
                ["Ticket to Ride", 7.5],
                ["Pandemic", 7.6],
                ["Catan", 7.2]
            ]);
            
            this.isLoaded = true;
        }
    }
    
    getRating(gameName) {
        if (!this.isLoaded) {
            console.warn('⚠️ BGGRatingsService еще не загружен');
            return null;
        }
        
        // Прямой поиск
        if (this.ratings.has(gameName)) {
            return this.ratings.get(gameName);
        }
        
        // Попробуем нормализовать имя для поиска
        const normalizedSearch = this.normalizeName(gameName);
        
        for (const [bggName, rating] of this.ratings.entries()) {
            if (this.normalizeName(bggName) === normalizedSearch) {
                console.log(`🔍 Найден рейтинг для "${gameName}" → "${bggName}": ${rating}`);
                return rating;
            }
        }
        
        console.log(`❌ Рейтинг для "${gameName}" не найден`);
        return null;
    }
    
    normalizeName(name) {
        return name.toLowerCase()
            .replace(/[.:«»"',-]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    getAllRatings() {
        return Object.fromEntries(this.ratings);
    }
}