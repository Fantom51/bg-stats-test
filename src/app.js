console.log('🚀 app.js начал загружаться');
import { FirebaseClient } from '/bg-stats-test/src/core/firebase-client.js';
import { GameStatsManager } from '/bg-stats-test/src/modules/stats/GameStatsManager.js';
import { GamesCatalog } from '/bg-stats-test/src/modules/games/GamesCatalog.js';
import { BGGRatingsService } from './modules/games/BGGRatingsService.js';
import { StorageManager } from '/bg-stats-test/src/core/storage.js';
import { SPARouter } from '/bg-stats-test/src/core/router.js';
import { PlayersManager } from '/bg-stats-test/src/modules/players/PlayersManager.js';
import { PlayersService } from '/bg-stats-test/src/modules/players/players.service.js';
import { PlayersTable } from '/bg-stats-test/src/ui/components/PlayersTable.js';
import { PlayerProfile } from '/bg-stats-test/src/modules/players/PlayerProfile.js';
import { SessionsManager } from '/bg-stats-test/src/modules/sessions/SessionsManager.js';
import { SessionsService } from '/bg-stats-test/src/modules/sessions/sessions.service.js';

class BoardGamesStats {
    constructor() {
        console.log('🚀 app.js - создание BoardGamesStats');
        // В начале app.js, после объявления класса
            console.log('=== GITHUB PAGES ДИАГНОСТИКА ===');
            console.log('Hostname:', window.location.hostname);
            console.log('Pathname:', window.location.pathname);
            console.log('Полный URL:', window.location.href);
            console.log('Части пути:', window.location.pathname.split('/'));
            console.log('Имя репозитория (предполагаемое):', window.location.pathname.split('/')[1] || 'bg-stats-test');
        
        // 🔥 ШАГ 1: БАЗОВЫЕ КОМПОНЕНТЫ
        this.firebase = new FirebaseClient();
        this.storage = new StorageManager();
        
        // 🔥 ШАГ 2: СОЗДАЕМ МЕНЕДЖЕРЫ В ПРАВИЛЬНОМ ПОРЯДКЕ!
        this.playersManager = new PlayersManager(this.firebase);
        this.sessionsManager = new SessionsManager(this.firebase, this.storage); // СНАЧАЛА!
        
        // 🔥 ШАГ 3: GameStatsManager (ТЕПЕРЬ sessionsManager СУЩЕСТВУЕТ!)
        this.gameStatsManager = null;
        
        // 🔥 ШАГ 4: ОСТАЛЬНЫЕ КОМПОНЕНТЫ
        this.playersService = new PlayersService(this.playersManager);
        this.playersTable = new PlayersTable(this.playersManager, this.playersService);
        this.playerProfile = null;
        this.bggRatingsService = new BGGRatingsService();
        this.gamesCatalog = null;
        this.sessionsService = null;
        this.router = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Упрощенная инициализация...');
        
        try {
            // 🔥 1. ТОЛЬКО ОСНОВНЫЕ КОМПОНЕНТЫ
            this.firebase = new FirebaseClient();
            this.storage = new StorageManager();
            
            // 🔥 2. Firebase БЕЗ ОЖИДАНИЯ (может не работать)
            try {
                // УБРАЛ .catch() - вызываем напрямую
                this.firebase.initialize();
                console.log('✅ Firebase инициализирован');
            } catch (err) {
                console.warn('⚠️ Firebase не подключен, работаем локально');
            }
            
            // 🔥 3. ИГРОКИ И СЕССИИ ИЗ LOCALSTORAGE
            this.playersManager = new PlayersManager(this.firebase);
            await this.playersManager.loadPlayers();
            
            this.sessionsManager = new SessionsManager(this.firebase, this.storage);
            await this.sessionsManager.init();
            
            // 🔥 4. GameStatsManager С ФИКСИРОВАННЫМ МЕТОДОМ
            this.gameStatsManager = new GameStatsManager(
                this.storage,
                this.sessionsManager,
                this.playersManager
            );
            
            // 🔥 5. ДОБАВЛЯЕМ ОТСУТСТВУЮЩИЙ МЕТОД ЕСЛИ НЕТ
            if (!this.gameStatsManager.getAllGameStats) {
                this.gameStatsManager.getAllGameStats = function() {
                    return this.gameStats || {};
                };
                console.log('🔧 Метод getAllGameStats добавлен динамически');
            }
            
            // 🔥 6. БЫСТРЫЙ СТАРТ РОУТЕРА
            this.setupRouter();
            this.setupGlobalHandlers();
            window.app = this;
            
            await this.router.loadRoute();
            
            console.log('✅ Приложение запущено (упрощенная версия)');
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            // Минимальный интерфейс
            document.getElementById('app').innerHTML = `
                <div style="padding: 20px;">
                    <h2>🎮 Статистика настольных игр</h2>
                    <p>Приложение загружено. Некоторые функции могут быть ограничены.</p>
                </div>
            `;
        }
    }
        
    setupRouter() {
        const routes = [
            { path: '/', init: () => this.initHomePage(), title: 'Players Management' },
            { path: '/games', init: () => this.initGamesPage(), title: 'Games' },
            {path: '/sessions', init: () => app.initSessionsPage(), title: 'Sessions'},
            { path: '/stats', init: () => this.initStatsPage(), title: 'Статистика' },
            { path: '/player/:id', init: () => app.initPlayerProfile(), title: 'Профиль игрока' },
            { path: '/about', init: this.initAboutPage, title: 'About' }
        ];

        this.router = new SPARouter(routes, this);
    }

    setupGlobalHandlers() {
        window.addEventListener('beforeunload', () => {
            this.playersManager.saveToStorage();
        });
    }

    // ИНИЦИАЛИЗАЦИЯ СТРАНИЦ

    initStatsPage() {
        console.log('📊 INIT STATS PAGE');
        
        // 🔥 ПРОВЕРЯЕМ window.app
        if (!window.app) {
            console.error('❌ window.app не найден');
            return;
        }
        
        // 🔥 ПРОВЕРЯЕМ ВСЕ МЕНЕДЖЕРЫ
        console.log('✅ playersManager доступен:', !!window.app.playersManager);
        console.log('✅ sessionsManager доступен:', !!window.app.sessionsManager);
        console.log('✅ gameStatsManager доступен:', !!window.app.gameStatsManager);
        
        // 🔥 ПРОВЕРЯЕМ МЕТОДЫ
        if (window.app.playersManager?.getAllPlayers) {
            const players = window.app.playersManager.getAllPlayers();
            console.log('👥 Игроков получено:', players.length);
        }
        
        // 🔥 ПРОВЕРЯЕМ КОНТЕЙНЕРЫ
        setTimeout(() => {
            const playersRanking = document.getElementById('players-ranking');
            console.log('📌 Контейнер players-ranking найден:', !!playersRanking);
            
            if (window.app.gameStatsManager?.renderStatsPage) {
                console.log('🔄 Вызываю renderStatsPage...');
                window.app.gameStatsManager.renderStatsPage();
            } else {
                console.error('❌ GameStatsManager.renderStatsPage не найден');
            }
        }, 100);
    }

    initHomePage() {
        console.log('🔄 INIT HOME PAGE');
        
        const checkInterval = setInterval(() => {
            const playersTable = document.getElementById('players-table-body');
            if (playersTable) {
                clearInterval(checkInterval);
                this.initializeHomePage();
            }
        }, 50);
    }

    initializeHomePage() {
        this.playersTable.updateTable();
        this.setupPlayerForm();
    }

    setupPlayerForm() {
        const form = document.getElementById('add-player-form');
        if (form) {
            form.onsubmit = (event) => this.handleFormSubmit(event);
        }
    }

    handleFormSubmit(event) {
        event.preventDefault();
        const nameInput = document.getElementById('player-name-input');
        if (!nameInput) return false;

        const nameValue = nameInput.value.trim();
        if (nameValue === '') {
            alert('Пожалуйста, введите имя игрока');
            return false;
        }

        this.playersManager.createPlayer(nameValue);
        nameInput.value = '';
        this.playersTable.updateTable();
        return false;
    }

    async initGamesPage() {
        console.log('🎮 INIT GAMES PAGE');
        
        // 🔥 БЫСТРАЯ ПРОВЕРКА - ЕСЛИ УЖЕ ЗАГРУЖЕНО, ПРОСТО РЕНДЕРИМ
        if (this.gamesCatalog && this.gamesCatalog.isInitialized) {
            console.log('✅ GamesCatalog уже инициализирован - быстрый рендер');
            this.gamesCatalog.renderGames();
            return;
        }
        
        if (!this.gamesCatalog) {
            console.log('🔄 Создаю GamesCatalog...');
            this.gamesCatalog = new GamesCatalog(this.sessionsManager, this.bggRatingsService, this.gameStatsManager);
        }
        
        // 🔥 НЕ ЖДЕМ BGG РЕЙТИНГОВ - СТРАНИЦА МОЖЕТ ПОКАЗАТЬСЯ РАНЬШЕ
        await this.gamesCatalog.init();
        console.log('✅ GamesCatalog загружен');
    }

    initAboutPage() {
        console.log('Initializing ABOUT page...');
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = '<p>About our application</p>';
        }
    }

    initSessionsPage() {
        console.log('🎪 Initializing sessions page...');
        
        // 🔥 ПРОВЕРЯЕМ БЫСТРО - БЕЗ setTimeout
        if (!this.sessionsManager.isInitialized) {
            console.error('❌ SessionsManager не инициализирован');
            return;
        }
        
        console.log('🔍 Создаю SessionsService...');
        
        this.sessionsService = new SessionsService(
            this.sessionsManager, 
            this.gamesCatalog, // 🔥 УЖЕ ДОЛЖЕН БЫТЬ СОЗДАН
            this.playersManager
        );
        
        this.sessionsService.setupSessionForm('add-session-form');
        this.sessionsService.renderSessionsList('sessions-list');
        this.sessionsService.updateStats();
        
        console.log('✅ Страница сессий инициализирована');
    }
    
    initPlayerProfile() {
        console.log('🎯 INIT PLAYER PROFILE');
        
        const playerId = this.getPlayerIdFromURL();
        
        if (!this.playerProfile) {
            this.playerProfile = new PlayerProfile(
                this.playersManager,
                this.sessionsManager, 
                this.gameStatsManager,
                this.sessionsService
            );
        }
        
        this.playerProfile.init(playerId);
    }

    getPlayerIdFromURL() {
        const hash = window.location.hash;
        console.log('🔍 [ROUTER] Текущий hash:', hash);
        
        // 🔥 ИЩЕМ КАК ЧИСЛОВЫЕ ТАК И СТРОКОВЫЕ ID
        const match = hash.match(/\/player\/([^\/]+)/);
        
        if (match) {
            const id = match[1];
            console.log('🔍 [ROUTER] Найден ID из URL:', id);
            
            // 🔥 ПРОВЕРЯЕМ, ЧТО ИГРОК С ТАКИМ ID СУЩЕСТВУЕТ
            const player = this.playersManager.getPlayer(id);
            console.log('🔍 [ROUTER] Игрок найден в менеджере:', player);
            
            return id; // 🔥 ВОЗВРАЩАЕМ СТРОКОВЫЙ ID
        }
        
        console.log('🔍 [ROUTER] ID не найден в URL');
        return null;
    }

}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    new BoardGamesStats();
});