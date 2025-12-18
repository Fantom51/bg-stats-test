import { StorageManager } from '../../core/storage.js';

export class SessionsManager {
    constructor(firebaseClient, storage) {
        console.log('📦 SessionsManager создается, firebase:', !!firebaseClient);
        this.firebase = firebaseClient;
        this.storage = storage;
        this.sessions = [];
        this.isInitialized = false;
    }

    async init() {
        console.log('🔄 SessionsManager инициализация...');
        
        if (!this.firebase || !this.firebase.isInitialized) {
            throw new Error('❌ Firebase не инициализирован для SessionsManager');
        }
        
        try {
            await this.loadSessions();
            this.isInitialized = true;
            console.log('✅ SessionsManager успешно инициализирован, сессий:', this.sessions.length);
        } catch (error) {
            console.error('❌ Ошибка инициализации SessionsManager:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    async loadSessions() {
        // 🔥 ВСЕГДА ПЫТАЕМСЯ ИСПОЛЬЗОВАТЬ FIREBASE ПЕРВЫМ
        if (!this.firebase || !this.firebase.isInitialized) {
            console.warn('⚠️ Firebase недоступен, используем localStorage');
            const result = this.storage.get('gameSessions', []);
            this.sessions = result;
            return result;
        }
        
        try {
            const firebaseSessions = await this.firebase.getSessions();
            
            // 🔥 ЕСЛИ В FIREBASE ЕСТЬ ДАННЫЕ - ИСПОЛЬЗУЕМ ИХ
            if (firebaseSessions && firebaseSessions.length > 0) {
                console.log('🔥 Загружены сессии из Firebase:', firebaseSessions.length);
                this.sessions = firebaseSessions;
                this.saveSessions(); // Синхронизируем localStorage
            } 
            // 🔥 ЕСЛИ FIREBASE ПУСТОЙ - ТОЖЕ ИСПОЛЬЗУЕМ ЕГО (ПУСТОЙ МАССИВ)
            else {
                console.log('📁 Firebase пуст - используем пустой массив');
                this.sessions = [];
                this.saveSessions(); // Очищаем localStorage
            }
            
            return this.sessions;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сессий:', error);
            // 🔄 FALLBACK: используем localStorage
            const result = this.storage.get('gameSessions', []);
            this.sessions = result;
            return result;
        }
    }

    saveSessions() {
        this.storage.set('gameSessions', this.sessions);
    }

    async migrateToFirebase() {
        console.log('🚚 Миграция сессий в Firebase...');
        try {
            for (const session of this.sessions) {
                await this.firebase.addSession(session);
            }
            
            // 🔥 ОЧИЩАЕМ LOCALSTORAGE ПОСЛЕ УСПЕШНОЙ МИГРАЦИИ
            this.storage.set('gameSessions', []);
            console.log('✅ Сессии мигрированы в Firebase, localStorage очищен');
            
        } catch (error) {
            console.error('❌ Ошибка миграции сессий в Firebase:', error);
        }
    }

    updateUI() {
        if (window.app && window.app.sessionsService) {
            console.log('🔍 [SESSIONS] Обновляем UI сессий');
            window.app.sessionsService.renderSessionsList('sessions-list');
            window.app.sessionsService.updateStats();
        }
    }

    async addSession(sessionData) {
        const processedSession = this.processSessionData(sessionData);
        
        const newSession = {
            ...processedSession,
            createdAt: new Date().toISOString()
        };
        
        // 🔥 СНАЧАЛА ДОБАВЛЯЕМ В ЛОКАЛЬНЫЙ МАССИВ
        this.sessions.push(newSession);
        this.saveSessions();
        
        if (!this.firebase || !this.firebase.isInitialized) {
            console.warn('⚠️ Firebase недоступен, создаем сессию локально');
            this.updateUI();
            return newSession;
        }
        
        try {
            // 🔥 ОТПРАВЛЯЕМ В FIREBASE, НО НЕ ПЕРЕЗАГРУЖАЕМ ВСЕ СЕССИИ
            const createdSession = await this.firebase.addSession(newSession);
            
            // 🚨 ВАЖНО: Обновляем ID если Firebase вернул свой
            if (createdSession && createdSession.id && createdSession.id !== newSession.id) {
                const index = this.sessions.findIndex(s => s === newSession);
                if (index !== -1) {
                    this.sessions[index] = createdSession;
                    this.saveSessions();
                }
            }
            
            console.log('✅ Сессия добавлена в Firebase:', newSession.game);
            this.updateUI();
            return createdSession || newSession;
            
        } catch (error) {
            console.error('❌ Ошибка добавления сессии в Firebase:', error);
            // Уже добавили локально, так что просто обновляем UI
            this.updateUI();
            console.log('📁 Сессия создана локально (firebase error)');
            return newSession;
        }
    }
    
    // 🆕 МЕТОД ДЛЯ ОБРАБОТКИ СТРУКТУРЫ ОЧКОВ
    processSessionData(sessionData) {
        const processed = { 
            ...sessionData,
            // 🆕 ДОБАВЛЯЕМ ПО УМОЛЧАНИЮ - СТАРЫЕ СЕССИИ НЕ СЛОМАЮТСЯ
            gameType: sessionData.gameType || "scoring",
            isTeamGame: sessionData.isTeamGame || false,
            teams: sessionData.teams || null
        };
        
        // 🆕 ОБРАБОТКА РАЗНЫХ ТИПОВ
        if (processed.gameType === "scoring") {
            // СУЩЕСТВУЮЩАЯ ЛОГИКА ПОДСЧЕТА ОЧКОВ
            if (!processed.totalScores && processed.scores) {
                processed.totalScores = {};
                Object.entries(processed.scores).forEach(([player, scores]) => {
                    processed.totalScores[player] = Array.isArray(scores) 
                        ? scores.reduce((sum, score) => sum + (score || 0), 0)
                        : scores || 0;
                });
            }
            
            // 🆕 АВТОМАТИЧЕСКИЙ ПОБЕДИТЕЛЬ ДЛЯ SCORING
            if (!processed.winner && processed.totalScores) {
                let maxScore = -1;
                let winner = '';
                Object.entries(processed.totalScores).forEach(([player, totalScore]) => {
                    if (totalScore > maxScore) {
                        maxScore = totalScore;
                        winner = player;
                    }
                });
                if (winner) processed.winner = winner;
            }
        }
        // 🆕 ДЛЯ NON_SCORING - победитель должен быть указан вручную
        // пока ничего не делаем
        
        return processed;
    }

    async deleteSession(sessionId) {
        console.log('🗑️ [SessionsManager] Удаление сессии ID:', sessionId);
        
        // 1. Находим сессию в локальном массиве
        const sessionIndex = this.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) {
            console.error('❌ Сессия не найдена локально');
            return false;
        }
        
        // 2. СРАЗУ удаляем из локального массива
        this.sessions.splice(sessionIndex, 1);
        this.saveSessions(); // Сохраняем в localStorage
        console.log('💾 Удалено из локального массива и localStorage');
        
        // 3. Пытаемся удалить из Firebase (НО НЕ ЖДЁМ ЕГО ОТВЕТА ДЛЯ UI)
        if (this.firebase && this.firebase.isInitialized) {
            // Запускаем удаление в фоне, не ждём!
            this.firebase.deleteSession(sessionId)
                .then(() => console.log('🔥 Успешно удалено из Firebase'))
                .catch(err => console.warn('⚠️ Ошибка Firebase (игнорируем):', err));
        }
        
        // 4. ВОЗВРАЩАЕМ УСПЕХ СРАЗУ (не ждём Firebase)
        return true;
    }

    getSessions() {
        return this.sessions;
    }

    getSession(sessionId) {
        return this.sessions.find(session => session.id === sessionId);
    }

    getSessionsByGame(gameName) {
        return this.sessions.filter(session => session.game === gameName);
    }

    getPlayerSessions(playerName) {
        return this.sessions.filter(session => 
            session.players.includes(playerName)
        );
    }

    getPlayerStats(playerName) {
        const playerSessions = this.getPlayerSessions(playerName);
        const totalGames = playerSessions.length;
        const wins = playerSessions.filter(session => session.winner === playerName).length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        
        return {
            totalGames,
            wins,
            winRate,
            favoriteGame: this.getFavoriteGame(playerName)
        };
    }

    getPlayerRecentSessions(playerName, limit = 5) {
        const playerSessions = this.getPlayerSessions(playerName);
        return playerSessions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }

    getFavoriteGame(playerName) {
        const playerSessions = this.getPlayerSessions(playerName);
        
        if (playerSessions.length === 0) return null;
        
        const gameCounts = {};
        playerSessions.forEach(session => {
            gameCounts[session.game] = (gameCounts[session.game] || 0) + 1;
        });
        
        const favoriteGame = Object.entries(gameCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        return favoriteGame ? favoriteGame[0] : null;
    }

    getPlayerDetailedStats(playerName) {
        const playerSessions = this.getPlayerSessions(playerName);
        const totalGames = playerSessions.length;
        const wins = playerSessions.filter(session => session.winner === playerName).length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        
        const totalTime = playerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        
        const gameStats = {};
        playerSessions.forEach(session => {
            if (!gameStats[session.game]) {
                gameStats[session.game] = { plays: 0, wins: 0 };
            }
            gameStats[session.game].plays++;
            if (session.winner === playerName) {
                gameStats[session.game].wins++;
            }
        });
        
        const durations = playerSessions.map(s => s.duration).filter(Boolean);
        const longestGame = durations.length > 0 ? Math.max(...durations) : 0;
        const shortestGame = durations.length > 0 ? Math.min(...durations) : 0;
        
        const lastSession = playerSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        
        return {
            totalGames,
            wins,
            winRate,
            totalTime,
            averageTime: totalGames > 0 ? Math.round(totalTime / totalGames) : 0,
            longestGame,
            shortestGame,
            favoriteGame: this.getFavoriteGame(playerName),
            gameStats,
            lastPlay: lastSession ? new Date(lastSession.date) : null,
            currentStreak: this.getCurrentStreak(playerSessions, playerName)
        };
    }

    getCurrentStreak(playerSessions, playerName) {
        const sortedSessions = playerSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let streak = 0;
        for (const session of sortedSessions) {
            if (session.winner === playerName) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    getPlayerUniqueGames(playerName) {
        const playerSessions = this.getPlayerSessions(playerName);
        const uniqueGames = new Set();
        
        playerSessions.forEach(session => {
            if (session.game) {
                uniqueGames.add(session.game);
            }
        });
        
        return uniqueGames.size;
    }

    async updatePlayerNameInSessions(oldName, newName) {
        console.log(`🔄 Обновление имени в сессиях: ${oldName} → ${newName}`);
        
        try {
            let updated = false;
            
            // Обновляем имя во всех сессиях
            this.sessions = this.sessions.map(session => {
                const updatedSession = { ...session };
                
                // 1. Обновляем в массиве players
                if (updatedSession.players.includes(oldName)) {
                    updatedSession.players = updatedSession.players.map(player => 
                        player === oldName ? newName : player
                    );
                    updated = true;
                }
                
                // 2. Обновляем winner
                if (updatedSession.winner === oldName) {
                    updatedSession.winner = newName;
                    updated = true;
                }
                
                // 3. Обновляем scores (если есть)
                if (updatedSession.scores && updatedSession.scores[oldName]) {
                    updatedSession.scores[newName] = updatedSession.scores[oldName];
                    delete updatedSession.scores[oldName];
                    updated = true;
                }
                
                // 4. Обновляем totalScores (если есть)
                if (updatedSession.totalScores && updatedSession.totalScores[oldName]) {
                    updatedSession.totalScores[newName] = updatedSession.totalScores[oldName];
                    delete updatedSession.totalScores[oldName];
                    updated = true;
                }
                
                // 5. Обновляем команды (если есть)
                if (updatedSession.teams) {
                    updatedSession.teams = updatedSession.teams.map(team => {
                        if (team.players.includes(oldName)) {
                            return {
                                ...team,
                                players: team.players.map(player => 
                                    player === oldName ? newName : player
                                )
                            };
                        }
                        return team;
                    });
                    updated = true;
                }
                
                return updated ? updatedSession : session;
            });
            
            // Сохраняем обновленные сессии
            if (updated) {
                this.saveSessions();
                
                // Обновляем в Firebase (если есть метод)
                if (this.firebase.updatePlayerInSessions) {
                    await this.firebase.updatePlayerInSessions(oldName, newName);
                }
                
                console.log(`✅ Имя обновлено в ${this.sessions.filter(s => 
                    s.players.includes(newName) || s.winner === newName
                ).length} сессиях`);
            }
            
            return updated;
            
        } catch (error) {
            console.error('❌ Ошибка при обновлении имени в сессиях:', error);
            return false;
        }
    }


}