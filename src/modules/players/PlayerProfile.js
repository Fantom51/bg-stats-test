export class PlayerProfile {
    constructor(playersManager, sessionsManager, gameStatsManager, sessionsService) {
        this.playersManager = playersManager;
        this.sessionsManager = sessionsManager;
        this.gameStatsManager = gameStatsManager;
        this.sessionsService = sessionsService; // 
        
        this.cache = new Map();
        this.currentPlayerName = null;
        this.currentPlayerId = null;
        
        // 🎯 ПРОСТАЯ ПАГИНАЦИЯ ДЛЯ ПРОФИЛЯ
        this.currentPage = 1;
        this.itemsPerPage = 15;

        this.handleEditName = this.handleEditName.bind(this);
        this.showEditModal = this.showEditModal.bind(this);
        this.hideEditModal = this.hideEditModal.bind(this);
        this.savePlayerName = this.savePlayerName.bind(this);
    }

    init(playerId) {
        console.log('🎯 INIT PLAYER PROFILE for ID:', playerId);
        
        // 🔥 Сохраняем ВЕСЬ объект игрока
        this.currentPlayer = this.playersManager.getPlayerById(playerId);
        
        if (!this.currentPlayer) {
            this.showPlayerNotFound();
            return;
        }
        
        this.cache.clear();
        this.currentPlayerName = this.currentPlayer.name;
        this.currentPlayerId = this.currentPlayer.id;
        
        console.log('📋 Текущий игрок:', this.currentPlayer);
        
        this.updatePlayerProfile(this.currentPlayer);
        this.renderAllSessions(this.currentPlayer.name);
        this.setupEventListeners();
    }

    // 🎯 ОБНОВЛЕНИЕ ВСЕГО ПРОФИЛЯ
    updatePlayerProfile(player) {
        console.log('🔄 Обновление профиля игрока:', player.name);
        
        // Обновляем заголовок
        document.getElementById('player-name').textContent = player.name;
        document.getElementById('breadcrumb-player').textContent = player.name;
        
        // Получаем статистику
        const stats = this.sessionsManager.getPlayerDetailedStats(player.name);
        const playerSessions = this.sessionsManager.getPlayerSessions(player.name);
        
        // Обновляем все разделы
        this.renderPlayerMeta(player);
        this.renderPlayerStats(player, playerSessions, stats);
        this.renderFavoriteGames(player.name, stats.gameStats);
        this.renderGameStats(stats.gameStats);
        
        console.log('✅ Профиль обновлен');
    }

    // 📊 ОСНОВНАЯ СТАТИСТИКА В ВЕРТИКАЛЬНОЙ ТАБЛИЦЕ
    renderPlayerStats(player, playerSessions, stats) {
        console.log('📊 Рендерим статистику в вертикальную таблицу...');
        
        // Вычисляем все показатели
        const totalGames = playerSessions.length;
        const wins = stats?.wins || 0;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const currentStreak = this.calculateCurrentStreak(playerSessions, player.name);
        const totalTime = this.calculateTotalTime(playerSessions);
        const avgTime = totalGames > 0 ? Math.round(totalTime / totalGames) : 0;
        const longestGame = this.findLongestGame(playerSessions);
        const uniqueGames = this.getUniqueGamesCount(playerSessions);
        const bestGame = this.getBestGame(playerSessions, player.name);
        const favoriteOpponent = this.getFavoriteOpponent(playerSessions, player.name);
        
        // Обновляем таблицу
        this.updateStatRow('player-total-games', totalGames);
        this.updateStatRow('player-total-wins', wins);
        this.updateStatRow('player-win-rate', `${winRate}%`);
        this.updateStatRow('player-current-streak', currentStreak);
        this.updateStatRow('player-total-time', this.formatTime(totalTime));
        this.updateStatRow('player-average-time', this.formatTime(avgTime));
        this.updateStatRow('player-longest-game', this.formatTime(longestGame));
        this.updateStatRow('player-unique-games', uniqueGames);
        this.updateStatRow('player-best-game', bestGame);
        this.updateStatRow('player-favorite-opponent', favoriteOpponent);
        
        console.log('✅ Статистика обновлена в таблице');
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ СТАТИСТИКИ
    calculateCurrentStreak(sessions, playerName) {
        if (sessions.length === 0) return 0;
        
        // Сортируем по дате (новые сначала)
        const sortedSessions = [...sessions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
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

    calculateTotalTime(sessions) {
        return sessions.reduce((total, session) => total + (session.duration || 0), 0);
    }

    findLongestGame(sessions) {
        if (sessions.length === 0) return 0;
        return Math.max(...sessions.map(s => s.duration || 0));
    }

    getUniqueGamesCount(sessions) {
        const games = new Set();
        sessions.forEach(session => {
            if (session.game) games.add(session.game);
        });
        return games.size;
    }

    getBestGame(sessions, playerName) {
        if (sessions.length === 0) return '-';
        
        console.log('🔍 Ищем лучшую игру для', playerName);
        console.log('📊 Всего сессий:', sessions.length);
        
        // 1. Собираем статистику по всем играм
        const gameStats = {};
        
        sessions.forEach(session => {
            const game = session.game;
            if (!game) return;
            
            if (!gameStats[game]) {
                gameStats[game] = { total: 0, wins: 0 };
            }
            
            gameStats[game].total++;
            
            if (session.winner === playerName) {
                gameStats[game].wins++;
            }
        });
        
        console.log('📈 Статистика по играм:', gameStats);
        
        // 2. Если игрок играл только в 1 игру
        const games = Object.keys(gameStats);
        if (games.length === 1) {
            const game = games[0];
            const stats = gameStats[game];
            const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
            console.log('🎮 Только одна игра:', game, `(${winRate}%)`);
            return `${game} (${winRate}%)`;
        }
        
        // 3. Находим лучшую игру по проценту побед
        let bestGame = null;
        let bestWinRate = -1;
        let bestTotalGames = 0;
        
        games.forEach(game => {
            const stats = gameStats[game];
            const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
            
            console.log(`   ${game}: ${stats.wins}/${stats.total} побед = ${winRate}%`);
            
            // Критерии выбора лучшей игры:
            // 1. Лучший процент побед
            // 2. При равном проценте - больше игр
            // 3. При равных играх - больше побед
            if (winRate > bestWinRate || 
                (winRate === bestWinRate && stats.total > bestTotalGames) ||
                (winRate === bestWinRate && stats.total === bestTotalGames && stats.wins > (gameStats[bestGame]?.wins || 0))) {
                
                bestWinRate = winRate;
                bestTotalGames = stats.total;
                bestGame = game;
            }
        });
        
        // 4. Форматируем результат
        if (bestGame && bestWinRate >= 0) {
            const result = `${bestGame} (${Math.round(bestWinRate)}%)`;
            console.log('🏆 Лучшая игра:', result);
            return result;
        }
        
        console.log('❌ Не удалось определить лучшую игру');
        return '-';
    }

    getFavoriteOpponent(sessions, playerName) {
        if (sessions.length === 0) return '-';
        
        const opponentStats = {};
        
        sessions.forEach(session => {
            session.players.forEach(opponent => {
                if (opponent !== playerName) {
                    if (!opponentStats[opponent]) {
                        opponentStats[opponent] = { games: 0 };
                    }
                    opponentStats[opponent].games++;
                }
            });
        });
        
        let favoriteOpponent = '-';
        let mostGames = 0;
        
        Object.entries(opponentStats).forEach(([opponent, stats]) => {
            if (stats.games > mostGames) {
                mostGames = stats.games;
                favoriteOpponent = opponent;
            }
        });
        
        return favoriteOpponent !== '-' ? `${favoriteOpponent} (${mostGames} игр)` : '-';
    }

    updateStatRow(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Анимация обновления
            element.classList.remove('updated');
            void element.offsetWidth; // Триггерим рефлоу
            element.classList.add('updated');
            
            // Обновляем значение
            element.textContent = value;
            
            // Добавляем стили в зависимости от значения
            element.className = 'stat-value';
            
            if (typeof value === 'string' && value.includes('%')) {
                const percent = parseInt(value);
                if (!isNaN(percent)) {
                    if (percent >= 60) element.classList.add('positive');
                    else if (percent >= 40) element.classList.add('highlight');
                }
            } else if (elementId.includes('current-streak')) {
                const streak = parseInt(value);
                if (!isNaN(streak) && streak >= 3) {
                    element.classList.add('record');
                }
            }
        }
    }

    formatTime(minutes) {
        if (!minutes || minutes === 0) return '0ч 0м';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}ч ${mins}м`;
        } else {
            return `${mins}м`;
        }
    }

    // 📋 ОТОБРАЖЕНИЕ ВСЕХ СЕССИЙ С ПАГИНАЦИЕЙ
    renderAllSessions(playerName) {
        const container = document.getElementById('all-sessions-container');
        const countElement = document.getElementById('total-sessions-count');
        
        if (!container) return;

        const allSessions = this.sessionsManager.getPlayerSessions(playerName);
        
        // Обновляем счетчик
        if (countElement) {
            countElement.textContent = `${allSessions.length} ${this.getPluralForm(allSessions.length, 'сессия', 'сессии', 'сессий')}`;
        }
        
        // 🎯 ПРОСТАЯ ПАГИНАЦИЯ ПРЯМО ЗДЕСЬ
        this.renderSessionsWithPagination(allSessions, playerName);
    }

    // 🎯 МЕТОД ДЛЯ РЕНДЕРА С ПАГИНАЦИЕЙ
    renderSessionsWithPagination(allSessions, playerName) {
        const container = document.getElementById('all-sessions-container');
        if (!container) return;

        // Удаляем старую пагинацию
        this.removePaginationControls();

        if (!allSessions || allSessions.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    <p>🎯 Пока нет сыгранных сессий</p>
                    <p>Этот игрок еще не участвовал в играх</p>
                </div>
            `;
            return;
        }

        // Рассчитываем пагинацию
        const totalPages = Math.ceil(allSessions.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, allSessions.length);
        const pageSessions = allSessions.slice(startIndex, endIndex);
        
        // Сортируем по дате (новые сначала)
        const sortedSessions = [...pageSessions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        // Очищаем контейнер
        container.innerHTML = '';
        
        // Создаем фрагмент для быстрого рендеринга
        const fragment = document.createDocumentFragment();
        
        sortedSessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `session-card ${session.winner === playerName ? 'session-win' : 'session-loss'}`;
            div.dataset.sessionId = session.id;
            div.innerHTML = this.createSessionTableItem(session, playerName);
            fragment.appendChild(div);
        });
        
        container.appendChild(fragment);
        
        // 🎯 ДОБАВЛЯЕМ ПАГИНАЦИЮ (если нужно)
        if (allSessions.length > this.itemsPerPage) {
            this.renderPaginationControls(allSessions.length, totalPages, startIndex, endIndex, playerName);
        }
        
        console.log(`✅ Отображены сессии ${startIndex + 1}-${endIndex} из ${allSessions.length}`);
    }

    // 🎯 ПАГИНАЦИЯ - КНОПКИ
    renderPaginationControls(totalItems, totalPages, startIndex, endIndex, playerName) {
        const paginationHTML = `
            <div class="player-pagination-controls">
                <div class="pagination-info">
                    Сессии ${startIndex + 1}-${endIndex} из ${totalItems}
                </div>
                
                <div class="pagination-buttons">
                    <button class="pagination-btn prev" ${this.currentPage === 1 ? 'disabled' : ''}>
                        ◀️ Назад
                    </button>
                    
                    <div class="page-numbers">
                        ${this.generatePageNumbers(totalPages)}
                    </div>
                    
                    <button class="pagination-btn next" ${this.currentPage === totalPages ? 'disabled' : ''}>
                        Вперёд ▶️
                    </button>
                </div>
                
                <div class="items-per-page-selector">
                    <label>Показывать по:</label>
                    <select class="player-items-per-page">
                        <option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="15" ${this.itemsPerPage === 15 ? 'selected' : ''}>15</option>
                        <option value="20" ${this.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                        <option value="30" ${this.itemsPerPage === 30 ? 'selected' : ''}>30</option>
                    </select>
                </div>
            </div>
        `;
        
        const container = document.getElementById('all-sessions-container');
        container.insertAdjacentHTML('afterend', paginationHTML);
        
        // Вешаем обработчики
        this.setupPaginationHandlers(playerName);
    }

    // 🎯 ГЕНЕРАЦИЯ НОМЕРОВ СТРАНИЦ
    generatePageNumbers(totalPages) {
        let pagesHTML = '';
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            // Показать все страницы
            for (let i = 1; i <= totalPages; i++) {
                pagesHTML += `<button class="page-number ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        } else {
            // Упрощенная логика
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            // Первая страница
            if (startPage > 1) {
                pagesHTML += `<button class="page-number" data-page="1">1</button>`;
                if (startPage > 2) pagesHTML += `<span class="page-dots">...</span>`;
            }
            
            // Основные страницы
            for (let i = startPage; i <= endPage; i++) {
                pagesHTML += `<button class="page-number ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            
            // Последняя страница
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) pagesHTML += `<span class="page-dots">...</span>`;
                pagesHTML += `<button class="page-number" data-page="${totalPages}">${totalPages}</button>`;
            }
        }
        
        return pagesHTML;
    }

    // 🎯 ОБРАБОТЧИКИ ПАГИНАЦИИ
    setupPaginationHandlers(playerName) {
        // Кнопки Назад/Вперед
        document.querySelector('.player-pagination-controls .prev')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderAllSessions(playerName);
                this.scrollToSessions();
            }
        });
        
        document.querySelector('.player-pagination-controls .next')?.addEventListener('click', () => {
            const allSessions = this.sessionsManager.getPlayerSessions(playerName);
            const totalPages = Math.ceil(allSessions.length / this.itemsPerPage);
            
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderAllSessions(playerName);
                this.scrollToSessions();
            }
        });
        
        // Номера страниц
        document.querySelectorAll('.player-pagination-controls .page-number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderAllSessions(playerName);
                    this.scrollToSessions();
                }
            });
        });
        
        // Изменение количества на странице
        document.querySelector('.player-pagination-controls .player-items-per-page')?.addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1; // Сбрасываем на первую страницу
            this.renderAllSessions(playerName);
        });
    }

    // 🎯 УДАЛЕНИЕ ПАГИНАЦИИ
    removePaginationControls() {
        const paginationControls = document.querySelector('.player-pagination-controls');
        if (paginationControls) {
            paginationControls.remove();
        }
    }

    // 🎯 ПРОКРУТКА К СЕССИЯМ
    scrollToSessions() {
        const container = document.getElementById('all-sessions-container');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 🎯 СБРОС ПАГИНАЦИИ ПРИ ОБНОВЛЕНИИ
    resetPagination() {
        this.currentPage = 1;
        this.removePaginationControls();
    }

    createSessionTableItem(session, currentPlayerName) {
    // 📌 Передаем ВСЕ данные сессии в метод таблицы
    const scoresTableHTML = this.createSessionScoresTableV2(session, currentPlayerName);
    
    const isWin = session.winner === currentPlayerName;
    const isNonScoring = session.gameType === 'non_scoring';
    
    return `
        <div class="session-card ${isWin ? 'session-win' : 'session-loss'}" data-session-id="${session.id}">
            <div class="session-card-header">
                <div class="session-card-title">
                    <span class="session-game-icon">${isNonScoring ? '👑' : '🎮'}</span>
                    <h3 class="session-game-name">${session.game}</h3>
                    ${isWin ? '<span class="win-indicator">🏆 ПОБЕДА</span>' : ''}
                    ${isNonScoring ? '<span class="no-scores-badge">Без очков</span>' : ''}
                </div>
                <div class="session-card-meta">
                    <span class="session-date">📅 ${new Date(session.date).toLocaleDateString('ru-RU')}</span>
                    ${session.duration ? `<span class="session-duration">⏱ ${session.duration} мин</span>` : ''}
                </div>
            </div>

            <div class="session-scores-section">
                ${scoresTableHTML}
            </div>

            ${session.description ? `
                <div class="session-description">
                    <div class="description-label">📝 Комментарий:</div>
                    <div class="description-text">${session.description}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// 🆕 НОВЫЙ МЕТОД С ПОДДЕРЖКОЙ gameType
    createSessionScoresTableV2(session, currentPlayerName) {
        const { scores, players, winner, gameType } = session;
        
        // 🎯 ИГРА БЕЗ ОЧКОВ
        if (gameType === 'non_scoring' || !scores || Object.keys(scores).length === 0) {
            let tableHTML = `
                <div class="session-scores-table-container">
                    <table class="session-scores-table session-no-scores-table">
                        <thead>
                            <tr>
                                <th class="participant-col">Участники</th>
                                <th class="result-col">Результат</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            players.forEach(player => {
                const isWinner = player === winner;
                const isCurrent = player === currentPlayerName;
                
                tableHTML += `
                    <tr>
                        <td class="participant-name ${isCurrent ? 'current-player' : ''}">
                            ${isWinner ? '👑 ' : ''}${player}
                        </td>
                        <td class="participant-result ${isWinner ? 'winner-total' : ''}">
                            ${isWinner ? '<span class="winner-badge">🏆 ПОБЕДИТЕЛЬ</span>' : 'Участник'}
                            ${isCurrent && !isWinner ? '<span class="current-badge">(Вы)</span>' : ''}
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += `
                        </tbody>
                    </table>
                </div>`;
            
            return tableHTML;
        }
        
        // 🎯 ИГРА С ОЧКАМИ - оставляем старую логику
        const maxRounds = Math.max(...Object.values(scores).map(playerScores => playerScores.length));
        
        let tableHTML = `
            <div class="session-scores-table-container">
                <table class="session-scores-table">
                    <thead>
                        <tr>
                            <th class="round-col">Раунд</th>
                            ${players.map(player => {
                                const isWinner = player === winner;
                                const isCurrent = player === currentPlayerName;
                                let className = '';
                                if (isWinner) className += 'winner-player';
                                if (isCurrent) className += ' current-player';
                                return `<th class="player-col ${className}">${player}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let round = 0; round < maxRounds; round++) {
            tableHTML += `
                <tr>
                    <td class="round-number">${round + 1}</td>
                    ${players.map(player => {
                        const playerScores = scores[player] || [];
                        const score = round < playerScores.length ? playerScores[round] : '-';
                        const isCurrent = player === currentPlayerName;
                        return `<td class="score-cell ${isCurrent ? 'current-player' : ''}">${score}</td>`;
                    }).join('')}
                </tr>
            `;
        }

        tableHTML += `
                <tr class="total-row">
                    <td class="total-label"><strong>ИТОГО</strong></td>
                    ${players.map(player => {
                        const playerScores = scores[player] || [];
                        const total = playerScores.reduce((sum, score) => sum + (parseInt(score) || 0), 0);
                        const isWinner = player === winner;
                        const isCurrent = player === currentPlayerName;
                        let className = '';
                        if (isWinner) className += 'winner-total';
                        if (isCurrent) className += ' current-player';
                        return `
                            <td class="total-cell ${className}">
                                ${isWinner ? '🏆 ' : ''}${total}
                                ${isCurrent && !isWinner ? '<span class="current-badge">(Вы)</span>' : ''}
                            </td>
                        `;
                    }).join('')}
                </tr>
            </tbody>
        </table>
    </div>`;

        return tableHTML;
    }

    createSessionScoresTable(scores, players, winner, currentPlayerName) {
        if (!scores || Object.keys(scores).length === 0) {
            return '<div class="no-scores">Нет данных об очках</div>';
        }

        const maxRounds = Math.max(...Object.values(scores).map(playerScores => playerScores.length));
        
        let tableHTML = `
            <div class="session-scores-table-container">
                <table class="session-scores-table">
                    <thead>
                        <tr>
                            <th class="round-col">Раунд</th>
                            ${players.map(player => {
                                const isWinner = player === winner;
                                const isCurrent = player === currentPlayerName;
                                let className = '';
                                if (isWinner) className += 'winner-player';
                                if (isCurrent) className += ' current-player';
                                return `<th class="player-col ${className}">${player}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let round = 0; round < maxRounds; round++) {
            tableHTML += `
                <tr>
                    <td class="round-number">${round + 1}</td>
                    ${players.map(player => {
                        const playerScores = scores[player] || [];
                        const score = round < playerScores.length ? playerScores[round] : '-';
                        const isCurrent = player === currentPlayerName;
                        return `<td class="score-cell ${isCurrent ? 'current-player' : ''}">${score}</td>`;
                    }).join('')}
                </tr>
            `;
        }

        tableHTML += `
                <tr class="total-row">
                    <td class="total-label"><strong>ИТОГО</strong></td>
                    ${players.map(player => {
                        const playerScores = scores[player] || [];
                        const total = playerScores.reduce((sum, score) => sum + (parseInt(score) || 0), 0);
                        const isWinner = player === winner;
                        const isCurrent = player === currentPlayerName;
                        let className = '';
                        if (isWinner) className += 'winner-total';
                        if (isCurrent) className += ' current-player';
                        return `
                            <td class="total-cell ${className}">
                                ${isWinner ? '🏆 ' : ''}${total}
                            </td>
                        `;
                    }).join('')}
                </tr>
            </tbody>
        </table>
    </div>`;

        return tableHTML;
    }

    // 🎮 ЛЮБИМЫЕ ИГРЫ
    renderFavoriteGames(playerName, gameStats) {
        const container = document.getElementById('favorite-games');
        
        if (!gameStats || Object.keys(gameStats).length === 0) {
            container.innerHTML = '<div class="no-data">Нет данных об играх</div>';
            return;
        }
        
        // Сортируем игры по количеству партий и берем топ-5
        const favoriteGames = Object.entries(gameStats)
            .map(([gameName, stats]) => ({
                name: gameName,
                plays: stats.plays,
                wins: stats.wins,
                winRate: stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0
            }))
            .sort((a, b) => b.plays - a.plays)
            .slice(0, 5);
        
        container.innerHTML = favoriteGames.map(game => `
            <div class="favorite-game-item">
                <div class="game-name">${game.name}</div>
                <div class="game-stats">
                    <span class="game-plays">${game.plays} партий</span>
                    <span class="game-wins">${game.wins} побед</span>
                    <span class="game-winrate">${game.winRate}%</span>
                </div>
            </div>
        `).join('');
    }

    // 📈 СТАТИСТИКА ПО ИГРАМ
    renderGameStats(gameStats) {
        const container = document.getElementById('detailed-game-stats');
        if (!container) return;
        
        if (Object.keys(gameStats).length === 0) {
            container.innerHTML = '<div class="no-data">Нет статистики по играм</div>';
            return;
        }
        
        // Сортируем по количеству партий
        const sortedGames = Object.entries(gameStats)
            .sort(([,a], [,b]) => b.plays - a.plays);
        
        container.innerHTML = sortedGames.map(([gameName, stats]) => {
            const winRate = stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0;
            return `
                <div class="game-stat-item">
                    <div class="game-name">🎮 ${gameName}</div>
                    <div class="game-details">
                        <span class="game-plays">${stats.plays} ${this.getPluralForm(stats.plays, 'игра', 'игры', 'игр')}</span>
                        <span class="game-wins">${stats.wins} ${this.getPluralForm(stats.wins, 'победа', 'победы', 'побед')}</span>
                        <span class="game-winrate">${winRate}% побед</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 👤 МЕТА-ИНФОРМАЦИЯ ИГРОКА
    renderPlayerMeta(player) {
        const joinedDate = player.createdAt ? new Date(player.createdAt).toLocaleDateString('ru-RU') : 'неизвестно';
        document.getElementById('player-joined').textContent = `Участник с ${joinedDate}`;
        
        // Обновляем уровень игрока
        const playerSessions = this.sessionsManager.getPlayerSessions(player.name);
        const levelElement = document.getElementById('player-level');
        if (levelElement) {
            if (playerSessions.length >= 20) levelElement.textContent = '🎖️ Ветеран';
            else if (playerSessions.length >= 10) levelElement.textContent = '⭐ Опытный';
            else if (playerSessions.length >= 5) levelElement.textContent = '🌱 Средний';
            else levelElement.textContent = '🌱 Новичок';
        }
        
        // Обновляем последнюю игру
        const lastPlayElement = document.getElementById('last-play');
        if (lastPlayElement && playerSessions.length > 0) {
            const lastSession = [...playerSessions].sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];
            lastPlayElement.textContent = `Последняя игра: ${new Date(lastSession.date).toLocaleDateString('ru-RU')}`;
        } else {
            lastPlayElement.textContent = 'Никогда не играл';
        }
    }

    // 📝 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getPluralForm(number, one, two, five) {
        let n = Math.abs(number);
        n %= 100;
        if (n >= 5 && n <= 20) {
            return five;
        }
        n %= 10;
        if (n === 1) {
            return one;
        }
        if (n >= 2 && n <= 4) {
            return two;
        }
        return five;
    }

    showPlayerNotFound() {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h1>😕 Игрок не найден</h1>
                <p>Такого игрока не существует</p>
                <a href="#/" class="btn btn-primary">← Назад к игрокам</a>
            </div>
        `;
    }

    refreshProfile(playerId) {
        console.log('🔄 Принудительное обновление профиля игрока:', playerId);
        this.cache.clear();
        this.currentPage = 1; // 🎯 СБРАСЫВАЕМ ПАГИНАЦИЮ
        this.removePaginationControls();
        this.init(playerId);
    }

     setupEventListeners() {
        // Кнопка редактирования имени
        const editBtn = document.getElementById('edit-player-name-btn');
        if (editBtn) {
            editBtn.removeEventListener('click', this.handleEditName);
            editBtn.addEventListener('click', this.handleEditName);
        }
        
        // Закрытие модального окна
        const closeBtn = document.getElementById('close-edit-modal');
        const cancelBtn = document.getElementById('cancel-edit');
        const modal = document.getElementById('edit-name-modal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', this.hideEditModal);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.hideEditModal);
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideEditModal();
                }
            });
        }
        
        // Форма сохранения
        const form = document.getElementById('edit-name-form');
        if (form) {
            form.removeEventListener('submit', this.savePlayerName);
            form.addEventListener('submit', this.savePlayerName);
        }
    }

    // 🔥 Показать модальное окно редактирования
    handleEditName() {
        console.log('✏️ Открываем форму редактирования имени');
        this.showEditModal();
    }

    showEditModal() {
        const modal = document.getElementById('edit-name-modal');
        const currentNameDisplay = document.getElementById('current-name-display');
        const nameInput = document.getElementById('new-player-name');
        
        if (!modal || !currentNameDisplay || !nameInput) {
            console.error('❌ Элементы модального окна не найдены');
            return;
        }
        
        // Показываем текущее имя
        currentNameDisplay.textContent = this.currentPlayerName;
        currentNameDisplay.style.cssText = `
            padding: 0.75rem;
            background: #f8f9fa;
            border-radius: 6px;
            font-weight: 600;
            color: #2c3e50;
            border-left: 4px solid #667eea;
        `;
        
        // Устанавливаем текущее имя как значение по умолчанию
        nameInput.value = this.currentPlayerName;
        nameInput.focus();
        nameInput.select();
        
        // Показываем модальное окно
        modal.classList.add('active');
        
        // Блокируем прокрутку страницы
        document.body.style.overflow = 'hidden';
    }

    hideEditModal() {
        const modal = document.getElementById('edit-name-modal');
        const form = document.getElementById('edit-name-form');
        
        if (modal) {
            modal.classList.remove('active');
        }
        
        if (form) {
            form.reset();
        }
        
        // Разблокируем прокрутку
        document.body.style.overflow = '';
    }

    // 🔥 Сохранить новое имя игрока
    async savePlayerName(event) {
        event.preventDefault();
        
        const nameInput = document.getElementById('new-player-name');
        const newName = nameInput.value.trim();
        
        if (!newName) {
            this.showError('Пожалуйста, введите имя');
            return;
        }
        
        if (newName === this.currentPlayerName) {
            this.showError('Имя не изменилось');
            return;
        }
        
        console.log(`✏️ Изменение имени: ${this.currentPlayerName} → ${newName}`);
        
        try {
            // 🔥 Проверяем что ID существует
            if (!this.currentPlayerId) {
                // Если ID нет, ищем игрока по имени
                console.log('🔄 ID не найден, ищем игрока по имени...');
                const player = this.playersManager.players.find(p => 
                    p.name === this.currentPlayerName
                );
                
                if (!player) {
                    throw new Error('Не удалось найти игрока для изменения имени');
                }
                
                this.currentPlayerId = player.id;
                this.currentPlayer = player;
                console.log('✅ Найден игрок по имени, ID:', this.currentPlayerId);
            }
            
            // Изменяем имя в менеджере игроков
            const success = await this.playersManager.updatePlayerName(
                this.currentPlayerId, 
                newName
            );
            
            if (!success) {
                throw new Error('Не удалось изменить имя игрока');
            }
            
            // Обновляем имя во всех сессиях
            await this.sessionsManager.updatePlayerNameInSessions(
                this.currentPlayerName,
                newName
            );
            
            // Обновляем текущее имя
            this.currentPlayerName = newName;
            
            // 🎯 СБРАСЫВАЕМ ПАГИНАЦИЮ ПРИ ИЗМЕНЕНИИ ИМЕНИ
            this.resetPagination();
            
            // Обновляем профиль
            if (this.currentPlayerId) {
                const updatedPlayer = this.playersManager.getPlayerById(this.currentPlayerId);
                if (updatedPlayer) {
                    this.updatePlayerProfile(updatedPlayer);
                }
            }
            
            // Закрываем модальное окно
            this.hideEditModal();
            
            this.showSuccess(`Имя успешно изменено на "${newName}"`);
            
        } catch (error) {
            console.error('❌ Ошибка при изменении имени:', error);
            this.showError(`Ошибка: ${error.message}`);
        }
    }

    // 🔥 Вспомогательные методы для уведомлений
    showError(message) {
        const nameInput = document.getElementById('new-player-name');
        if (nameInput) {
            nameInput.classList.add('error');
        }
        
        // Временное уведомление
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
        
        // Обновляем кнопку редактирования (если нужно)
        const editBtn = document.getElementById('edit-player-name-btn');
        if (editBtn) {
            editBtn.textContent = '✏️ Изменить имя';
        }
    }

    showNotification(message, type = 'info') {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            font-weight: 500;
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}