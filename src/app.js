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
        this.gameStatsManager = new GameStatsManager(
            this.storage,
            this.sessionsManager,  // 🔥 ДОБАВЛЯЕМ
            this.playersManager    // 🔥 ДОБАВЛЯЕМ
        );
        
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
        console.log('🚀 Начало инициализации приложения...');
        
        try {
            // 🔥 ШАГ 1: Инициализация Firebase
            console.log('🔥 Инициализация Firebase...');
            await this.firebase.initialize();
            console.log('✅ Firebase успешно подключен');

            // 🔥 ШАГ 2: Загрузка игроков
            console.log('👥 Загрузка игроков...');
            await this.playersManager.loadPlayers();
            console.log('✅ Игроки загружены');

            // 🔥 ШАГ 3: Инициализация сессий (ВАЖНО: ДО GameStatsManager!)
            console.log('🎪 Инициализация сессий...');
            await this.sessionsManager.init();
            const sessionCount = this.sessionsManager.sessions.length;
            console.log(`✅ Сессии инициализированы: ${sessionCount} сессий`);

            // 🔥 ШАГ 4: GameStatsManager - ПЕРЕСОЗДАЁМ С ЗАГРУЖЕННЫМИ ДАННЫМИ
            console.log('📊 Создание GameStatsManager...');
            
            // Если уже есть - очищаем
            if (this.gameStatsManager) {
                this.gameStatsManager = null;
            }
            
            // Создаем новый
            this.gameStatsManager = new GameStatsManager(
                this.storage,
                this.sessionsManager,
                this.playersManager
            );
            
            // 🔥 ШАГ 5: ВЫЧИСЛЯЕМ СТАТИСТИКУ СРАЗУ И ЖДЁМ!
            console.log('🔄 Вычисление статистики...');
            this.gameStatsManager.calculateAllGameStats();
            
            // 🔥 ЖДЁМ пока статистика вычислится
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Проверяем результат
            const gameStats = this.gameStatsManager.getAllGameStats();
            console.log(`📈 Статистика вычислена: ${Object.keys(gameStats).length} игр`);
            
            if (Object.keys(gameStats).length > 0) {
                const sampleGame = Object.keys(gameStats)[0];
                console.log(`📊 Пример статистики для "${sampleGame}":`, {
                    totalPlays: gameStats[sampleGame].totalPlays,
                    topPlayers: gameStats[sampleGame].topPlayers?.slice(0, 2)
                });
            }

            // 🔥 ШАГ 6: Запуск роутера
            console.log('🔄 Настройка роутера...');
            this.setupRouter();
            this.setupGlobalHandlers();
            window.app = this;
            
            console.log('🎉 Приложение готово, запускаем роутер...');
            await this.router.loadRoute();

            // 🔥 ШАГ 7: ПРЕДЗАГРУЗКА GamesCatalog СО СТАТИСТИКОЙ
            console.log('🔄 Создание GamesCatalog со статистикой...');
            this.gamesCatalog = new GamesCatalog(
                this.sessionsManager, 
                this.bggRatingsService, 
                this.gameStatsManager  // 🔥 СТАТИСТИКА УЖЕ ГОТОВА!
            );
            
            await this.gamesCatalog.init();
            console.log('✅ GamesCatalog создан со статистикой');
            
            // 🔥 ШАГ 8: Фоновая загрузка BGG рейтингов
            console.log('🎲 Фоновая загрузка рейтингов BGG...');
            await this.bggRatingsService.loadRatings();
            console.log('✅ Рейтинги BGG готовы');
            
            // Улучшаем игры рейтингами
            if (this.gamesCatalog) {
                this.gamesCatalog.enhanceGamesWithBggRatings();
                console.log('🎯 Игры улучшены BGG рейтингами');
            }
            
            // 🔥 ШАГ 9: ОБНОВЛЯЕМ UI ЕСЛИ МЫ НА СТРАНИЦЕ ИГР
            if (window.location.hash.includes('#/games')) {
                console.log('🔄 Обновляем страницу игр со статистикой...');
                if (this.gamesCatalog) {
                    // 🔥 ПЕРЕРИСОВЫВАЕМ ВСЕ КАРТОЧКИ
                    this.gamesCatalog.renderGames();
                    
                    // 🔥 ПРОВЕРКА: показываем статистику в консоли для отладки
                    setTimeout(() => {
                        const gameCards = document.querySelectorAll('.game-card');
                        console.log(`🎮 Отображено карточек: ${gameCards.length}`);
                        
                        if (gameCards.length > 0) {
                            console.log('📊 Проверка первой карточки:');
                            const firstCard = gameCards[0];
                            const gameName = firstCard.querySelector('.game-title')?.textContent;
                            console.log('   Игра:', gameName);
                            
                            if (gameName && this.gamesCatalog.gameStatsManager) {
                                const stats = this.gamesCatalog.gameStatsManager.getGameStats(gameName);
                                console.log('   Статистика:', stats ? `${stats.totalPlays} сессий` : 'НЕТ');
                            }
                        }
                    }, 500);
                }
            }
            
            console.log('🏁 Инициализация завершена успешно!');

        } catch (error) {
            console.error('❌ Ошибка инициализации приложения:', error);
            
            // Показываем ошибку пользователю
            const appContainer = document.getElementById('app');
            if (appContainer) {
                appContainer.innerHTML = `
                    <div style="padding: 20px; color: red; text-align: center;">
                        <h3>❌ Ошибка загрузки приложения</h3>
                        <p>${error.message}</p>
                        <button onclick="location.reload()" style="
                            background: #ff6b6b;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            margin-top: 10px;
                        ">🔄 Перезагрузить страницу</button>
                    </div>
                `;
            }
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