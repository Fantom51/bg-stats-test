// src/modules/stats/GameStatsManager.js
export class GameStatsManager {
    constructor(storageManager, sessionsManager, playersManager) {
        this.storage = storageManager;
        this.sessionsManager = sessionsManager;
        this.playersManager = playersManager;
        
        console.log('📊 GameStatsManager создается...');
        console.log('🎪 sessionsManager передан:', !!sessionsManager);
        console.log('👥 playersManager передан:', !!playersManager);
        
        // 🔥 СНАЧАЛА загружаем сохраненную статистику
        const savedStats = this.loadGameStats();
        console.log('💾 Загружено из storage:', Object.keys(savedStats).length, 'игр');
        
        // 🔥 ЕСЛИ статистики нет или мало - вычисляем из сессий
        if (Object.keys(savedStats).length === 0) {
            console.log('🔄 Статистика пустая - вычисляем из сессий...');
            this.gameStats = {};
            this.calculateAllGameStats();
        } else {
            console.log('✅ Используем сохраненную статистику');
            this.gameStats = savedStats;
        }
        
        console.log('📊 Итог: статистика для', Object.keys(this.gameStats).length, 'игр');
        setTimeout(() => {
            if (Object.keys(this.gameStats).length === 0) {
                console.log('🔄 Автоматически вычисляю статистику...');
                this.calculateAllGameStats();
            }
        }, 1000);
    }

    loadGameStats() {
        const stats = this.storage.get('gameStatistics', {});
        console.log('📊 Загружена статистика игр:', stats);
        return stats;
    }

    saveGameStats() {
        this.storage.set('gameStatistics', this.gameStats);
        console.log('💾 Статистика игр сохранена');
    }

    // Получить статистику по названию игры
    getGameStats(gameName) {
        console.log('🔍 ПОИСК СТАТИСТИКИ ДЛЯ ИГРЫ:', gameName);
        
        // 1. Прямое совпадение (с учетом регистра)
        if (this.gameStats[gameName]) {
            console.log('✅ Найдено прямое совпадение');
            return this.gameStats[gameName];
        }
        
        // 2. Ищем без учета регистра
        const normalizedSearch = gameName.toLowerCase().trim();
        console.log('🔍 Ищем без учета регистра:', normalizedSearch);
        
        const foundKey = Object.keys(this.gameStats).find(key => 
            key.toLowerCase().trim() === normalizedSearch
        );
        
        if (foundKey) {
            console.log('✅ Найдено по ключу (без учета регистра):', foundKey);
            return this.gameStats[foundKey];
        }
        
        console.log('❌ Статистика не найдена');
        return null;
    }

    // Обновить статистику на основе сессии
    updateGameStats(session) {
        const gameName = session.game;
        
        // Если статистики для игры нет - создаем
        if (!this.gameStats[gameName]) {
            this.gameStats[gameName] = this.createEmptyGameStats();
        }

        const stats = this.gameStats[gameName];
        
        // Обновляем базовую статистику
        stats.totalPlays = (stats.totalPlays || 0) + 1;
        
        // Обновляем даты
        const sessionDate = new Date(session.date);
        if (!stats.firstPlay || sessionDate < new Date(stats.firstPlay)) {
            stats.firstPlay = session.date;
        }
        if (!stats.lastPlay || sessionDate > new Date(stats.lastPlay)) {
            stats.lastPlay = session.date;
        }

        // Обновляем длительности
        if (!stats.minDuration || session.duration < stats.minDuration) {
            stats.minDuration = session.duration;
        }
        if (!stats.maxDuration || session.duration > stats.maxDuration) {
            stats.maxDuration = session.duration;
        }

        // Обновляем статистику игроков
        this.updatePlayersStats(stats, session);
        
        // Обновляем очки
        this.updateScoresStats(stats, session);

        this.saveGameStats();
        console.log('🔄 Обновлена статистика для игры:', gameName, stats);
    }

    updatePlayersStats(stats, session) {
        if (!stats.players) {
            stats.players = {};
        }

        // Обновляем всех участников сессии
        session.players.forEach(playerName => {
            if (!stats.players[playerName]) {
                stats.players[playerName] = {
                    totalGames: 0,
                    wins: 0,
                    bestScore: 0
                };
            }
            stats.players[playerName].totalGames++;
        });

        // Обновляем победителя
        const winner = session.winner;
        if (winner && stats.players[winner]) {
            stats.players[winner].wins++;
        }
    }

    updateScoresStats(stats, session) {
        if (!session.scores) return;

        Object.entries(session.scores).forEach(([playerName, score]) => {
            if (stats.players[playerName]) {
                if (score > stats.players[playerName].bestScore) {
                    stats.players[playerName].bestScore = score;
                }
            }
        });
    }

    createEmptyGameStats() {
        return {
            totalPlays: 0,
            minDuration: null,
            maxDuration: null,
            firstPlay: null,
            lastPlay: null,
            players: {}
        };
    }

    // Получить топ игроков для игры
    getTopPlayers(gameName, limit = 3) {
        const stats = this.getGameStats(gameName);
        if (!stats || !stats.players) return [];

        return Object.entries(stats.players)
            .map(([name, data]) => ({
                name,
                wins: data.wins,
                total: data.totalGames,
                percentage: data.totalGames > 0 ? Math.round((data.wins / data.totalGames) * 100) : 0,
                bestScore: data.bestScore
            }))
            .sort((a, b) => b.wins - a.wins)
            .slice(0, limit);
    }

    // Получить лучший счет для игры
    getBestScore(gameName) {
        const stats = this.getGameStats(gameName);
        if (!stats || !stats.players) return null;

        let bestScore = 0;
        let bestPlayer = '';

        Object.entries(stats.players).forEach(([name, data]) => {
            if (data.bestScore > bestScore) {
                bestScore = data.bestScore;
                bestPlayer = name;
            }
        });

        return bestScore > 0 ? { player: bestPlayer, score: bestScore } : null;
    }

    // Получить все игры, в которые играли
    getPlayedGames() {
        return Object.keys(this.gameStats).filter(gameName => 
            this.gameStats[gameName].totalPlays > 0
        );
    }
    findGameStats(gameName) {
        // Прямое совпадение
        if (this.gameStats[gameName]) {
            return this.gameStats[gameName];
        }
        
        // Поиск по частичному совпадению (на случай различий в регистре/пробелах)
        const normalizedSearch = gameName.toLowerCase().trim();
        const foundKey = Object.keys(this.gameStats).find(key => 
            key.toLowerCase().trim() === normalizedSearch
        );
        
        console.log('🔍 Поиск статистики:', {
            ищем: gameName,
            нормализовано: normalizedSearch,
            найдено: foundKey
        });
        
        return foundKey ? this.gameStats[foundKey] : null;
    }

    getPlayerFavoriteGames(playerName, limit = 5) {
        const playerGames = [];
        
        Object.entries(this.gameStats).forEach(([gameName, stats]) => {
            if (stats.players && stats.players[playerName]) {
                playerGames.push({
                    name: gameName,
                    plays: stats.players[playerName].totalGames
                });
            }
        });
        
        return playerGames
            .sort((a, b) => b.plays - a.plays)
            .slice(0, limit);
    }

    renderStatsPage() {
        console.log('🔄 GameStatsManager.renderStatsPage() вызван');
        
        // 🔥 ШАГ 1: ПРОВЕРЯЕМ window.app
        const app = window.app;
        if (!app) {
            console.error('❌ window.app не найден');
            console.log('📌 Попробуй в консоли: console.log(window.app)');
            return;
        }
        
        // 🔥 ШАГ 2: ПРОВЕРЯЕМ playersManager и его метод getAllPlayers
        if (!app.playersManager) {
            console.error('❌ app.playersManager не найден');
            console.log('📌 Свойства app:', Object.keys(app));
            return;
        }
        
        console.log('📌 app.playersManager:', app.playersManager);
        console.log('📌 getAllPlayers существует?', typeof app.playersManager.getAllPlayers);
        
        // 🔥 ШАГ 3: ПОЛУЧАЕМ ИГРОКОВ ЧЕРЕЗ getAllPlayers()
        const players = app.playersManager.getAllPlayers();
        console.log('📌 Игроков получено:', players.length);
        
        // 🔥 ШАГ 4: ПРОВЕРЯЕМ sessionsManager
        if (!app.sessionsManager) {
            console.error('❌ app.sessionsManager не найден');
            return;
        }
        
        const sessions = app.sessionsManager.getSessions ? 
                        app.sessionsManager.getSessions() : [];
        console.log('📌 Сессий получено:', sessions.length);
        
        // 🔥 ШАГ 5: НАХОДИМ КОНТЕЙНЕРЫ
        const playersRanking = document.getElementById('players-ranking');
        const detailedStats = document.getElementById('detailed-stats');
        
        if (!playersRanking || !detailedStats) {
            console.error('❌ Не найдены контейнеры статистики');
            console.log('📌 players-ranking:', playersRanking);
            console.log('📌 detailed-stats:', detailedStats);
            return;
        }
        
        // 🔥 ШАГ 6: ПРОВЕРЯЕМ ЕСТЬ ЛИ ДАННЫЕ
        if (players.length === 0) {
            console.log('📌 Нет игроков - показываем сообщение');
            this.showNoStatsMessage();
            return;
        }
        
        // 🔥 ШАГ 7: ПРЯЧЕМ "НЕТ ДАННЫХ"
        const noStatsMsg = document.getElementById('no-stats-message');
        if (noStatsMsg) {
            noStatsMsg.style.display = 'none';
            console.log('📌 Скрыли сообщение "нет данных"');
        }
        
        // 🔥 ШАГ 8: ПОДГОТАВЛИВАЕМ ДАННЫЕ С СТАТИСТИКОЙ
        const playersWithStats = players.map(player => {
            // Получаем статистику игрока через sessionsManager
            let stats = { totalGames: 0, wins: 0, winRate: 0 };
            
            if (app.sessionsManager && typeof app.sessionsManager.getPlayerStats === 'function') {
                const playerStats = app.sessionsManager.getPlayerStats(player.name);
                if (playerStats) {
                    stats = {
                        totalGames: playerStats.totalGames || 0,
                        wins: playerStats.wins || 0,
                        winRate: playerStats.winRate || 0
                    };
                }
            }
            
            return { 
                id: player.id,
                name: player.name,
                color: player.color || '#333',
                createdAt: player.createdAt,
                ...stats
            };
        }).sort((a, b) => b.winRate - a.winRate);
        
        console.log('📌 Игроков с статистикой:', playersWithStats.length);
        console.log('📌 Пример игрока с статистикой:', playersWithStats[0]);
        
        // 🔥 ШАГ 9: РЕНДЕРИМ РЕЙТИНГ ИГРОКОВ
        this.renderPlayersRanking(playersWithStats, playersRanking);
        
        // 🔥 ШАГ 10: РЕНДЕРИМ ДЕТАЛЬНУЮ СТАТИСТИКУ
        this.renderDetailedStats(playersWithStats, detailedStats, app.sessionsManager);
        
        console.log('✅ Статистика отрендерена через app.getAllPlayers()');
    }

    renderPlayersRanking(players, container) {
        // Получаем статистику для каждого игрока
        const playersWithStats = players.map(player => {
            const stats = this.sessionsManager?.getPlayerStats?.(player.name) || {
                totalGames: 0,
                wins: 0,
                winRate: 0
            };
            return { ...player, ...stats };
        }).sort((a, b) => b.winRate - a.winRate);
        
        container.innerHTML = playersWithStats.map((player, index) => {
            const winRateClass = player.winRate >= 50 ? 'positive' : 
                                player.winRate >= 30 ? 'high' : 'negative';
            
            return `
                <div class="ranking-item">
                    <div class="ranking-position">
                        <span class="position-number">${index + 1}</span>
                    </div>
                    <div class="ranking-player">
                        <div class="player-name" style="color: ${player.color || '#333'}">
                            ${player.name}
                        </div>
                        <div class="player-details">
                            <span>Всего игр: ${player.totalGames || 0}</span>
                            <span>Побед: ${player.wins || 0}</span>
                        </div>
                    </div>
                    <div class="ranking-stats">
                        <span class="win-rate ${winRateClass}">${player.winRate || 0}% побед</span>
                        <div class="games-stats">
                            ${player.wins || 0}/${player.totalGames || 0} побед
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDetailedStats(players, container) {
        const playersWithDetails = players.map(player => {
            const stats = this.sessionsManager?.getPlayerStats?.(player.name) || {};
            const detailed = this.sessionsManager?.getPlayerDetailedStats?.(player.name) || {};
            const losses = (stats.totalGames || 0) - (stats.wins || 0);
            const favoriteGames = this.getPlayerFavoriteGames(player.name, 2);
            
            return { 
                ...player, 
                ...detailed, 
                ...stats,
                losses: losses > 0 ? losses : 0,
                favoriteGames 
            };
        });
        
        container.innerHTML = playersWithDetails.map(player => {
            const favoriteGamesHTML = player.favoriteGames && player.favoriteGames.length > 0 ? 
                player.favoriteGames.map(game => `
                    <div class="additional-stat">
                        <span class="additional-label">${game.name}:</span>
                        <span class="additional-value">${game.plays} раз</span>
                    </div>
                `).join('') : '';
            
            return `
                <div class="player-stats-card">
                    <div class="player-stats-header">
                        <h3 style="color: ${player.color || '#333'}">${player.name}</h3>
                        <span class="win-rate ${player.winRate >= 50 ? 'positive' : 
                                            player.winRate >= 30 ? 'high' : 'negative'}">
                            ${player.winRate || 0}% побед
                        </span>
                    </div>
                    
                    <div class="player-main-stats">
                        <div class="stat-box games">
                            <div class="stat-value">${player.totalGames || 0}</div>
                            <div class="stat-label">Всего игр</div>
                        </div>
                        <div class="stat-box wins">
                            <div class="stat-value">${player.wins || 0}</div>
                            <div class="stat-label">Побед</div>
                        </div>
                        <div class="stat-box losses">
                            <div class="stat-value">${player.losses || 0}</div>
                            <div class="stat-label">Поражений</div>
                        </div>
                    </div>
                    
                    <div class="player-additional-info">
                        <div class="additional-stats">
                            ${favoriteGamesHTML}
                            <div class="additional-stat">
                                <span class="additional-label">Всего времени:</span>
                                <span class="additional-value">${player.totalTime || 0} мин</span>
                            </div>
                            <div class="additional-stat">
                                <span class="additional-label">Среднее время:</span>
                                <span class="additional-value">${player.averageTime || 0} мин</span>
                            </div>
                            <div class="additional-stat">
                                <span class="additional-label">Любимая игра:</span>
                                <span class="additional-value">${player.favoriteGame || 'нет'}</span>
                            </div>
                            <div class="additional-stat">
                                <span class="additional-label">Последняя игра:</span>
                                <span class="additional-value">
                                    ${player.lastPlay ? 
                                        new Date(player.lastPlay).toLocaleDateString('ru-RU') : 
                                        'нет данных'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showNoStatsMessage() {
        const noStatsMsg = document.getElementById('no-stats-message');
        if (noStatsMsg) {
            noStatsMsg.style.display = 'block';
        }
        
        ['players-ranking', 'detailed-stats'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    calculateAllGameStats() {
        console.log('🔄 Вычисляю статистику из сессий...');
        
        // Сбросим статистику
        this.gameStats = {};
        
        // 🔥 УБЕДИСЬ ЧТО sessionsManager ЕСТЬ!
        if (!this.sessionsManager) {
            console.error('❌ sessionsManager не доступен!');
            return;
        }
        
        // 🔥 УБЕДИСЬ ЧТО sessions ЕСТЬ!
        const sessions = this.sessionsManager.sessions || [];
        console.log('📦 Сессий для обработки:', sessions.length);
        
        if (sessions.length === 0) {
            console.warn('⚠️ Нет сессий для статистики!');
            return;
        }
        
        // Обрабатываем каждую сессию
        sessions.forEach(session => {
            if (!session || !session.game) return;
            
            const gameName = typeof session.game === 'string' ? session.game : session.game.name;
            if (!gameName) return;
            
            // Если статистики для игры нет - создаем
            if (!this.gameStats[gameName]) {
                this.gameStats[gameName] = {
                    totalPlays: 0,
                    totalSessions: 0,
                    players: {},
                    firstPlay: null,
                    lastPlay: null,
                    minDuration: null,
                    maxDuration: null
                };
            }
            
            const gameStats = this.gameStats[gameName];
            
            // Обновляем счетчики
            gameStats.totalPlays++;
            gameStats.totalSessions++;
            
            // Обновляем даты
            const sessionDate = new Date(session.date);
            if (!gameStats.firstPlay || sessionDate < new Date(gameStats.firstPlay)) {
                gameStats.firstPlay = session.date;
            }
            if (!gameStats.lastPlay || sessionDate > new Date(gameStats.lastPlay)) {
                gameStats.lastPlay = session.date;
            }
            
            // Обновляем длительность
            if (session.duration) {
                if (!gameStats.minDuration || session.duration < gameStats.minDuration) {
                    gameStats.minDuration = session.duration;
                }
                if (!gameStats.maxDuration || session.duration > gameStats.maxDuration) {
                    gameStats.maxDuration = session.duration;
                }
            }
            
            // Обрабатываем игроков
            if (session.players && Array.isArray(session.players)) {
                session.players.forEach(player => {
                    const playerName = typeof player === 'string' ? player : player.name;
                    if (!playerName) return;
                    
                    // Создаем запись для игрока если нет
                    if (!gameStats.players[playerName]) {
                        gameStats.players[playerName] = {
                            totalGames: 0,
                            wins: 0,
                            bestScore: 0
                        };
                    }
                    
                    // Обновляем счетчик игр для игрока
                    gameStats.players[playerName].totalGames++;
                    
                    // Обновляем победы
                    if (session.winner === playerName) {
                        gameStats.players[playerName].wins++;
                    }
                    
                    // Обновляем лучший счет
                    if (session.scores && session.scores[playerName]) {
                        const score = session.scores[playerName];
                        if (score > gameStats.players[playerName].bestScore) {
                            gameStats.players[playerName].bestScore = score;
                        }
                    }
                });
            }
        });
        
        console.log('✅ Статистика вычислена для игр:', Object.keys(this.gameStats).length);
        
        // Сохраняем вычисленную статистику
        this.saveGameStats();
    }

    // 🔥 ДОБАВЬ В КОНЕЦ КЛАССА GameStatsManager (перед последней }):
    // Получить всю статистику
    getAllGameStats() {
        return this.gameStats || {};
    }

    // Для отладки - показать все игры
    debugShowAllGames() {
        console.log('🎮 Все игры в статистике:');
        Object.entries(this.gameStats || {}).forEach(([game, stats]) => {
            console.log(`   "${game}": ${stats.totalPlays} сессий`);
        });
        return this.gameStats;
    }

    // Получить статистику с нормализацией имен
    getGameStatsNormalized(gameName) {
        if (!gameName) return null;
        
        // 1. Прямое совпадение
        if (this.gameStats[gameName]) {
            return this.gameStats[gameName];
        }
        
        // 2. Нормализация для поиска
        const normalize = (str) => {
            return str.toLowerCase()
                .replace(/[.:«»"',-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/ё/g, 'е');
        };
        
        const searchName = normalize(gameName);
        
        // 3. Ищем по нормализованным именам
        for (const [key, stats] of Object.entries(this.gameStats || {})) {
            if (normalize(key) === searchName) {
                console.log(`✅ Найдено "${gameName}" → "${key}"`);
                return stats;
            }
        }
        
        // 4. Частичное совпадение
        for (const [key, stats] of Object.entries(this.gameStats || {})) {
            if (normalize(key).includes(searchName) || searchName.includes(normalize(key))) {
                console.log(`✅ Частичное совпадение "${gameName}" → "${key}"`);
                return stats;
            }
        }
        
        return null;
    }

}

