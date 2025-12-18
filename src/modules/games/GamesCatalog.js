export class GamesCatalog {
    constructor(sessionsManager, bggRatingsService = null, gameStatsManager = null) {
        console.log('🎮 GamesCatalog создается');
        this.games = [];
        this.filteredGames = [];
        this.filters = { search: '', players: '', time: '', sort: 'name' };
        this.pendingFilters = { ...this.filters }; 
        this.sessionsManager = sessionsManager;
        this.gameStatsManager = gameStatsManager;
        this.bggRatingsService = bggRatingsService;
        this.gameTags = {};
        this.selectedTags = new Set();
        this.randomGameResult = null;
        console.log('🎮 GamesCatalog создан, sessionsManager установлен:', this.sessionsManager);
    }
    
    async enhanceGamesWithBggRatings() {
        if (!this.bggRatingsService) {
            console.error('❌ bggRatingsService не передан в GamesCatalog!');
            return;
        }
        
        if (!this.bggRatingsService.isLoaded) {
            console.log('⏳ Ожидаем загрузки рейтингов BGG...');
            await this.bggRatingsService.loadRatings();
        }
        
        console.log('🎯 Улучшаем игры рейтингами BGG...');
        let enhancedCount = 0;
        let notFoundCount = 0;
        
        // Проверим первые 10 игр чтобы понять проблему
        this.games.slice(0, 10).forEach((game, index) => {
            const bggRating = this.bggRatingsService.getRating(game.name);
            
            if (bggRating) {
                game.bggRating = bggRating;
                enhancedCount++;
                console.log(`✅ "${game.name}" → ${bggRating}`);
            } else {
                notFoundCount++;
                console.log(`❌ Не найден рейтинг для: "${game.name}"`);
                
                // Попробуем найти альтернативные варианты
                const normalizedName = game.name.toLowerCase().trim();
                console.log(`🔍 Нормализованное имя: "${normalizedName}"`);
                
                // Проверим есть ли похожие ключи в рейтингах
                let foundSimilar = false;
                for (let [key, value] of this.bggRatingsService.ratings) {
                    if (key.includes(normalizedName) || normalizedName.includes(key)) {
                        console.log(`🔍 Возможное совпадение: "${key}" → ${value}`);
                        foundSimilar = true;
                    }
                }
                if (!foundSimilar) {
                    console.log(`🔍 Нет похожих ключей в рейтингах`);
                }
            }
        });
        
        // Обработаем остальные игры без логов
        this.games.slice(10).forEach((game) => {
            const bggRating = this.bggRatingsService.getRating(game.name);
            if (bggRating) {
                game.bggRating = bggRating;
                enhancedCount++;
            } else {
                notFoundCount++;
            }
        });
        
        console.log(`✅ Улучшено ${enhancedCount} игр рейтингами BGG из ${this.games.length}`);
        console.log(`❌ Не найдено рейтингов для: ${notFoundCount} игр`);
    }

    async init() {
        await this.loadGamesData();
        await this.loadGameTags();
        if (this.bggRatingsService) {
            await this.enhanceGamesWithBggRatings();
        }
        this.initEventListeners();
        this.initTagFilters();
        this.renderGames();
        this.updateStats();
    }
    
    async loadGamesData() {
        try {
            const response = await fetch('assets/data/tesera-collection.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            this.games = await response.json();
            this.filteredGames = [...this.games];
            console.log(`✅ Загружено игр: ${this.games.length}`);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            this.showError('Не удалось загрузить коллекцию игр');
        }
    }

    async loadGameTags() {
        try {
            const response = await fetch('assets/data/game-tags.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            this.gameTags = await response.json();
            console.log(`✅ Загружено тегов для ${Object.keys(this.gameTags).length} игр`);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки тегов:', error);
            this.gameTags = {};
        }
    }
    
    initEventListeners() {
        // Кнопка применения фильтров
        const applyFiltersBtn = document.getElementById('apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.filters = { ...this.pendingFilters };
                this.applyFilters();
            });
        }
        
        // Кнопка сброса фильтров
        const resetFiltersBtn = document.getElementById('reset-filters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
        
        // Поиск (теперь сохраняем в pendingFilters)
        const searchInput = document.getElementById('game-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.pendingFilters.search = e.target.value.toLowerCase();
            });
            
            // Поиск по Enter
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filters = { ...this.pendingFilters };
                    this.applyFilters();
                }
            });
        }
        
        // Фильтр по игрокам (сохраняем в pendingFilters)
        const playersFilter = document.getElementById('players-filter');
        if (playersFilter) {
            playersFilter.addEventListener('change', (e) => {
                this.pendingFilters.players = e.target.value;
            });
        }
        
        // Фильтр по времени (сохраняем в pendingFilters)
        const timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                this.pendingFilters.time = e.target.value;
            });
        }
        
        // Сортировка (применяем сразу)
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.applyFilters();
            });
        }
        
        // Закрытие модального окна по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    initTagFilters() {
        this.createTagFilterUI();
        this.setupTagFilterEvents();
    }

    createTagFilterUI() {
        const filtersContainer = document.getElementById('tag-filters-container');
        if (!filtersContainer) return;

        const allTags = this.getAllUniqueTags();
        const tagsByCategory = this.groupTagsByCategory(allTags);

        let tagsHTML = '';
        Object.entries(tagsByCategory).forEach(([category, englishTags]) => {
            if (englishTags.length > 0) {
                // 🎯 ИЗМЕНЕНИЕ: начальное состояние collapsed
                tagsHTML += `
                    <div class="tag-category-compact">
                        <div class="category-header" onclick="
                            const container = this.nextElementSibling;
                            const toggle = this.querySelector('.category-toggle');
                            if (container.style.display === 'none' || container.style.display === '') {
                                container.style.display = 'grid';
                                toggle.textContent = '▼';
                            } else {
                                container.style.display = 'none';
                                toggle.textContent = '▶';
                            }
                        ">
                            <span class="category-title">${category}</span>
                            <span class="category-toggle">▶</span> <!-- 🎯 Поменял на ▶ -->
                        </div>
                        <div class="tags-container" style="display: none;"> <!-- 🎯 ИЗНАЧАЛЬНО СВЕРНУТО -->
                            ${englishTags.map(englishTag => {
                                const russianName = this.getTagTranslation(englishTag);
                                return `
                                    <button class="tag-btn-compact" data-tag="${englishTag}">
                                        ${russianName}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        });

        filtersContainer.innerHTML = tagsHTML;
    }

    getTagTranslation(englishTag) {
        // СЛОВАРЬ ПЕРЕВОДА: английский ключ → русское название
        const tagTranslations = {
                // Тип игры
                'eurogame': 'евроигра',
                'ameritrash': 'америтреш', 
                'hybrid': 'гибрид',
                'abstract': 'абстрактная',
                'partygame': 'для вечеринок',
                'wargame': 'варгейм',
                'gateway': 'для новичков',
                '4x-strategy': '4х стратегия',
                
                // Тематика
                'fantasy': 'фэнтези',
                'sci-fi': 'научная фантастика',
                'historical': 'историческая',
                'horror': 'ужасы',
                'detective': 'детектив',
                'ancient': 'античность',
                'medieval': 'средневековье',
                'cyberpunk': 'киберпанк',
                'space': 'космос',
                'farm': 'ферма',
                'humor': 'юмор',
                
                // Механики
                'deckbuilding': 'колодостроение',
                'meepleplacement': 'рабочие',
                'card-driven': 'карточная',
                'dice-rolling': 'кубики',
                'area-control': 'контроль территорий',
                'set-collection': 'сбор коллекций',
                'tile-placement': 'выкладывание плиток',
                'auction': 'аукцион',
                'bluffing': 'блеф',
                'drafting': 'драфт',
                'trading': 'торговля',
                'engine-building': 'построение двигателя',
                'pick-up-deliver': 'доставка',
                'push-your-luck': 'испытай удачу',
                'social-deduction': 'социальная дедукция',
                'дедукция': 'дедукция',
                'roll-and-write': 'брось и рисуй',
                'dexterity': 'ловкость',
                
                // Взаимодействие
                'cooperative': 'кооперативная',
                'competitive': 'соревновательная',
                'one-vs-all': '1 против всех',
                'team-based': 'командная',
                'hidden-roles': 'скрытые роли',
                'minimal-interaction': 'минимальное взаимодействие',
                
                // Особенности
                'compact': 'компактная',
                'asymmetric': 'асимметричная',
                'modular-board': 'модульное поле',
                'campaign': 'кампания',
                'legacy': 'легаси',
                'solo': 'соло',
                'duel': 'дуэльная',
                'scalable': 'масштабируемая',
                
                // Дополнения
                'дополнение': 'дополнение'
            };
        return tagTranslations[englishTag] || englishTag;
    }

    getAllUniqueTags() {
        const allTags = new Set();
        Object.values(this.gameTags).forEach(tags => {
            tags.forEach(tag => allTags.add(tag));
        });
        return Array.from(allTags).sort();
    }

    groupTagsByCategory(tags) {
        // Группируем английские ключи по категориям
        const categories = {
            "🎯 Тип игры": ['eurogame', 'ameritrash', 'hybrid', 'abstract', 'partygame', 'wargame', 'gateway', '4x-strategy'],
            "🎭 Тематика": ['fantasy', 'sci-fi', 'historical', 'horror', 'detective', 'ancient', 'medieval', 'cyberpunk', 'space', 'farm', 'humor'],
            "⚙️ Механики": ['deckbuilding', 'meepleplacement', 'card-driven', 'dice-rolling', 'area-control', 'set-collection', 'tile-placement', 'auction', 'bluffing', 'drafting', 'trading', 'engine-building', 'pick-up-deliver', 'push-your-luck', 'social-deduction', 'дедукция', 'roll-and-write', 'dexterity'],
            "👥 Взаимодействие": ['cooperative', 'competitive', 'one-vs-all', 'team-based', 'hidden-roles', 'minimal-interaction'],
            "📦 Особенности": ['compact', 'asymmetric', 'modular-board', 'campaign', 'legacy', 'solo', 'duel', 'scalable'],
            "🔄 Дополнения": ['дополнение']
        };

        // Фильтруем теги которые есть в базе и переводим
        const result = {};
        Object.entries(categories).forEach(([category, englishTags]) => {
            const availableTags = englishTags.filter(tag => tags.includes(tag));
            if (availableTags.length > 0) {
                result[category] = availableTags;
            }
        });

        return result;
    }

    setupTagFilterEvents() {
        // Обработчики для тегов
        document.querySelectorAll('.tag-btn-compact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.toggleTagFilter(tag);
            });
        });
    }

    toggleTagFilter(tag) {
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
        } else {
            this.selectedTags.add(tag);
        }
        this.updateFilterUI();
        this.applyFilters();
    }

    updateFilterUI() {
        // Обновляем кнопки тегов
        document.querySelectorAll('.tag-btn-compact').forEach(btn => {
            btn.classList.toggle('active', this.selectedTags.has(btn.dataset.tag));
        });

        // Показываем выбранные теги
        const selectedTagsContainer = document.getElementById('selected-tags');
        if (selectedTagsContainer) {
            if (this.selectedTags.size > 0) {
                selectedTagsContainer.innerHTML = `
                    <div class="selected-tags-header">
                        <strong>Выбрано тегов: ${this.selectedTags.size}</strong>
                        <button class="clear-filters-btn" onclick="app.gamesCatalog.clearTagFilters()">
                            ❌ Очистить теги
                        </button>
                    </div>
                    <div class="selected-tags-list">
                        ${Array.from(this.selectedTags).map(tag => `
                            <span class="selected-tag">${tag}</span>
                        `).join('')}
                    </div>
                `;
            } else {
                selectedTagsContainer.innerHTML = '';
            }
        }
    }

    clearTagFilters() {
        this.selectedTags.clear();
        this.updateFilterUI();
        this.applyFilters();
    }
    
    resetFilters() {
        // Сбрасываем все фильтры
        this.filters = { search: '', players: '', time: '', sort: 'name' };
        this.pendingFilters = { ...this.filters };
        this.selectedTags.clear();
        
        // Сбрасываем значения в форме
        const searchInput = document.getElementById('game-search');
        const playersFilter = document.getElementById('players-filter');
        const timeFilter = document.getElementById('time-filter');
        const sortSelect = document.getElementById('sort-select');
        
        if (searchInput) searchInput.value = '';
        if (playersFilter) playersFilter.value = '';
        if (timeFilter) timeFilter.value = '';
        if (sortSelect) sortSelect.value = 'name';

        this.updateFilterUI();
        this.applyFilters();
    }
    
    applyFilters() {
        console.log('🔍 Применяем фильтры...', {
            теги: Array.from(this.selectedTags),
            поиск: this.filters.search,
            игроки: this.filters.players,
            время: this.filters.time,
            сортировка: this.filters.sort
        });
        
        let filtered = [...this.games];
        
        // Фильтрация по тегам
        if (this.selectedTags.size > 0) {
            filtered = filtered.filter(game => {
                const gameTags = this.gameTags[game.name] || [];
                return Array.from(this.selectedTags).every(tag => 
                    gameTags.includes(tag)
                );
            });
        }
        
        // Поиск по названию
        if (this.filters.search) {
            filtered = filtered.filter(game => 
                game.name.toLowerCase().includes(this.filters.search)
            );
        }
        
        // Фильтр по игрокам
        if (this.filters.players) {
            filtered = filtered.filter(game => {
                if (!game.players) return false;
                
                const players = game.players.split('-').map(p => parseInt(p.trim()));
                const filterPlayers = parseInt(this.filters.players);
                
                if (players.length === 2) {
                    return players[0] <= filterPlayers && players[1] >= filterPlayers;
                }
                return players[0] === filterPlayers;
            });
        }
        
        // Фильтр по времени
        if (this.filters.time) {
            const maxTime = parseInt(this.filters.time);
            filtered = filtered.filter(game => {
                if (!game.duration) return false;
                
                const times = game.duration.match(/\d+/g);
                if (times && times.length > 0) {
                    const avgTime = times.reduce((sum, time) => sum + parseInt(time), 0) / times.length;
                    return maxTime === 121 ? avgTime > 120 : avgTime <= maxTime;
                }
                return false;
            });
        }
        
        // Сортировка
        filtered.sort((a, b) => {
            switch (this.filters.sort) {
                case 'rating':
                    // ТОЛЬКО BGG РЕЙТИНГ - убираем Tesera
                    const ratingA = a.bggRating || 0;  // ← a - первая игра для сравнения
                    const ratingB = b.bggRating || 0;  // ← b - вторая игра для сравнения
                    return ratingB - ratingA;
                case 'year':
                    return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
                case 'players':
                    const aPlayers = a.players ? Math.max(...a.players.split('-').map(p => parseInt(p.trim())).filter(p => !isNaN(p))) : 0;
                    const bPlayers = b.players ? Math.max(...b.players.split('-').map(p => parseInt(p.trim())).filter(p => !isNaN(p))) : 0;
                    return bPlayers - aPlayers;
                default: // name
                    return a.name.localeCompare(b.name);
            }
        });
        
        this.filteredGames = filtered;
        this.renderGames();
        this.updateStats();
    }
    
    renderGames() {
        const gamesGrid = document.getElementById('games-grid');
        const noGames = document.getElementById('no-games');
        
        if (!gamesGrid) return;
        
        if (this.filteredGames.length === 0) {
            gamesGrid.innerHTML = '';
            if (noGames) noGames.style.display = 'block';
            return;
        }
        
        if (noGames) noGames.style.display = 'none';
        
        const gamesHTML = this.filteredGames.map(game => this.createGameCard(game)).join('');
        gamesGrid.innerHTML = gamesHTML;
        
        // ВАЖНО: Добавляем обработчики после рендера
        this.setupGameCardListeners();
    }

    setupGameCardListeners() {
        const gameCards = document.querySelectorAll('.game-card');
        console.log('🎮 Найдено карточек игр:', gameCards.length);
        
        gameCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Предотвращаем всплытие, если кликнули на внутренний элемент
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                    return;
                }
                
                const gameId = card.dataset.gameId;
                console.log('🎮 Клик по карточке игры ID:', gameId);
                
                if (gameId) {
                    this.showGameDetails(parseInt(gameId));
                }
            });
        });
    }
    
    createGameCard(game) {
        const imageUrl = game.imageUrl || '';
        
        // Рейтинг BGG
        let ratingHTML = '—';
        if (game.bggRating) {
            ratingHTML = `<span class="game-rating bgg-rating">🎲 ${game.bggRating}</span>`;
        }
        
        const year = game.year || '—';
        const players = game.players || '—';
        const duration = game.duration || '—';
        
        return `
            <div class="game-card" data-game-id="${game.id}">
                <div class="game-image-container">
                    ${imageUrl ? `
                        <img src="${imageUrl}" alt="${game.name}" class="game-image" 
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <div class="game-image-placeholder" style="display: none;">🎮</div>
                    ` : `
                        <div class="game-image-placeholder">🎮</div>
                    `}
                </div>
                <div class="game-info">
                    <div class="game-title">${this.escapeHtml(game.name)}</div>
                    <div class="game-meta">
                        ${ratingHTML}
                        <span class="game-year">${year}</span>
                    </div>
                    <div class="game-meta">
                        <span>👥 ${players}</span>
                        <span>⏱ ${duration}</span>
                    </div>
                    <!-- ❌ ТЕГИ УБРАНЫ - они теперь только в модальном окне -->
                </div>
            </div>
        `;
    }
    
    showGameDetails(gameId) {
        console.log('🎮 Показываем детали игры ID:', gameId);
        
        const game = this.games.find(g => g.id === gameId);
        if (!game) {
            console.error('❌ Игра не найдена ID:', gameId);
            return;
        }
        
        const modal = document.getElementById('game-modal');
        const title = document.getElementById('modal-game-title');
        const details = document.getElementById('modal-game-details');
        
        if (!modal || !title || !details) {
            console.error('❌ Элементы модального окна не найдены');
            return;
        }
        
        title.textContent = game.name;
        details.innerHTML = this.createGameDetailsHTML(game);
        
        modal.style.display = 'flex';
        this.setupModalCloseHandlers();
    }
        
    setupModalCloseHandlers() {
        const modal = document.getElementById('game-modal');
        if (!modal) return;

        // Закрытие по кнопке ×
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }

        // Закрытие по клику вне окна
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };

        // Закрытие по Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
    }

    closeModal() {
        const modal = document.getElementById('game-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    createGameDetailsHTML(game) {
        const imageUrl = game.imageUrl || '';
        
        console.log('🎮 Создаем детали для игры:', game.name);
        console.log('📊 this.gameStatsManager:', this.gameStatsManager);
        
        // 🔥 ИСПРАВЛЕНИЕ: Используем gameStatsManager вместо sessionsManager!
        const gameStats = this.gameStatsManager?.getGameStats?.(game.name);
        console.log('📊 Результат getGameStats (через gameStatsManager):', gameStats);
        
        const topPlayers = gameStats ? this.gameStatsManager?.getTopPlayers?.(game.name, 3) : null;
        const bestScore = gameStats ? this.gameStatsManager?.getBestScore?.(game.name) : null;
        
        console.log('🥇 Топ игроков:', topPlayers);
        console.log('🏆 Лучший счет:', bestScore);
        
        // ... остальной код без изменений
        const gameTags = this.gameTags[game.name] || [];
        const tagsHTML = gameTags.length > 0 ? `
            <div class="game-detail-section">
                <h4>🏷️ Теги</h4>
                <div class="game-tags-modal">
                    ${gameTags.map(tag => `<span class="game-tag-modal">${tag}</span>`).join('')}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="game-detail-content">
                <!-- Картинка -->
                <div class="game-detail-section">
                    ${imageUrl ? `
                        <img src="${imageUrl}" alt="${game.name}" 
                            class="game-detail-image"
                            onerror="this.style.display='none'">
                    ` : `
                        <div class="game-image-placeholder-large">
                            <div>🎮</div>
                        </div>
                    `}
                </div>
                
                <!-- Теги игры -->
                ${tagsHTML}
                
                <!-- Основная информация (из JSON) -->
                <div class="game-detail-section">
                    <h4>📊 Информация</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Игроки:</strong> ${game.players || '—'}
                        </div>
                        <div class="detail-item">
                            <strong>Время партии:</strong> ${game.duration || '—'}
                        </div>
                        <div class="detail-item">
                            <strong>Возраст:</strong> ${game.age || '—'}
                        </div>
                        <div class="detail-item">
                            <strong>Год издания:</strong> ${game.year || '—'}
                        </div>
                        <div class="detail-item">
                            <strong>Рейтинг BGG:</strong> ${game.bggRating ? '🎲 ' + game.bggRating : '—'}
                        </div>
                    </div>
                </div>
                
                <!-- Авторы -->
                ${game.authors && game.authors.length > 0 ? `
                <div class="game-detail-section">
                    <h4>👨‍💻 Авторы</h4>
                    <p>${game.authors.join(', ')}</p>
                </div>
                ` : ''}
                
                <!-- Издатели -->
                ${game.publishers && game.publishers.length > 0 ? `
                <div class="game-detail-section">
                    <h4>🏢 Издатели</h4>
                    <p>${game.publishers.join(', ')}</p>
                </div>
                ` : ''}
                
                <!-- СТАТИСТИКА ИГРЫ (реальная) -->
                <div class="game-detail-section">
                    <h4>📈 Статистика игры</h4>
                    ${gameStats && gameStats.totalPlays > 0 ? `
                        <div class="stats-grid-small">
                            <div class="stat-item-small">
                                <div class="stat-label-small">Всего партий</div>
                                <div class="stat-value-small">${gameStats.totalPlays}</div>
                            </div>
                            ${gameStats.minDuration ? `
                            <div class="stat-item-small">
                                <div class="stat-label-small">Самая короткая</div>
                                <div class="stat-value-small">${gameStats.minDuration} мин</div>
                            </div>
                            ` : ''}
                            ${gameStats.maxDuration ? `
                            <div class="stat-item-small">
                                <div class="stat-label-small">Самая длинная</div>
                                <div class="stat-value-small">${gameStats.maxDuration} мин</div>
                            </div>
                            ` : ''}
                        </div>
                    ` : `
                        <p class="no-stats">По этой игре пока нет сыгранных партий</p>
                    `}
                </div>
                
                <!-- ЛУЧШИЕ ИГРОКИ (реальные) -->
                ${topPlayers && topPlayers.length > 0 ? `
                <div class="game-detail-section">
                    <h4>🏆 Лучшие игроки</h4>
                    <div class="players-ranking">
                        ${topPlayers.map((player, index) => `
                            <div class="player-rank-item">
                                <div class="player-rank">
                                    <span class="rank-medal">${this.getRankMedal(index)}</span>
                                    <span class="player-name">${player.name}</span>
                                </div>
                                <div class="player-stats">
                                    ${player.wins}/${player.total} (${player.percentage}%)
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- РЕКОРДЫ (реальные) -->
                ${bestScore ? `
                <div class="game-detail-section">
                    <h4>📊 Рекорды</h4>
                    <div class="records-list">
                        <div class="record-item">
                            <span class="record-label">Лучший счет:</span>
                            <span class="record-value">${bestScore.player} - ${bestScore.score} очков</span>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- Ссылка на Tesera -->
                <div class="game-detail-section">
                    <a href="${game.teseraUrl}" target="_blank" class="tesera-link">
                        🔗 Открыть на Tesera
                    </a>
                </div>
            </div>
        `;
    }

    getRankMedal(index) {
        switch(index) {
            case 0: return '🥇';
            case 1: return '🥈'; 
            case 2: return '🥉';
            default: return `${index + 1}.`;
        }
    }
    
    updateStats() {
        const totalGames = document.getElementById('total-games');
        const shownGames = document.getElementById('shown-games');
        
        if (totalGames) totalGames.textContent = this.games.length;
        if (shownGames) shownGames.textContent = this.filteredGames.length;
        
        // Обновляем заголовок с количеством игр
        const gamesTitle = document.querySelector('.games-title');
        if (gamesTitle) {
            gamesTitle.textContent = `Каталог игр (${this.games.length})`;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showError(message) {
        const gamesGrid = document.getElementById('games-grid');
        if (gamesGrid) {
            gamesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">😕</div>
                    <h3>${message}</h3>
                    <p>Попробуйте обновить страницу</p>
                </div>
            `;
        }
    }

    // =============================================
    // 🎲 МЕТОДЫ ДЛЯ СЛУЧАЙНОЙ ИГРЫ
    // =============================================

    initRandomGameButton() {
        const randomGameBtn = document.getElementById('random-game-btn');
        if (randomGameBtn) {
            randomGameBtn.addEventListener('click', () => {
                this.getRandomGame();
            });
        }
    }

    getFilteredGamesForRandom(includeExpansions = false) {
        let filtered = [...this.filteredGames];
        
        // Если не указано явно включать дополнения, фильтруем их
        if (!includeExpansions) {
            filtered = filtered.filter(game => {
                const gameTags = this.gameTags[game.name] || [];
                // Исключаем игры с тегами "дополнение" или "expansion"
                return !gameTags.includes('дополнение') && !gameTags.includes('expansion');
            });
        }
        
        // Можно добавить другие фильтры по желанию
        // Например, исключать игры без картинок или с низким рейтингом
        
        return filtered;
    }

    // И обновите getRandomGame():
    getRandomGame(includeExpansions = false) {
        console.log('🎲 Выбираю случайную игру...', { includeExpansions });
        
        // Получаем отфильтрованный список
        let availableGames = this.getFilteredGamesForRandom(includeExpansions);
        
        // Если игр нет, показываем предложение
        if (availableGames.length === 0) {
            this.showNoGamesWithOptions(includeExpansions);
            return;
        }
        
        // Выбираем случайную игру
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        const randomGame = availableGames[randomIndex];
        
        console.log('✅ Случайная игра выбрана:', randomGame.name);
        this.showRandomGameResult(randomGame);
    }

    // Новый метод для показа вариантов когда нет игр
    showNoGamesWithOptions(includeExpansions) {
        const resultContainer = document.getElementById('random-game-result');
        if (!resultContainer) return;
        
        if (!includeExpansions) {
            // Предлагаем включить дополнения
            resultContainer.innerHTML = `
                <div class="no-random-game">
                    <div class="no-random-icon">🎮</div>
                    <h3>Не найдено основных игр</h3>
                    <p>Все игры в текущих фильтрах - это дополнения</p>
                    <div class="random-game-options">
                        <button class="btn-option" onclick="app.gamesCatalog.getRandomGame(true)">
                            🎲 Включить дополнения
                        </button>
                        <button class="btn-option secondary" onclick="app.gamesCatalog.resetFilters()">
                            🔄 Сбросить фильтры
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Нет игр вообще
            resultContainer.innerHTML = `
                <div class="no-random-game">
                    <div class="no-random-icon">😕</div>
                    <h3>Нет подходящих игр</h3>
                    <p>Попробуйте изменить фильтры или выбрать другие теги</p>
                    <button class="btn-reset-filters" onclick="app.gamesCatalog.resetFilters()">
                        🔄 Сбросить фильтры
                    </button>
                </div>
            `;
        }
        
        resultContainer.style.display = 'block';
    }

    showNoGamesMessage() {
        const resultContainer = document.getElementById('random-game-result');
        if (!resultContainer) return;
        
        resultContainer.innerHTML = `
            <div class="no-random-game">
                <div class="no-random-icon">😕</div>
                <h3>Нет подходящих игр</h3>
                <p>Попробуйте изменить фильтры или выбрать другие теги</p>
                <button class="btn-reset-filters" onclick="app.gamesCatalog.resetFilters()">
                    🔄 Сбросить фильтры
                </button>
            </div>
        `;
        resultContainer.style.display = 'block';
        
        // Добавим анимацию
        resultContainer.classList.add('random-game-highlight');
        setTimeout(() => {
            resultContainer.classList.remove('random-game-highlight');
        }, 2000);
    }

    showRandomGameResult(game) {
        const resultContainer = document.getElementById('random-game-result');
        if (!resultContainer) return;
        
        // Получаем теги игры
        const gameTags = this.gameTags[game.name] || [];
        const tagsHTML = gameTags.length > 0 ? `
            <div class="random-game-tags">
                ${gameTags.map(tag => `
                    <span class="random-game-tag">${this.getTagTranslation(tag)}</span>
                `).join('')}
            </div>
        ` : '<p>Теги не указаны</p>';
        
        // Статистика игры
        const gameStats = this.sessionsManager?.getGameStats?.(game.name);
        const statsHTML = gameStats && gameStats.totalPlays > 0 ? `
            <p><strong>Сыграно раз:</strong> ${gameStats.totalPlays}</p>
            ${gameStats.lastPlayed ? `<p><strong>Последний раз:</strong> ${new Date(gameStats.lastPlayed).toLocaleDateString('ru-RU')}</p>` : ''}
        ` : '<p>Ещё не играли</p>';
        
        // 🎯 ТАКИЕ ЖЕ ПРОПОРЦИИ КАК В КАРТОЧКАХ ИГР!
        const imageUrl = game.imageUrl || game.image || ''; // Проверяем разные варианты имени поля
        
        const imageHTML = imageUrl ? `
            <div class="random-game-image-container">
                <img src="${imageUrl}" 
                    alt="${game.name}" 
                    class="random-game-image"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="random-game-image-placeholder" style="display: none;">
                    <span>🎮</span>
                    <span>${game.name}</span>
                </div>
            </div>
        ` : `
            <div class="random-game-image-container">
                <div class="random-game-image-placeholder">
                    <span>🎮</span>
                    <span>${game.name}</span>
                </div>
            </div>
        `;
        
        resultContainer.innerHTML = `
            <div class="random-game-header">
                <div class="random-game-icon">🎮</div>
                <h2 class="random-game-title">${this.escapeHtml(game.name)}</h2>
                <button class="random-game-close" onclick="this.closest('.random-game-result').style.display='none'">×</button>
            </div>
            
            <!-- 🎯 ГЛАВНОЕ: ТАКИЕ ЖЕ ПРОПОРЦИИ КАК В КАРТОЧКАХ -->
            ${imageHTML}
            
            <div class="random-game-details">
                <div class="random-game-info">
                    <h4>📊 Информация</h4>
                    <p><strong>Игроки:</strong> ${game.players || game.players_min + '-' + game.players_max || '—'}</p>
                    <p><strong>Время партии:</strong> ${game.duration || '—'}</p>
                    <p><strong>Год издания:</strong> ${game.year || '—'}</p>
                    ${game.bggRating ? `<p><strong>Рейтинг BGG:</strong> 🎲 ${game.bggRating}</p>` : ''}
                </div>
                
                <div class="random-game-info">
                    <h4>🏷️ Теги</h4>
                    ${tagsHTML}
                </div>
                
                <div class="random-game-info">
                    <h4>📈 Статистика</h4>
                    ${statsHTML}
                </div>
            </div>
        `;
        
        resultContainer.style.display = 'block';
        
        // Анимация появления
        resultContainer.classList.add('random-game-highlight');
        setTimeout(() => {
            resultContainer.classList.remove('random-game-highlight');
        }, 2000);
        
        // 🔧 ДОБАВИТЬ: Принудительное применение стилей
        const imgContainer = resultContainer.querySelector('.random-game-image-container');
        if (imgContainer) {
            // Принудительно устанавливаем размеры
            imgContainer.style.width = '100%';
            imgContainer.style.height = '200px'; // Как в game-card
            imgContainer.style.overflow = 'hidden';
            imgContainer.style.borderRadius = '8px 8px 0 0';
        }
        
        const img = resultContainer.querySelector('.random-game-image');
        if (img) {
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
        }
    }

    openSessionWithGame(gameName) {
        console.log(`🎪 Открываю форму сессии для игры: ${gameName}`);
        
        // Сохраняем выбранную игру
        sessionStorage.setItem('selectedGameForSession', gameName);
        
        // Переходим на страницу сессий
        window.location.hash = '#/sessions';
        
        // Показываем уведомление
        setTimeout(() => {
            this.showNotification(`Игра "${gameName}" выбрана для записи сессии`, 'success');
        }, 500);
    }

    showNotification(message, type = 'info') {
        // Удаляем существующие уведомления
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    // Обновите метод init() для инициализации кнопки
    async init() {
        await this.loadGamesData();
        await this.loadGameTags();
        if (this.bggRatingsService) {
            await this.enhanceGamesWithBggRatings();
        }
        this.initEventListeners();
        this.initTagFilters();
        this.initRandomGameButton(); // 🆕 Инициализируем кнопку случайной игры
        this.renderGames();
        this.updateStats();
    }

}

