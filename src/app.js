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
        
        // ТОЛЬКО объявляем переменные, НЕ создаем экземпляры
        this.firebase = null;
        this.storage = null;
        this.playersManager = null;
        this.sessionsManager = null;
        this.gameStatsManager = null;
        this.gamesCatalog = null; // ← ДОБАВИЛИ!
        this.sessionsService = null;
        this.playerProfile = null;
        this.bggRatingsService = null;
        this.playersService = null;
        this.playersTable = null;
        this.router = null;
        
        this.init(); // Запускаем инициализацию
    }

    async init() {
        console.log('🚀 Упрощенная инициализация...');
        
        try {
            // 1. БАЗОВЫЕ КОМПОНЕНТЫ (создаем ОДИН РАЗ)
            this.firebase = new FirebaseClient();
            this.storage = new StorageManager();
            
            // 2. Firebase
            try {
                this.firebase.initialize();
                console.log('✅ Firebase инициализирован');
            } catch (err) {
                console.warn('⚠️ Firebase не подключен, работаем локально');
            }
            
            // 3. ИГРОКИ И СЕССИИ
            this.playersManager = new PlayersManager(this.firebase);
            await this.playersManager.loadPlayers();
            
            this.sessionsManager = new SessionsManager(this.firebase, this.storage);
            await this.sessionsManager.init();
            
            // 4. GameStatsManager
            this.gameStatsManager = new GameStatsManager(
                this.storage,
                this.sessionsManager,
                this.playersManager
            );
            
            // 5. GamesCatalog - СОЗДАЕМ СРАЗУ!
            this.bggRatingsService = new BGGRatingsService();
            this.gamesCatalog = new GamesCatalog(
                this.sessionsManager,
                this.bggRatingsService,
                this.gameStatsManager  // ← ПЕРЕДАЕМ gameStatsManager!
            );
            
            // 6. SessionsService - СОЗДАЕМ СРАЗУ!
            this.sessionsService = new SessionsService(
                this.sessionsManager,
                this.gamesCatalog,      // ← Теперь gamesCatalog существует!
                this.playersManager
            );
            
            // 7. ОСТАЛЬНЫЕ КОМПОНЕНТЫ
            this.playersService = new PlayersService(this.playersManager);
            this.playersTable = new PlayersTable(this.playersManager, this.playersService);
            this.playerProfile = new PlayerProfile(
                this.playersManager,
                this.sessionsManager,
                this.gameStatsManager,
                this.sessionsService
            );
            
            // 8. РОУТЕР И ЗАВЕРШЕНИЕ
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
        
        if (!this.gamesCatalog.isInitialized) {
            await this.gamesCatalog.init();
        }
        
        this.gamesCatalog.renderGames();
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
        
        // SessionsService уже создан в init()
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