export class Statistics {
    constructor(playersManager) {
        this.playersManager = playersManager;
    }

    renderStats(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const playersStats = this.playersManager.getAllPlayersStats();
        const ranking = this.playersManager.getPlayersRanking();

        container.innerHTML = `
            <div class="stats-page">
                <div class="stats-header">
                    <h1>📊 Статистика игроков</h1>
                    <p>Анализ результатов и достижений</p>
                </div>

                ${playersStats.length > 0 ? `
                    <div class="stats-sections">
                        <!-- Рейтинг игроков -->
                        <div class="stats-section">
                            <h2>🏆 Рейтинг игроков</h2>
                            <div class="ranking-list">
                                ${ranking.map((player, index) => this.createRankingItem(player, index)).join('')}
                            </div>
                        </div>

                        <!-- Детальная статистика -->
                        <div class="stats-section">
                            <h2>📈 Детальная статистика</h2>
                            <div class="players-stats-grid">
                                ${playersStats.map(player => this.createPlayerStatsCard(player)).join('')}
                            </div>
                        </div>

                        <!-- Общая статистика -->
                        <div class="stats-section">
                            <h2>📋 Общая статистика</h2>
                            <div class="overall-stats">
                                ${this.createOverallStats(playersStats)}
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="no-stats">
                        <div class="no-stats-icon">📊</div>
                        <h3>Нет данных для статистики</h3>
                        <p>Сыграйте несколько игр чтобы увидеть статистику</p>
                    </div>
                `}
            </div>
        `;
    }

    createRankingItem(player, index) {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        
        return `
            <div class="ranking-item ${index < 3 ? 'top-three' : ''}">
                <div class="ranking-position">
                    <span class="medal">${medal}</span>
                </div>
                <div class="ranking-player">
                    <strong>${player.playerName}</strong>
                    <span class="player-stats">${player.wins} побед • ${player.winRate}%</span>
                </div>
                <div class="ranking-badge">
                    ${this.getRankBadge(index)}
                </div>
            </div>
        `;
    }

    createPlayerStatsCard(player) {
        return `
            <div class="player-stats-card">
                <div class="player-stats-header">
                    <h3>${player.playerName}</h3>
                    <span class="win-rate ${player.winRate > 50 ? 'positive' : 'negative'}">
                        ${player.winRate}%
                    </span>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${player.totalGames}</div>
                        <div class="stat-label">Всего игр</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${player.wins}</div>
                        <div class="stat-label">Побед</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${player.losses}</div>
                        <div class="stat-label">Поражений</div>
                    </div>
                </div>

                <div class="detailed-stats">
                    <div class="detail-item">
                        <span>⭐ Любимая игра:</span>
                        <strong>${player.favoriteGame ? player.favoriteGame.game : 'Нет данных'}</strong>
                    </div>
                    <div class="detail-item">
                        <span>⏱ Среднее время:</span>
                        <strong>${player.averagePlayTime} мин</strong>
                    </div>
                    <div class="detail-item">
                        <span>🔥 Текущая серия:</span>
                        <strong class="${player.streaks.currentWinStreak > 0 ? 'positive' : ''}">
                            ${player.streaks.currentWinStreak > 0 ? `${player.streaks.currentWinStreak} побед` : 'Нет'}
                        </strong>
                    </div>
                    <div class="detail-item">
                        <span>📈 Лучшая серия:</span>
                        <strong>${player.streaks.longestWinStreak} побед</strong>
                    </div>
                </div>
            </div>
        `;
    }

    createOverallStats(playersStats) {
        const totalGames = playersStats.reduce((sum, player) => sum + player.totalGames, 0);
        const totalPlayTime = playersStats.reduce((sum, player) => sum + player.totalPlayTime, 0);
        const averageWinRate = Math.round(playersStats.reduce((sum, player) => sum + player.winRate, 0) / playersStats.length);
        
        const mostWins = playersStats.sort((a, b) => b.wins - a.wins)[0];
        const bestWinRate = playersStats.sort((a, b) => b.winRate - a.winRate)[0];
        const mostActive = playersStats.sort((a, b) => b.totalGames - a.totalGames)[0];

        return `
            <div class="overall-stats-grid">
                <div class="overall-stat">
                    <div class="overall-value">${totalGames}</div>
                    <div class="overall-label">Всего сыграно игр</div>
                </div>
                <div class="overall-stat">
                    <div class="overall-value">${Math.round(totalPlayTime / 60)}</div>
                    <div class="overall-label">Часов игры</div>
                </div>
                <div class="overall-stat">
                    <div class="overall-value">${averageWinRate}%</div>
                    <div class="overall-label">Средний win rate</div>
                </div>
            </div>

            <div class="achievements">
                <h4>🏅 Достижения</h4>
                <div class="achievement-list">
                    <div class="achievement">
                        <span>👑 Больше всего побед:</span>
                        <strong>${mostWins.playerName} (${mostWins.wins})</strong>
                    </div>
                    <div class="achievement">
                        <span>🎯 Лучший процент побед:</span>
                        <strong>${bestWinRate.playerName} (${bestWinRate.winRate}%)</strong>
                    </div>
                    <div class="achievement">
                        <span>⚡ Самый активный:</span>
                        <strong>${mostActive.playerName} (${mostActive.totalGames} игр)</strong>
                    </div>
                </div>
            </div>
        `;
    }

    getRankBadge(index) {
        if (index === 0) return '<span class="badge gold">Чемпион</span>';
        if (index === 1) return '<span class="badge silver">Второй</span>';
        if (index === 2) return '<span class="badge bronze">Третий</span>';
        return `<span class="badge">${index + 1} место</span>`;
    }
}