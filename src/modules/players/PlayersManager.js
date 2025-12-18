import { StorageManager } from '../../core/storage.js';

export class PlayersManager {
    constructor(firebaseClient = null) {
        this.firebase = firebaseClient;
        this.storage = new StorageManager();
        this.players = [];
        this.nextId = 1;
        
        // 🔥 ПРОВЕРЯЕМ, ЕСТЬ ЛИ FIREBASE
        if (this.firebase && this.firebase.isInitialized) {
            this.loadPlayers();
        } else {
            // 🔄 ЕСЛИ FIREBASE НЕТ - ГРУЗИМ ТОЛЬКО ИЗ LOCALSTORAGE
            console.warn('⚠️ Firebase не передан, используем только localStorage');
            const savedData = this.storage.get('gameData');
            if (savedData) {
                this.players = savedData.players || [];
                this.nextId = savedData.id || this.calculateNextId();
            }
            this.validateData();
        }
    }

    async loadPlayers() {
        // 🔥 ПРОВЕРЯЕМ, ЧТО FIREBASE ДОСТУПЕН
        if (!this.firebase || !this.firebase.isInitialized) {
            console.warn('⚠️ Firebase недоступен, используем localStorage');
            const savedData = this.storage.get('gameData');
            if (savedData) {
                this.players = savedData.players || [];
                this.nextId = savedData.id || this.calculateNextId();
            }
            this.validateData();
            this.updateUI();
            return;
        }
        
        try {
            // 🔥 ПЫТАЕМСЯ ЗАГРУЗИТЬ ИЗ FIREBASE
            const firebasePlayers = await this.firebase.getPlayers();
            
            if (firebasePlayers && firebasePlayers.length > 0) {
                console.log('🔥 Загружены игроки из Firebase:', firebasePlayers.length);
                this.players = firebasePlayers;
                this.nextId = this.calculateNextId();
                this.saveToStorage();
                
            } else {
                // 🔄 FALLBACK: загружаем из localStorage
                console.log('📁 Firebase пуст, загружаем из localStorage');
                const savedData = this.storage.get('gameData');
                
                if (savedData) {
                    this.players = savedData.players || [];
                    this.nextId = savedData.id || this.calculateNextId();
                    
                    // 🔥 УМНАЯ МИГРАЦИЯ: ТОЛЬКО ЕСЛИ ЕЩЁ НЕ МИГРИРОВАЛИ
                    const migrationDone = localStorage.getItem('players_migration_done');
                    
                    if (this.players.length > 0 && migrationDone !== 'true') {
                        console.log('🚚 Выполняем миграцию игроков в Firebase...');
                        await this.migrateToFirebase();
                        
                        // 🔥 ПОМЕЧАЕМ ЧТО МИГРАЦИЯ ВЫПОЛНЕНА
                        localStorage.setItem('players_migration_done', 'true');
                        console.log('✅ Миграция завершена, помечаем как выполненную');
                        
                        // 🔄 ПЕРЕЗАГРУЖАЕМ из Firebase (чтобы получить ID)
                        const migratedPlayers = await this.firebase.getPlayers();
                        if (migratedPlayers && migratedPlayers.length > 0) {
                            this.players = migratedPlayers;
                            this.nextId = this.calculateNextId();
                        }
                    } else if (migrationDone === 'true') {
                        console.log('⚠️ Миграция уже была выполнена ранее');
                    }
                }
            }
            
            this.validateData();
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки игроков:', error);
            // 🔄 FALLBACK: используем localStorage
            const savedData = this.storage.get('gameData');
            if (savedData) {
                this.players = savedData.players || [];
                this.nextId = savedData.id || this.calculateNextId();
            }
            this.validateData();
            this.updateUI();
        }
    }

    calculateNextId() {
        if (this.players.length === 0) return 1;
        
        // 🔥 ЕСЛИ ЕСТЬ СТРОКОВЫЕ ID ИЗ FIREBASE - ИСПОЛЬЗУЕМ СВОЮ НУМЕРАЦИЮ
        const hasStringIds = this.players.some(player => typeof player.id === 'string');
        
        if (hasStringIds) {
            // Используем нашу внутреннюю нумерацию для совместимости
            const numericIds = this.players
                .map(p => typeof p.id === 'number' ? p.id : 0)
                .filter(id => id > 0);
            
            return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
        }
        
        // Старая логика для числовых ID
        return Math.max(...this.players.map(p => p.id)) + 1;
    }

    validateData() {
        if (!Array.isArray(this.players)) {
            this.players = [];
        }
        
        this.players = this.players.filter(player => 
            player && 
            (typeof player.id === 'number' || typeof player.id === 'string') && // 🔥 РАЗРЕШАЕМ СТРОКОВЫЕ ID
            player.id && // не пустой
            typeof player.name === 'string' && 
            player.name.trim() !== '' &&
            player.createdAt
        );
        
        this.nextId = this.calculateNextId();
        
        // 🔥 ОТЛАДКА
        console.log('🔍 [VALIDATE] players после валидации:', this.players);
        console.log('🔍 [VALIDATE] nextId:', this.nextId);
    }

    async createPlayer(name) {
        const trimmedName = name.trim();
        
        // 🔥 ПРОВЕРЯЕМ FIREBASE
        if (!this.firebase || !this.firebase.isInitialized) {
            console.warn('⚠️ Firebase недоступен, создаем игрока локально');
            const fallbackPlayer = {
                id: this.nextId++,
                name: trimmedName,
                createdAt: new Date().toISOString()
            };
            this.players.push(fallbackPlayer);
            this.saveToStorage();
            
            // 🔄 ОБНОВЛЯЕМ ИНТЕРФЕЙС
            this.updateUI();
            return fallbackPlayer;
        }
        
        try {
            // 🔥 СОЗДАЕМ ИГРОКА В FIREBASE
            const newPlayer = await this.firebase.addPlayer(trimmedName);
            
            // 🔄 ПЕРЕЗАГРУЖАЕМ ВСЕХ ИГРОКОВ ИЗ FIREBASE
            await this.loadPlayers();
            
            console.log('✅ Игрок создан в Firebase:', newPlayer);
            
            // 🔄 ОБНОВЛЯЕМ ИНТЕРФЕЙС
            this.updateUI();
            return newPlayer;
            
        } catch (error) {
            console.error('❌ Ошибка создания игрока в Firebase:', error);
            
            // 🔄 FALLBACK: создаем локально
            const fallbackPlayer = {
                id: this.nextId++,
                name: trimmedName,
                createdAt: new Date().toISOString()
            };
            this.players.push(fallbackPlayer);
            this.saveToStorage();
            
            console.log('📁 Игрок создан локально (fallback)');
            return fallbackPlayer;
        }
    }

    async deletePlayer(playerId) {
        const playerIndex = this.players.findIndex(player => player.id === playerId);
        if (playerIndex === -1) return false;

        // 🔥 ПРОВЕРЯЕМ FIREBASE
        if (!this.firebase || !this.firebase.isInitialized) {
            console.warn('⚠️ Firebase недоступен, удаляем игрока локально');
            this.players.splice(playerIndex, 1);
            this.saveToStorage();
            return true;
        }

        try {
            // 🔥 УДАЛЯЕМ ИЗ FIREBASE
            await this.firebase.deletePlayer(playerId);
            
            // 🔄 УДАЛЯЕМ ИЗ ЛОКАЛЬНОГО МАССИВА
            this.players.splice(playerIndex, 1);
            this.saveToStorage();
            
            console.log('✅ Игрок удален из Firebase');
            this.updateUI();
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка удаления игрока из Firebase:', error);
            
            // 🔄 FALLBACK: удаляем локально
            this.players.splice(playerIndex, 1);
            this.saveToStorage();
            
            console.log('📁 Игрок удален локально (fallback)');
            return true;
        }
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    saveToStorage() {
        const gameData = {
            players: this.players,
            id: this.nextId
        };
        this.storage.set('gameData', gameData);
    }

    getAllPlayers() {
        return [...this.players];
    }

    getPlayerStats(playerName) {
        const sessions = window.app?.sessionsManager?.sessions || [];
        const playerSessions = sessions.filter(session => 
            session.players.includes(playerName)
        );
        
        if (playerSessions.length === 0) {
            return null;
        }
        
        const wins = playerSessions.filter(s => s.winner === playerName).length;
        const totalPlayTime = playerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const averageScore = this.calculateAverageScore(playerName, playerSessions);
        const favoriteGame = this.getFavoriteGame(playerName, playerSessions);
        const recentGames = this.getRecentGames(playerName, playerSessions);
        
        return {
            playerName,
            totalGames: playerSessions.length,
            wins: wins,
            losses: playerSessions.length - wins,
            winRate: Math.round((wins / playerSessions.length) * 100),
            totalPlayTime,
            averagePlayTime: Math.round(totalPlayTime / playerSessions.length),
            averageScore,
            favoriteGame,
            recentGames: recentGames.slice(0, 5),
            streaks: this.calculateStreaks(playerName, playerSessions)
        };
    }

    calculateAverageScore(playerName, sessions) {
        const scores = sessions
            .map(session => session.scores?.[playerName])
            .filter(score => typeof score === 'number');
        
        return scores.length > 0 
            ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
            : 0;
    }

    getFavoriteGame(playerName, sessions) {
        const gameCounts = {};
        sessions.forEach(session => {
            if (session.players.includes(playerName)) {
                gameCounts[session.game] = (gameCounts[session.game] || 0) + 1;
            }
        });
        
        const favorite = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0];
        return favorite ? { game: favorite[0], count: favorite[1] } : null;
    }

    getRecentGames(playerName, sessions) {
        return sessions
            .filter(session => session.players.includes(playerName))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(session => ({
                game: session.game,
                date: session.date,
                winner: session.winner,
                result: session.winner === playerName ? 'win' : 'loss'
            }));
    }

    calculateStreaks(playerName, sessions) {
        const sortedSessions = sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
        let currentStreak = 0;
        let longestWinStreak = 0;
        let longestLossStreak = 0;
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        
        sortedSessions.forEach(session => {
            if (session.winner === playerName) {
                currentWinStreak++;
                currentLossStreak = 0;
                longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
            } else {
                currentLossStreak++;
                currentWinStreak = 0;
                longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
            }
        });
        
        // Текущая серия (последние игры)
        const recentSessions = sortedSessions.slice(-10);
        let currentSeries = 0;
        for (let i = recentSessions.length - 1; i >= 0; i--) {
            if (recentSessions[i].winner === playerName) {
                currentSeries++;
            } else {
                break;
            }
        }
        
        return {
            currentWinStreak: currentSeries,
            longestWinStreak,
            longestLossStreak
        };
    }

    // Общая статистика по всем игрокам
    getAllPlayersStats() {
        const players = this.getAllPlayers();
        return players.map(player => this.getPlayerStats(player.name)).filter(Boolean);
    }

    // Рейтинг игроков
    getPlayersRanking() {
        const stats = this.getAllPlayersStats();
        return stats.sort((a, b) => {
            // Сначала по победам, потом по win rate
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winRate - a.winRate;
        });
    }

    getPlayerById(playerId) {
        console.log('🔍 Поиск игрока по ID:', playerId);
        console.log('📋 Все игроки:', this.players);
        
        // Пробуем разные варианты ID
        const player = this.players.find(p => {
            const match = p.id === playerId || 
                        p.id === String(playerId) || 
                        p.id === `player_${playerId}`;
            console.log(`   Сравниваем: ${p.id} === ${playerId} = ${match}`);
            return match;
        });
        
        console.log('🔍 Найден игрок:', player);
        return player;
    }

    async migrateToFirebase() {
        console.log('🚚 УМНАЯ миграция игроков в Firebase...');
        
        try {
            // 🔥 ДВОЙНАЯ ПРОВЕРКА: получаем текущих игроков из Firebase
            const existingPlayers = await this.firebase.getPlayers();
            const existingNames = new Set(existingPlayers.map(p => p.name.toLowerCase().trim()));
            
            console.log('📊 В Firebase уже есть игроки:', existingNames.size);
            
            // Добавляем только абсолютно новых игроков
            let addedCount = 0;
            for (const player of this.players) {
                const playerNameNormalized = player.name.toLowerCase().trim();
                
                if (!existingNames.has(playerNameNormalized)) {
                    console.log(`➕ Добавляем нового игрока: "${player.name}"`);
                    await this.firebase.addPlayer(player.name);
                    addedCount++;
                    existingNames.add(playerNameNormalized); // Добавляем в Set чтобы избежать дублей в этой же миграции
                } else {
                    console.log(`⏭️ Пропускаем (уже есть): "${player.name}"`);
                }
            }
            
            console.log(`✅ Миграция завершена: добавлено ${addedCount} новых игроков`);
            
        } catch (error) {
            console.error('❌ Критическая ошибка миграции в Firebase:', error);
            throw error; // Пробрасываем ошибку выше
        }
    }

    updateUI() {
        console.log('🔍 [UPDATE UI] Начало обновления UI');
        if (window.app && window.app.playersTable) {
            console.log('🔍 [UPDATE UI] Обновляем только таблицу игроков');
            window.app.playersTable.updateTable();
        } else {
            console.log('🔍 [UPDATE UI] playersTable не найден');
        }
    }

    async updatePlayerName(playerId, newName) {
        console.log(`✏️ Изменение имени игрока ID:${playerId} → "${newName}"`);
        
        try {
            // Ищем игрока
            const playerIndex = this.players.findIndex(p => p.id === playerId);
            if (playerIndex === -1) {
                throw new Error(`Игрок с ID "${playerId}" не найден`);
            }
            
            const oldName = this.players[playerIndex].name;
            
            // Проверяем уникальность
            const nameExists = this.players.some(p => 
                p.name.toLowerCase() === newName.toLowerCase() && p.id !== playerId
            );
            
            if (nameExists) {
                throw new Error('Игрок с таким именем уже существует');
            }
            
            // 🔥 1. Обновляем в Firebase
            if (this.firebase && typeof this.firebase.updatePlayer === 'function') {
                console.log('🔥 Отправка в Firebase...');
                try {
                    await this.firebase.updatePlayer(playerId, { name: newName });
                    console.log('✅ Firebase обновлен');
                } catch (firebaseError) {
                    console.error('❌ Ошибка Firebase:', firebaseError);
                    // Продолжаем локально, но логируем ошибку
                }
            } else {
                console.warn('⚠️ Firebase updatePlayer не доступен');
            }
            
            // 🔥 2. Обновляем локально
            this.players[playerIndex].name = newName;
            this.saveToStorage();
            console.log('💾 Локальное хранилище обновлено');
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка при изменении имени:', error);
            return false;
        }
    }


}

export { PlayersManager };