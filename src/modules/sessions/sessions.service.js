import { SessionsPagination } from './SessionsPagination.js';

export class SessionsService {
    constructor(sessionsManager, gamesCatalog, playersManager) {
        this.sessionsManager = sessionsManager;
        this.gamesCatalog = gamesCatalog;
        this.playersManager = playersManager;
        this.pendingDeletions = new Map();
        this.currentRounds = 3;
        this.selectedWinner = null;
        this.selectedTeamWinner = null;
        this.gameType = 'scoring';
        this.isTeamGame = false;
        this.allGames = [];
        this.selectedGame = null;
        this.gameTags = {};
        this.allExpansions = new Map();  
        this.pagination = new SessionsPagination(this);
        
        // 🚀 ОПТИМИЗАЦИЯ: Дебаунс для частых обновлений
        this.renderDebounceTimer = null;
        this.statsDebounceTimer = null;
        
        console.log('🎪 SessionsService создан');
        this.initializeTable();
    }
        
    initializeTable() {
        console.log('📊 Инициализирую таблицу...');
        this.createEmptyTable();
    }

// =====================================================
// 🎯 БЛОК -1: ПОИСК ИГРЫ ДЛЯ СЕССИИ И ВЫБОР ДОПОЛНЕНИЙ
// =====================================================

    async initializeGameSearch() {
        const searchInput = document.getElementById('session-game-search');
        const resultsContainer = document.getElementById('game-search-results');
        const hiddenInput = document.getElementById('session-game');
        
        if (!searchInput || !resultsContainer) return;
        
        // Загружаем все игры
        await this.loadAllGames();
        
        // Обработчик ввода
        searchInput.addEventListener('input', (e) => {
            this.handleGameSearch(e.target.value);
        });
        
        // Очистка выбора
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
        
        // Загрузка при фокусе
        searchInput.addEventListener('focus', () => {
            if (this.allGames.length === 0) {
                this.loadAllGames();
            }
            if (searchInput.value.length >= 2) {
                this.handleGameSearch(searchInput.value);
            }
        });

        // Загружаем теги игр
        await this.loadGameTags();
        
        // Обработчик выбора игры из поиска
        resultsContainer.querySelectorAll('.game-search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const gameName = item.dataset.gameName;
                this.onGameSelected(gameName); // 🆕 Вместо просто selectGame
            });
        });
    }

    async loadAllGames() {
        try {
            let allGamesData = [];
            
            // Загружаем игры
            if (this.gamesCatalog?.games?.length > 0) {
                allGamesData = this.gamesCatalog.games;
            } else {
                const response = await fetch('./assets/data/tesera-collection.json');
                allGamesData = await response.json();
            }
            
            // Загружаем теги игр
            let gameTags = {};
            try {
                const tagsResponse = await fetch('./assets/data/game-tags.json');
                gameTags = await tagsResponse.json();
            } catch (error) {
                console.warn('⚠️ Не удалось загрузить теги игр:', error);
            }
            
            // 🎯 ФИЛЬТРУЕМ: исключаем игры с тегом "дополнение"
            this.allGames = allGamesData.filter(game => {
                const gameName = game.name || game.title || '';
                if (!gameName) return false;
                
                // Получаем теги для этой игры
                const tagsForGame = gameTags[gameName] || [];
                
                // Проверяем, есть ли тег "дополнение"
                const isExpansion = tagsForGame.some(tag => 
                    tag.toLowerCase() === 'дополнение'
                );
                
                // Если есть тег "дополнение" - это дополнение, исключаем
                return !isExpansion;
            });
            
            console.log('🎮 Загружено игр (без дополнений):', this.allGames.length);
            console.log('🎯 Примеры оставшихся игр:', this.allGames.slice(0, 3).map(g => g.name || g.title));
            
        } catch (error) {
            console.error('❌ Ошибка загрузки игр:', error);
            this.allGames = [];
        }
    }

    handleGameSearch(searchTerm) {
        const resultsContainer = document.getElementById('game-search-results');
        if (!resultsContainer) return;
        
        if (!searchTerm || searchTerm.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        
        // Фильтруем игры
        const filteredGames = this.allGames
            .filter(game => {
                const gameName = (game.name || game.title || '').toLowerCase();
                return gameName.includes(searchLower);
            })
            .slice(0, 20); // Ограничиваем количество результатов
        
        if (filteredGames.length === 0) {
            resultsContainer.innerHTML = `
                <div class="game-search-result-item no-results">
                    Ничего не найдено
                </div>
            `;
            resultsContainer.style.display = 'block';
            return;
        }
        
        // Показываем результаты
        resultsContainer.innerHTML = filteredGames.map(game => {
            const gameName = game.name || game.title || 'Без названия';
            const players = game.players || `${game.players_min}-${game.players_max}`;
            const rating = game.rating || game.bggRating || '—';
            
            return `
                <div class="game-search-result-item" 
                    data-game-name="${this.escapeHtml(gameName)}"
                    data-game-id="${game.id || ''}">
                    <span class="game-result-name">${this.escapeHtml(gameName)}</span>
                    <div class="game-result-meta">
                        <span class="game-result-players">👥 ${players}</span>
                        <span class="game-result-rating">⭐ ${rating}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.style.display = 'block';
        
        resultsContainer.querySelectorAll('.game-search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const gameName = item.dataset.gameName;
                // 🚨 ИЗМЕНИ ЭТУ СТРОКУ:
                // Было: this.selectGame(gameName);
                // Стало: this.onGameSelected(gameName);
                this.onGameSelected(gameName);
            });
        });
    }

    selectGame(gameName) {
        const searchInput = document.getElementById('session-game-search');
        const hiddenInput = document.getElementById('session-game');
        const resultsContainer = document.getElementById('game-search-results');
        
        if (!searchInput || !hiddenInput) return;
        
        this.selectedGame = gameName;
        
        // Скрываем поле поиска, показываем выбранную игру
        searchInput.style.display = 'none';
        
        // Создаем блок с выбранной игрой
        const selectedHTML = `
            <div class="game-search-selected">
                <span class="selected-game-name">🎮 ${gameName}</span>
                <button type="button" class="selected-game-clear" id="clear-game-selection">×</button>
            </div>
        `;
        
        // Вставляем после контейнера поиска
        searchInput.insertAdjacentHTML('afterend', selectedHTML);
        
        // Заполняем hidden input
        hiddenInput.value = gameName;
        
        // Скрываем результаты
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
        
        // Обработчик очистки выбора
        document.getElementById('clear-game-selection')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearGameSelection();
        });
    }

    clearGameSelection() {
        const searchInput = document.getElementById('session-game-search');
        const hiddenInput = document.getElementById('session-game');
        const selectedDiv = document.querySelector('.game-search-selected');
        
        if (selectedDiv) {
            selectedDiv.remove();
        }
        
        if (searchInput) {
            searchInput.style.display = 'block';
            searchInput.value = '';
            searchInput.focus();
        }
        
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        this.selectedGame = null;
    }

    // Добавим escapeHtml если нет
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

// =============================================
// 🎯 БЛОК 0: БАЗОВЫЕ ФУНКЦИИ ТАБЛИЦЫ
// =============================================

    createEmptyTable() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="round-header">Раунд</th>
                    <th class="no-players-header">Выберите игроков</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="round-label">Раунд 1</td>
                    <td class="no-players-message">-</td>
                </tr>
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td class="total-label"><strong>ИТОГО</strong></td>
                    <td class="total-cell">0</td>
                </tr>
            </tfoot>
        `;
        
        // Показываем управление раундами (по умолчанию для scoring)
        const roundControls = document.querySelector('.round-controls');
        if (roundControls) {
            roundControls.style.display = 'flex';
        }
    }

    setupScoringTable(players) {
        console.log('🎯 Настраиваю таблицу для игры на очки. Игроки:', players);
        
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        // Полностью очищаем таблицу
        table.innerHTML = '';
        
        // ШАПКА
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th class="round-header">Раунд</th>';
        
        players.forEach(player => {
            const th = document.createElement('th');
            th.className = 'player-header';
            th.dataset.player = player;
            th.textContent = player;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // ТЕЛО ТАБЛИЦЫ (раунды)
        const tbody = document.createElement('tbody');
        
        for (let round = 1; round <= this.currentRounds; round++) {
            const row = document.createElement('tr');
            row.className = 'round-row';
            row.dataset.round = round;
            
            const roundLabel = document.createElement('td');
            roundLabel.className = 'round-label';
            roundLabel.textContent = `Раунд ${round}`;
            row.appendChild(roundLabel);
            
            players.forEach(player => {
                const scoreCell = document.createElement('td');
                scoreCell.className = 'score-cell';
                
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'score-input';
                input.dataset.player = player;
                input.dataset.round = round;
                input.value = '0';

                
                scoreCell.appendChild(input);
                row.appendChild(scoreCell);
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        
        // ПОДВАЛ (ТОЛЬКО ИТОГО - без строки победителя)
        const tfoot = document.createElement('tfoot');
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = '<td class="total-label"><strong>ИТОГО</strong></td>';
        
        players.forEach(player => {
            const totalCell = document.createElement('td');
            totalCell.className = 'total-cell';
            totalCell.dataset.player = player;
            totalCell.textContent = '0';
            totalRow.appendChild(totalCell);
        });
        
        tfoot.appendChild(totalRow);
        table.appendChild(tfoot);
        
        // Настраиваем обработчики
        this.setupTableHandlers();
    }

    setupNonScoringTable(players) {
        console.log('👑 Настраиваю таблицу для игры без очков. Игроки:', players);
        
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        // Полностью очищаем таблицу
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="round-header"></th>
                    <!-- Столбцы будут добавлены динамически -->
                </tr>
            </thead>
            <tbody>
                <!-- Строка выбора победителя будет добавлена -->
            </tbody>
        `;
        
        // ШАПКА
        const tableHead = table.querySelector('thead');
        let headerHTML = '<tr><th class="round-header"></th>';
        players.forEach(player => headerHTML += `<th class="player-header">${player}</th>`);
        headerHTML += '</tr>';
        tableHead.innerHTML = headerHTML;
        
        // ТОЛЬКО СТРОКА ВЫБОРА ПОБЕДИТЕЛЯ
        const tableBody = table.querySelector('tbody');
        const winnerRow = document.createElement('tr');
        winnerRow.className = 'winner-selection-row';
        
        const labelCell = document.createElement('td');
        labelCell.textContent = 'Победитель:';
        labelCell.className = 'winner-label';
        winnerRow.appendChild(labelCell);
        
        players.forEach(player => {
            const crownCell = document.createElement('td');
            crownCell.className = 'crown-cell';
            
            // 🆕 ВАЖНО: Добавляем скрытую радиокнопку!
            const radioId = `winner_${player.replace(/\s+/g, '_')}`;
            crownCell.innerHTML = `
                <input type="radio" 
                    name="winner" 
                    id="${radioId}" 
                    value="${player}" 
                    style="display: none;">
                <label for="${radioId}" class="crown-btn-label">
                    <button type="button" class="crown-btn" data-player="${player}">👑</button>
                </label>
            `;
            
            // Обработчик клика по короне
            crownCell.querySelector('.crown-btn').addEventListener('click', (e) => {
                this.selectWinner(player, e.target);
                
                // 🆕 ВАЖНО: Активируем скрытую радиокнопку!
                const radioBtn = crownCell.querySelector('input[type="radio"]');
                if (radioBtn) {
                    radioBtn.checked = true;
                    console.log('✅ Радиокнопка активирована:', player);
                }
            });
            
            winnerRow.appendChild(crownCell);
        });
        
        tableBody.appendChild(winnerRow);
        
        // Скрываем управление раундами
        const roundControls = document.querySelector('.round-controls');
        if (roundControls) {
            roundControls.style.display = 'none';
        }
        
        console.log('✅ Non-scoring таблица создана со скрытыми радиокнопками');
    }


    // Метод для загрузки тегов
    async loadGameTags() {
        try {
            const response = await fetch('./assets/data/game-tags.json');
            this.gameTags = await response.json();
            
            // Создаем маппинг игр и их дополнений
            this.buildExpansionsMapping();
            
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить теги игр:', error);
            this.gameTags = {};
        }
    }

    // Строим маппинг: какая игра какими дополнениями обладает
    buildExpansionsMapping() {
        this.allExpansions.clear();
        
        // Проходим по всем играм с тегом "дополнение"
        Object.entries(this.gameTags).forEach(([gameName, tags]) => {
            if (tags.includes('дополнение')) {
                // Находим основную игру - берем всё до первого ":" или "-"
                let baseGame = gameName;
                
                // Ищем разделители
                const colonIndex = gameName.indexOf(':');
                const dashIndex = gameName.indexOf(' - ');
                const dotIndex = gameName.indexOf('. ');
                
                let splitIndex = -1;
                if (colonIndex > -1) splitIndex = colonIndex;
                else if (dashIndex > -1) splitIndex = dashIndex;
                else if (dotIndex > -1) splitIndex = dotIndex;
                
                if (splitIndex > -1) {
                    baseGame = gameName.substring(0, splitIndex).trim();
                }
                
                // Добавляем в карту
                if (!this.allExpansions.has(baseGame)) {
                    this.allExpansions.set(baseGame, []);
                }
                this.allExpansions.get(baseGame).push(gameName);
                
                console.log(`🧩 Найдено дополнение: "${gameName}" → основная игра: "${baseGame}"`);
            }
        });
        
        console.log('✅ Построена карта дополнений:', this.allExpansions.size, 'основных игр');
    }

    // Находим основную игру для дополнения
    findBaseGameForExpansion(expansionName) {
        // Убираем часть после ":" или " - " чтобы получить название основной игры
        const parts = expansionName.split(/[:—\-]/);
        if (parts.length > 1) {
            return parts[0].trim();
        }
        
        // Или ищем по ключевым словам
        if (expansionName.includes('дополнение') || expansionName.includes('expansion')) {
            // Пытаемся найти основную игру в названии
            const withoutExpansion = expansionName
                .replace(/дополнение/gi, '')
                .replace(/expansion/gi, '')
                .replace(/[:\-—]/g, '')
                .trim();
            
            return withoutExpansion || null;
        }
        
        return null;
    }

    // При выборе игры показываем её дополнения
    onGameSelected(gameName) {
        console.log('🎮 onGameSelected вызван для:', gameName);
        
        // 1. Заполняем поле поиска (старый метод selectGame)
        const searchInput = document.getElementById('session-game-search');
        const hiddenInput = document.getElementById('session-game');
        
        if (searchInput) searchInput.value = gameName;
        if (hiddenInput) hiddenInput.value = gameName;
        
        // 2. Скрываем результаты поиска
        const resultsContainer = document.getElementById('game-search-results');
        if (resultsContainer) resultsContainer.style.display = 'none';
        
        // 3. ПОКАЗЫВАЕМ ДОПОЛНЕНИЯ ЭТОЙ ИГРЫ
        this.showExpansionsForGame(gameName);
    }

    // 🆕 Метод для показа дополнений
    showExpansionsForGame(gameName) {
        console.log('🧩 Ищем дополнения для:', gameName);
        
        const expansionsContainer = document.getElementById('expansions-container');
        if (!expansionsContainer) {
            console.error('❌ Не найден expansions-container');
            return;
        }
        
        // Получаем дополнения
        const expansions = this.getExpansionsForGame(gameName);
        console.log('📋 Найдены дополнения:', expansions);
        
        if (expansions.length > 0) {
            // Создаем чекбоксы
            expansionsContainer.innerHTML = expansions.map(expansion => `
                <label class="expansion-checkbox">
                    <input type="checkbox" 
                        name="expansion" 
                        value="${this.escapeHtml(expansion)}">
                    <span class="expansion-name">${this.escapeHtml(expansion)}</span>
                </label>
            `).join('');
            
            // Вешаем обработчики на чекбоксы
            expansionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const label = e.target.closest('.expansion-checkbox');
                    label.classList.toggle('checked', e.target.checked);
                });
            });
            
        } else {
            expansionsContainer.innerHTML = `
                <p class="no-expansions-message">
                    У "${gameName}" нет зарегистрированных дополнений
                </p>
            `;
        }
    }

    // Получаем дополнения для игры
    getExpansionsForGame(gameName) {
        // Прямой поиск в карте
        if (this.allExpansions.has(gameName)) {
            return this.allExpansions.get(gameName);
        }
        
        // Если прямой поиск не сработал, ищем по частичному совпадению
        const possibleMatches = [];
        
        for (const [baseGame, expansions] of this.allExpansions.entries()) {
            // Проверяем, содержит ли название основной игры часть выбранной игры
            if (gameName.includes(baseGame) || baseGame.includes(gameName)) {
                possibleMatches.push(...expansions);
            }
        }
        
        return possibleMatches;
    }

    // Собираем выбранные дополнения при отправке формы
    getSelectedExpansions() {
        const checkboxes = document.querySelectorAll('input[name="expansion"]:checked');
        const expansions = Array.from(checkboxes).map(cb => cb.value);
        console.log('🧩 Собраны дополнения:', expansions);
        return expansions;
    }


    // =============================================
    // 🎯 БЛОК 1: ОСНОВНЫЕ МЕТОДЫ ИНИЦИАЛИЗАЦИИ
    // =============================================

    setupSessionForm(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        console.log('🔧 Настраиваю форму сессии - СИНХРОННО');
        
        // 1. ДАТА - СРАЗУ
        this.setAutoDate();
        
        // 2. ИГРОКИ - СРАЗУ 
        this.updatePlayersList();
        
        // 3. ПОИСК ИГР - СРАЗУ
        this.initializeGameSearch();
        
        // 4. АВТОВЫБОР ИГРОКОВ - СРАЗУ (но через микро-задержку)
        const players = ['Егор', 'Мама', 'Папа'];
        
        // Микро-задержка чтобы чекбоксы успели отрендериться
        setTimeout(() => {
            const checkboxes = document.querySelectorAll('input[name="session-players"]');
            if (checkboxes.length > 0) {
                checkboxes.forEach(cb => cb.checked = false);
                players.forEach(playerName => {
                    const checkbox = Array.from(checkboxes).find(cb => cb.value === playerName);
                    if (checkbox) checkbox.checked = true;
                });
                this.updateTableVisibility();
                this.updateTeamsPlayersList();
            }
        }, 50); // Всего 50мс, не 500!
        
        // 5. ОСТАЛЬНОЕ - СРАЗУ
        this.setupGameTypeToggle();
        this.setupTeamGameToggle();
        this.setupTeams();
        
        form.onsubmit = (e) => this.handleFormSubmit(e);
        this.updateFormVisibility();
        
        console.log('✅ Форма сессии настроена синхронно');
    }


    // 🆕 МЕТОД ДЛЯ ФИКСИРОВАННОГО АВТОВЫБОРА
    autoSelectFixedPlayers(fixedPlayers) {
        console.log('🎯 Автовыбор игроков:', fixedPlayers);
        
        // Пробуем несколько раз с интервалом (retry логика)
        const trySelect = (attempt = 1, maxAttempts = 5) => {
            console.log(`🎯 Попытка ${attempt} из ${maxAttempts}`);
            
            const checkboxes = document.querySelectorAll('input[name="session-players"]');
            
            if (checkboxes.length === 0) {
                if (attempt < maxAttempts) {
                    console.log(`❌ Чекбоксы не загружены, пробую через 200мс...`);
                    setTimeout(() => trySelect(attempt + 1, maxAttempts), 200);
                } else {
                    console.log('❌ Не удалось загрузить чекбоксы после всех попыток');
                }
                return;
            }
            
            console.log(`✅ Найдено ${checkboxes.length} чекбоксов`);
            
            // Очищаем все выборы
            checkboxes.forEach(cb => cb.checked = false);
            
            // Выбираем наших игроков
            let selectedCount = 0;
            fixedPlayers.forEach(playerName => {
                const checkbox = Array.from(checkboxes).find(cb => cb.value === playerName);
                if (checkbox) {
                    checkbox.checked = true;
                    selectedCount++;
                    console.log(`✅ Выбран: ${playerName}`);
                } else {
                    console.log(`❌ Игрок "${playerName}" не найден среди чекбоксов`);
                }
            });
            
            console.log(`🎯 Выбрано ${selectedCount} из ${fixedPlayers.length} игроков`);
            
            // Обновляем таблицу если выбрали хоть кого-то
            if (selectedCount > 0) {
                setTimeout(() => {
                    this.updateTableVisibility();
                    this.updateTeamsPlayersList();
                }, 50);
            }
        };
        
        // Запускаем первую попытку
        trySelect();
    }
    // 🆕 СОХРАНЕНИЕ ВЫБОРА В LOCALSTORAGE
    savePlayerSelection(players) {
        try {
            localStorage.setItem('auto_selected_players', JSON.stringify(players));
            console.log('💾 Выбор игроков сохранен:', players);
        } catch (e) {
            console.warn('⚠️ Не удалось сохранить выбор игроков:', e);
        }
    }

    // 🆕 ЗАГРУЗКА ВЫБОРА ИЗ LOCALSTORAGE
    loadPlayerSelection() {
        try {
            const saved = localStorage.getItem('auto_selected_players');
            return saved ? JSON.parse(saved) : ['Егор', 'Мама', 'Папа'];
        } catch (e) {
            console.warn('⚠️ Не удалось загрузить выбор игроков:', e);
            return ['Егор', 'Мама', 'Папа'];
        }
    }

    // 🆕 МЕТОД ДЛЯ АВТОМАТИЧЕСКОЙ ДАТЫ
    setAutoDate() {
        const dateInput = document.getElementById('session-date');
        if (!dateInput) {
            console.log('❌ Поле даты не найдено');
            return;
        }
        
        const sessions = this.sessionsManager.sessions;
        
        if (sessions.length === 0) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            console.log('📅 Первая сессия - ставим сегодня:', today);
            return;
        }
        
        // Берём последнюю сессию по дате создания (createdAt) ИЛИ по дате игры (date)
        const lastSession = [...sessions].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date);
            const dateB = new Date(b.createdAt || b.date);
            return dateB - dateA;
        })[0];
        
        if (lastSession && lastSession.date) {
            dateInput.value = lastSession.date;
            console.log('📅 Ставим дату последней сессии:', lastSession.date);
        } else {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            console.log('📅 Нет даты у последней сессии - ставим сегодня:', today);
        }
    }

    // 🆕 КНОПКА "СЕГОДНЯ" ДЛЯ БЫСТРОГО ВЫБОРА
    addTodayButton(dateInput) {
        const container = dateInput.parentElement;
        if (!container) return;
        
        // Проверяем, нет ли уже кнопки
        if (container.querySelector('.today-button')) return;
        
        const todayButton = document.createElement('button');
        todayButton.type = 'button';
        todayButton.className = 'today-button';
        todayButton.textContent = '📅 Сегодня';
        todayButton.title = 'Установить сегодняшнюю дату';
        
        todayButton.addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            console.log('✅ Установлена сегодняшняя дата:', today);
            
            // Визуальный фидбэк
            todayButton.classList.add('active');
            setTimeout(() => todayButton.classList.remove('active'), 500);
        });
        
        // Вставляем кнопку после поля ввода
        dateInput.insertAdjacentElement('afterend', todayButton);
    }

    setupGameTypeToggle() {
        const gameTypeRadios = document.querySelectorAll('input[name="game-type"]');
        const teamGameToggle = document.getElementById('team-game-toggle');
        
        gameTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                console.log('🎮 Выбран тип игры:', e.target.value);
                this.handleGameTypeChange(e.target.value);
            });
        });
        
        if (teamGameToggle) {
            teamGameToggle.addEventListener('change', (e) => {
                console.log('👥 Командная игра:', e.target.checked);
                this.handleTeamGameToggle(e.target.checked);
            });
        }
        
        // Сразу применяем текущее состояние
        const currentType = document.querySelector('input[name="game-type"]:checked')?.value;
        if (currentType) this.handleGameTypeChange(currentType);
    }

    setupTeamGameToggle() {
        const teamGameToggle = document.getElementById('team-game-toggle');
        if (teamGameToggle) {
            teamGameToggle.addEventListener('change', (e) => {
                this.handleTeamGameToggle(e.target.checked);
            });
        }
    }

    // =============================================
    // 🎯 БЛОК 2: УПРАВЛЕНИЕ ВИДИМОСТЬЮ ФОРМЫ
    // =============================================

    handleGameTypeChange(gameType) {
        console.log('🔄 Изменен тип игры:', gameType);
        
        const scoringFields = document.getElementById('scoring-fields');
        const nonScoringFields = document.getElementById('non-scoring-fields');
        
        if (nonScoringFields) nonScoringFields.style.display = 'none';
        if (scoringFields) scoringFields.style.display = 'block';
        
        // 🚨 ВОЗВРАЩАЕМ ОРИГИНАЛЬНЫЙ ВЫЗОВ
        this.updateScoresTableForGameType(gameType);
        this.updateFormVisibility();
    }

    handleTeamGameToggle(isTeamGame) {
        console.log('🔄 Командная игра:', isTeamGame);
        const gameType = document.querySelector('input[name="game-type"]:checked')?.value;
        
        if (isTeamGame) {
            // Инициализируем команды
            this.setupTeams();
            
            // Ждем инициализации и обновляем таблицу если есть команды с игроками
            setTimeout(() => {
                const teams = this.getTeams();
                if (teams.length > 0) {
                    console.log('👥 Найдены существующие команды с игроками, обновляю таблицу');
                    this.updateTableForTeams();
                } else {
                    console.log('👥 Команд нет или они пустые, таблица не обновляется');
                }
            }, 200);
        }
        
        this.updateScoresTableForGameType(gameType);
        this.updateFormVisibility();
    }

    updateFormVisibility() {
        const gameType = document.querySelector('input[name="game-type"]:checked')?.value;
        const isTeamGame = document.getElementById('team-game-toggle')?.checked;
        
        console.log('👁️ Обновляю видимость:', { gameType, isTeamGame });
        
        const teamFields = document.getElementById('team-fields');
        const playersSelection = document.getElementById('players-selection');
        const horizontalScoresContainer = document.querySelector('.horizontal-scores-container');
        
        // Управление видимостью блоков
        if (teamFields && playersSelection) {
            teamFields.style.display = isTeamGame ? 'block' : 'none';
            playersSelection.style.display = 'block'; // 🚨 ВСЕГДА ПОКАЗЫВАЕМ ВЫБОР ИГРОКОВ
        }
        
        // Всегда показываем таблицу и обновляем ее
        if (horizontalScoresContainer) {
            horizontalScoresContainer.style.display = 'block';
            this.updateScoresTableForGameType(gameType);
        }
    }

    updateScoresTableForGameType(gameType) {
        console.log('🔄 Обновление таблицы для типа игры:', gameType);
        
        const isTeamGame = document.getElementById('team-game-toggle')?.checked || false;
        const selectedPlayers = this.getSelectedPlayers();
        const teams = this.getTeams(); // 🆕 Получаем команды из Drag & Drop
        
        // 🚨 УПРАВЛЕНИЕ РАУНДАМИ - ПОКАЗЫВАЕМ/СКРЫВАЕМ
        const roundControls = document.querySelector('.round-controls');
        
        if (gameType === 'non_scoring') {
            // NON_SCORING РЕЖИМ
            if (roundControls) {
                roundControls.style.display = 'none';
            }
            
            if (isTeamGame) {
                // 🆕 КОМАНДНЫЙ NON-SCORING
                this.setupTeamNonScoringTable(teams);
            } else {
                this.setupNonScoringTable(selectedPlayers);
            }
        } else {
            // SCORING РЕЖИМ
            if (roundControls) {
                roundControls.style.display = 'flex';
            }
            
            if (isTeamGame) {
                // 🆕 КОМАНДНЫЙ SCORING
                if (teams.length > 0) {
                    this.setupTeamScoringTable(teams);
                } else {
                    this.createEmptyTable();
                }
            } else {
                if (selectedPlayers.length > 0) {
                    this.setupScoringTable(selectedPlayers);
                } else {
                    this.createEmptyTable();
                }
            }
        }
        
        console.log('✅ Таблица полностью перестроена для типа:', gameType);
    }

    // =============================================
    // 🎯 БЛОК 3: DRAG & DROP СИСТЕМА КОМАНД
    // =============================================

    updateTeamsPlayersList() {
        console.log('🔄 Обновляю список игроков для команд');
        
        const selectedPlayers = this.getSelectedPlayers();
        const unassignedList = document.getElementById('unassigned-players');
        
        if (!unassignedList) return;
        
        // Получаем текущих распределенных игроков
        const allAssignedPlayers = new Set();
        document.querySelectorAll('.team-box:not(.unassigned-box) .draggable-player').forEach(el => {
            allAssignedPlayers.add(el.dataset.player);
        });
        
        // Очищаем список нераспределенных
        unassignedList.innerHTML = '';
        
        // Добавляем выбранных игроков, которые еще не распределены
        selectedPlayers.forEach(player => {
            if (!allAssignedPlayers.has(player)) {
                const playerElement = this.createPlayerElement(player);
                unassignedList.appendChild(playerElement);
            }
        });
        
        // Удаляем игроков из команд, если их выбор снят
        document.querySelectorAll('.draggable-player').forEach(playerEl => {
            const playerName = playerEl.dataset.player;
            if (!selectedPlayers.includes(playerName)) {
                playerEl.remove();
            }
        });
        
        this.updateTeamCounters();
    }

    setupTeams() {
        console.log('👥 Настраиваю Drag & Drop систему команд');
        
        // Инициализируем контейнеры
        this.initTeamsContainers();
        
        // Настраиваем обработчики
        this.setupTeamsEventListeners();
        
        // Заполняем игроками
        this.populateAllPlayers();
        
        this.updateFormVisibility();
    }

    initTeamsContainers() {
        const teamFields = document.getElementById('team-fields');
        if (!teamFields) return;
        
        console.log('🏗️ Создаю контейнеры для команд...');
        
        teamFields.innerHTML = `
            <div class="drag-drop-teams-container">
                <div class="teams-header">
                    <h3>👥 Распределение по командам</h3>
                </div>
                
                <div class="teams-drag-area" id="teams-drag-area">
                    <!-- Не распределенные игроки -->
                    <div class="team-box unassigned-box" id="unassigned-box">
                        <div class="team-header">
                            <h4>🔄 Не распределены</h4>
                            <span class="player-count">0</span>
                        </div>
                        <div class="team-players-list" id="unassigned-players"></div>
                    </div>
                    
                    <!-- 🚨 ВАЖНО: ID должно быть точно team-1-box -->
                    <div class="team-box" id="team-1-box">
                        <div class="team-header">
                            <input type="text" class="team-name-input" value="Команда А" placeholder="Название команды">
                            <span class="player-count">0</span>
                        </div>
                        <div class="team-players-list" id="team-1-players"></div>
                    </div>
                    
                    <!-- 🚨 ВАЖНО: ID должно быть точно team-2-box -->
                    <div class="team-box" id="team-2-box">
                        <div class="team-header">
                            <input type="text" class="team-name-input" value="Команда Б" placeholder="Название команды">
                            <span class="player-count">0</span>
                        </div>
                        <div class="team-players-list" id="team-2-players"></div>
                    </div>
                </div>
                
                <div class="teams-controls">
                    <button type="button" id="add-team-btn" class="btn-secondary">➕ Добавить команду</button>
                    <button type="button" id="remove-team-btn" class="btn-secondary" disabled>➖ Удалить команду</button>
                </div>
            </div>
        `;
        
        console.log('✅ Контейнеры команд созданы');
    }

    setupTeamsEventListeners() {
        console.log('🔧 Настраиваю обработчики команд...');
        
        // Кнопка добавления команды
        document.getElementById('add-team-btn')?.addEventListener('click', () => {
            console.log('➕ Нажата кнопка добавления команды');
            
            // 🚨 ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА
            this.validateTeamIDs();
            
            this.addTeam();
        });
        
        // Кнопка удаления команды
        document.getElementById('remove-team-btn')?.addEventListener('click', () => {
            console.log('➖ Нажата кнопка удаления команды');
            this.removeLastTeam();
        });
        
        this.initDragAndDrop();
    }

    validateTeamIDs() {
        console.log('🔍 Проверка уникальности ID команд...');
        
        const allIds = {};
        const duplicates = [];
        
        document.querySelectorAll('[id^="team-"][id$="-box"]').forEach(box => {
            if (box.id === 'unassigned-box') return;
            
            if (allIds[box.id]) {
                duplicates.push(box.id);
                console.error(`❌ ДУБЛИКАТ ID: ${box.id}`);
            } else {
                allIds[box.id] = true;
            }
        });
        
        if (duplicates.length > 0) {
            console.error(`⚠️ Найдено ${duplicates.length} дубликатов ID!`);
            this.fixDuplicateTeams();
        }
    }

    initDragAndDrop() {
        // Делаем всех игроков перетаскиваемыми
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('draggable-player')) {
                e.dataTransfer.setData('text/plain', e.target.dataset.player);
                e.target.classList.add('dragging');
            }
        });
        
        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('draggable-player')) {
                e.target.classList.remove('dragging');
            }
        });
        
        // Обработчики для зон сброса (команд)
        document.querySelectorAll('.team-players-list').forEach(dropZone => {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.parentElement.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.parentElement.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.parentElement.classList.remove('drag-over');
                
                const playerName = e.dataTransfer.getData('text/plain');
                if (playerName) {
                    this.movePlayerToTeam(playerName, dropZone.id);
                }
            });
        });
    }

    createPlayerElement(playerName) {
        const playerElement = document.createElement('div');
        playerElement.className = 'draggable-player';
        playerElement.dataset.player = playerName;
        playerElement.draggable = true;
        playerElement.innerHTML = `
            <div>
                <span class="player-handle">☰</span>
                <span class="player-name">${playerName}</span>
            </div>
        `;
        return playerElement;
    }

    populateAllPlayers() {
        const selectedPlayers = this.getSelectedPlayers();
        const unassignedList = document.getElementById('unassigned-players');
        
        if (!unassignedList) return;
        
        // Очищаем список
        unassignedList.innerHTML = '';
        
        // Добавляем всех выбранных игроков в "Не распределены"
        selectedPlayers.forEach(player => {
            const playerElement = this.createPlayerElement(player);
            unassignedList.appendChild(playerElement);
        });
        
        // Обновляем счетчики
        this.updateTeamCounters();
    }

    movePlayerToTeam(playerName, targetListId) {
        console.log(`🔄 Перемещаю игрока ${playerName} в ${targetListId}`);
        
        // Удаляем игрока из всех списков
        document.querySelectorAll(`.draggable-player[data-player="${playerName}"]`).forEach(el => {
            el.remove();
        });
        
        // Добавляем в целевой список
        const targetList = document.getElementById(targetListId);
        if (targetList) {
            const playerElement = this.createPlayerElement(playerName);
            targetList.appendChild(playerElement);
        }
        // Обновляем счетчики
        this.updateTeamCounters();
        
        // 🚨 ВАЖНО: Обновляем таблицу только когда игроки распределены по командам!
        this.updateTableForTeams();
    }

    updateTeamCounters() {
        // Обновляем счетчики игроков
        document.querySelectorAll('.team-box').forEach(teamBox => {
            const playersList = teamBox.querySelector('.team-players-list');
            const counter = teamBox.querySelector('.player-count');
            if (playersList && counter) {
                const playerCount = playersList.querySelectorAll('.draggable-player').length;
                counter.textContent = playerCount;
            }
        });
    }

    getTeams() {
        const teams = [];
        
        // Собираем все команды (кроме unassigned)
        document.querySelectorAll('.team-box:not(.unassigned-box)').forEach((teamBox, index) => {
            // 🚨 Используем ID из HTML, а не index+1
            const boxId = teamBox.id;
            const teamNumber = boxId.replace('team-', '').replace('-box', '');
            const teamId = `team-${teamNumber}`;
            
            const nameInput = teamBox.querySelector('.team-name-input');
            const teamName = nameInput ? nameInput.value : `Команда ${teamNumber}`;
            
            const players = Array.from(teamBox.querySelectorAll('.draggable-player'))
                .map(playerEl => playerEl.dataset.player);
            
            if (players.length > 0) {
                teams.push({ 
                    id: teamId, 
                    name: teamName, 
                    players: players 
                });
            }
        });
        
        return teams;
    }

    addTeam() {
        console.log('➕ ДОБАВЛЕНИЕ КОМАНДЫ (новая логика)...');
        
        // 1. НАХОДИМ ВСЕ СУЩЕСТВУЮЩИЕ ID НА ВСЕЙ СТРАНИЦЕ
        const allIds = new Set();
        const allElements = document.querySelectorAll('[id]');
        
        allElements.forEach(el => {
            if (el.id.startsWith('team-') && el.id.endsWith('-box') && el.id !== 'unassigned-box') {
                allIds.add(el.id);
            }
        });
        
        console.log('🔍 Существующие ID команд:', Array.from(allIds));
        
        // 2. НАХОДИМ СВОБОДНЫЙ НОМЕР (даже если есть пропуски)
        let newTeamNumber = 1;
        while (allIds.has(`team-${newTeamNumber}-box`)) {
            newTeamNumber++;
        }
        
        console.log('🔢 Следующий свободный номер:', newTeamNumber);
        
        // 3. СОЗДАЕМ КОМАНДУ С ГАРАНТИРОВАННО УНИКАЛЬНЫМ ID
        const teamLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
        const letter = newTeamNumber <= teamLetters.length ? teamLetters[newTeamNumber - 1] : newTeamNumber;
        
        const boxId = `team-${newTeamNumber}-box`;
        const playersListId = `team-${newTeamNumber}-players`;
        
        // 🚨 ВАЖНО: Проверяем что такого ID еще нет (на всякий случай)
        if (document.getElementById(boxId)) {
            console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: ID ${boxId} уже существует!`);
            this.fixDuplicateTeams(); // Исправляем дубликаты
            return this.addTeam(); // Пробуем снова
        }
        
        const newTeamHTML = `
            <div class="team-box" id="${boxId}">
                <div class="team-header">
                    <input type="text" class="team-name-input" value="Команда ${letter}" placeholder="Название команды">
                    <span class="player-count">0</span>
                </div>
                <div class="team-players-list" id="${playersListId}"></div>
            </div>
        `;
        
        // 4. ДОБАВЛЯЕМ КОМАНДУ
        const teamsControls = document.querySelector('.teams-controls');
        if (teamsControls) {
            teamsControls.insertAdjacentHTML('beforebegin', newTeamHTML);
        }
        
        // 5. ИНИЦИАЛИЗИРУЕМ И ПРОВЕРЯЕМ
        setTimeout(() => {
            this.initDragAndDrop();
            
            // Проверяем что команда создана и ID уникален
            const createdTeam = document.getElementById(boxId);
            if (!createdTeam) {
                console.error('❌ Команда не создана!');
            } else {
                console.log(`✅ Команда создана: ${boxId}`);
            }
            
            // 🚨 ЕСЛИ В НОВОЙ КОМАНДЕ УЖЕ ЕСТЬ ИГРОКИ (из дубликатов), ОБНОВЛЯЕМ ТАБЛИЦУ
            const playersInNewTeam = document.querySelectorAll(`#${playersListId} .draggable-player`);
            if (playersInNewTeam.length > 0) {
                console.log(`🔄 В новой команде уже есть ${playersInNewTeam.length} игроков, обновляю таблицу`);
                this.updateTableForTeams();
            }
            
            // Обновляем кнопку удаления
            const allTeamsCount = document.querySelectorAll('[id^="team-"][id$="-box"]:not(#unassigned-box)').length;
            console.log('📊 Всего команд теперь:', allTeamsCount);
            
            const removeBtn = document.getElementById('remove-team-btn');
            if (removeBtn) {
                removeBtn.disabled = allTeamsCount <= 2;
            }
        }, 100);
        
        return boxId;
    }

    removeLastTeam() {
        console.log('➖ УДАЛЕНИЕ КОМАНДЫ (простая логика)...');
        
        // 1. НАХОДИМ ВСЕ КОМАНДЫ ПО КЛАССУ (а не по ID!)
        const allTeams = Array.from(document.querySelectorAll('.team-box'))
            .filter(box => box.id !== 'unassigned-box' && box.id.startsWith('team-'));
        
        console.log('📊 Найдено команд (по классу):', allTeams.length);
        console.log('ID команд:', allTeams.map(t => t.id));
        
        if (allTeams.length <= 2) {
            alert('❌ Должно остаться минимум 2 команды');
            return;
        }
        
        // 2. НАХОДИМ КОМАНДУ С МАКСИМАЛЬНЫМ НОМЕРОМ
        let maxNumber = 0;
        let teamToRemove = null;
        
        allTeams.forEach(team => {
            const match = team.id.match(/team-(\d+)-box/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNumber) {
                    maxNumber = num;
                    teamToRemove = team;
                }
            }
        });
        
        if (!teamToRemove) {
            console.error('❌ Не найдена команда для удаления');
            return;
        }
        
        console.log(`🎯 Удаляю команду: ${teamToRemove.id} (номер ${maxNumber})`);
        
        // 3. УДАЛЯЕМ КОМАНДУ И ЕЕ PLAYERS-LIST
        teamToRemove.remove();
        
        const playersListId = teamToRemove.id.replace('-box', '-players');
        const playersList = document.getElementById(playersListId);
        if (playersList) {
            playersList.remove();
        }
        
        // 4. ОБНОВЛЯЕМ ТАБЛИЦУ И КНОПКУ
        setTimeout(() => {
            // 🚨 ВАЖНО: ОБНОВЛЯЕМ ТАБЛИЦУ ПОСЛЕ УДАЛЕНИЯ КОМАНДЫ
            this.updateTableForTeams();
            
            const remainingTeams = document.querySelectorAll('.team-box:not(#unassigned-box)').length;
            console.log('📊 Осталось команд:', remainingTeams);
            
            const removeBtn = document.getElementById('remove-team-btn');
            if (removeBtn) {
                removeBtn.disabled = remainingTeams <= 2;
            }
        }, 50);
    }

    // =============================================
    // 🎯 БЛОК 4: ТАБЛИЦЫ ДЛЯ КОМАНДНЫХ ИГР
    // =============================================

    setupTeamScoringTable(teams) {
        console.log('👥🎯 Настраиваю таблицу для командной игры на очки. Команды:', teams);
        
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        // Полностью очищаем таблицу
        table.innerHTML = '';
        
        // ШАПКА
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th class="round-header">Раунд</th>';
        
        teams.forEach(team => {
            const th = document.createElement('th');
            th.className = 'team-header';
            th.dataset.teamId = team.id;
            th.textContent = team.name;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // ТЕЛО ТАБЛИЦЫ (раунды)
        const tbody = document.createElement('tbody');
        
        for (let round = 1; round <= this.currentRounds; round++) {
            const row = document.createElement('tr');
            row.className = 'round-row';
            row.dataset.round = round;
            
            const roundLabel = document.createElement('td');
            roundLabel.className = 'round-label';
            roundLabel.textContent = `Раунд ${round}`;
            row.appendChild(roundLabel);
            
            teams.forEach(team => {
                const scoreCell = document.createElement('td');
                scoreCell.className = 'team-score-cell';
                
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'team-score-input';
                input.dataset.teamId = team.id;
                input.dataset.round = round;
                input.value = '0';
                
                scoreCell.appendChild(input);
                row.appendChild(scoreCell);
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        
        // ПОДВАЛ (ТОЛЬКО ИТОГО)
        const tfoot = document.createElement('tfoot');
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = '<td class="total-label"><strong>ИТОГО</strong></td>';
        
        teams.forEach(team => {
            const totalCell = document.createElement('td');
            totalCell.className = 'total-cell team-total-cell';
            totalCell.dataset.teamId = team.id;
            totalCell.textContent = '0';
            totalRow.appendChild(totalCell);
        });
        
        tfoot.appendChild(totalRow);
        table.appendChild(tfoot);
        
        // Настраиваем обработчики для команд
        this.setupTeamTableHandlers();
    }

    setupTeamNonScoringTable(teams) {
        console.log('👥👑 Настраиваю таблицу для командной игры без очков. Команды:', teams);
        
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        // Полностью очищаем таблицу
        table.innerHTML = '';
        
        // ШАПКА
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th class="round-header"></th>';
        
        teams.forEach(team => {
            const th = document.createElement('th');
            th.className = 'team-header';
            th.dataset.teamId = team.id;
            th.textContent = team.name;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // ТОЛЬКО СТРОКА ВЫБОРА ПОБЕДИТЕЛЯ
        const tbody = document.createElement('tbody');
        const winnerRow = document.createElement('tr');
        winnerRow.className = 'winner-selection-row';
        
        const labelCell = document.createElement('td');
        labelCell.textContent = 'Победившая команда:';
        labelCell.className = 'winner-label';
        winnerRow.appendChild(labelCell);
        
        teams.forEach(team => {
            const crownCell = document.createElement('td');
            crownCell.className = 'crown-cell';
            crownCell.innerHTML = `<button type="button" class="crown-btn team-crown-btn" data-team-id="${team.id}">👑</button>`;
            
            crownCell.querySelector('.crown-btn').addEventListener('click', (e) => {
                this.selectTeamWinner(team.id, e.target);
            });
            
            winnerRow.appendChild(crownCell);
        });
        
        tbody.appendChild(winnerRow);
        table.appendChild(tbody);
        
        // Скрываем управление раундами
        const roundControls = document.querySelector('.round-controls');
        if (roundControls) {
            roundControls.style.display = 'none';
        }
    }

    setupTeamTableHandlers() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        // Обработчик ввода очков для команд
        table.addEventListener('input', (e) => {
            if (e.target.classList.contains('team-score-input')) {
                this.updateTeamTotal(e.target.dataset.teamId);
            }
        });
        
        // Кнопки управления раундами для команд
        const addRoundBtn = document.getElementById('add-round-btn');
        const removeRoundBtn = document.getElementById('remove-round-btn');
        
        if (addRoundBtn) {
            addRoundBtn.onclick = () => this.addTeamRound();
        }
        
        if (removeRoundBtn) {
            removeRoundBtn.onclick = () => this.removeTeamRound();
        }
    }

    updateTeamTotal(teamId) {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        const totalCell = table.querySelector(`.team-total-cell[data-team-id="${teamId}"]`);
        if (!totalCell) return;
        
        let total = 0;
        const inputs = table.querySelectorAll(`.team-score-input[data-team-id="${teamId}"]`);
        
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });
        
        totalCell.textContent = total;
    }

    addTeamRound() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const teams = this.getTeams();
        
        if (!tbody || teams.length === 0) return;
        
        const currentRounds = tbody.querySelectorAll('.round-row').length;
        const newRoundNumber = currentRounds + 1;
        
        const roundRow = document.createElement('tr');
        roundRow.className = 'round-row';
        
        const roundCell = document.createElement('td');
        roundCell.textContent = `Раунд ${newRoundNumber}`;
        roundCell.className = 'round-label';
        roundRow.appendChild(roundCell);
        
        teams.forEach(team => {
            const scoreCell = document.createElement('td');
            scoreCell.className = 'team-score-cell';
            scoreCell.innerHTML = `
                <input type="number" class="team-score-input" 
                    data-team-id="${team.id}" 
                    data-round="${newRoundNumber}" 
                    min="0" 
                    value="0">
            `;
            roundRow.appendChild(scoreCell);
        });
        
        tbody.appendChild(roundRow);
    }

    removeTeamRound() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const rounds = tbody?.querySelectorAll('.round-row');
        
        if (!rounds || rounds.length <= 1) {
            alert('❌ Должен остаться хотя бы один раунд');
            return;
        }
        
        rounds[rounds.length - 1].remove();
    }

    // 🆕 Метод для обновления таблицы при изменении команд
    updateTableForTeams() {
        const gameType = document.querySelector('input[name="game-type"]:checked')?.value || 'scoring';
        const isTeamGame = document.getElementById('team-game-toggle')?.checked || false;
        
        if (!isTeamGame) {
            console.log('⚠️ Не командный режим, пропускаю обновление таблицы команд');
            return;
        }
        
        const teams = this.getTeams();
        console.log('🔄 Обновляю таблицу для команд. Количество команд:', teams.length);
        
        if (teams.length === 0) {
            console.log('📊 Нет команд с игроками, создаю пустую таблицу');
            this.createEmptyTable();
            return;
        }
        
        if (gameType === 'scoring') {
            this.setupTeamScoringTable(teams);
        } else {
            this.setupTeamNonScoringTable(teams);
        }
    }

    
    // =============================================
    // 🎯 БЛОК 5: УПРАВЛЕНИЕ РАУНДАМИ И ОЧКАМИ
    // =============================================

    // 🆕 ОБРАБОТЧИКИ ДЛЯ КОМАНДНЫХ ИГР
    setupTeamRoundHandlers() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        // Обработчик ввода очков для команд
        table.addEventListener('input', (e) => {
            if (e.target.classList.contains('team-score-input')) {
                this.updateTeamTotal(e.target.dataset.teamId);
                this.updateTeamWinnerIndicator();
            }
        });
    }

    // 🆕 ОБНОВЛЕНИЕ ИТОГОВ ДЛЯ КОМАНД
    updateTeamTotal(teamId) {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const totalCell = table.querySelector(`.team-total-cell[data-team-id="${teamId}"]`);
        if (!totalCell) return;

        let total = 0;
        const inputs = table.querySelectorAll(`.team-score-input[data-team-id="${teamId}"]`);
        
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });

        totalCell.textContent = total;
    }

    // 🆕 ОБНОВЛЕНИЕ ИНДИКАТОРА ПОБЕДИТЕЛЯ ДЛЯ КОМАНД
    updateTeamWinnerIndicator() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const indicators = table.querySelectorAll('.team-winner-indicator');
        indicators.forEach(indicator => {
            indicator.style.opacity = '0.3';
            indicator.textContent = '⭐';
        });

        let maxScore = -1;
        let winnerTeamId = '';

        // Находим команду с максимальным количеством очков
        const totalCells = table.querySelectorAll('.team-total-cell');
        totalCells.forEach(cell => {
            const teamId = cell.dataset.teamId;
            const totalScore = parseInt(cell.textContent) || 0;
            
            if (totalScore > maxScore) {
                maxScore = totalScore;
                winnerTeamId = teamId;
            }
        });

        // Выделяем победителя
        if (winnerTeamId && maxScore > 0) {
            const winnerIndicator = table.querySelector(`.team-winner-indicator[data-team-id="${winnerTeamId}"]`);
            if (winnerIndicator) {
                winnerIndicator.style.opacity = '1';
                winnerIndicator.textContent = '🏆';
                this.selectedTeamWinner = winnerTeamId;
            }
        }
    }

    setupRoundControls() {
        const addRoundBtn = document.getElementById('add-round-btn');
        const removeRoundBtn = document.getElementById('remove-round-btn');
        
        if (addRoundBtn) {
            addRoundBtn.onclick = () => {
                console.log('➕ Нажата кнопка добавления раунда');
                this.addRound();
            };
        }
        
        if (removeRoundBtn) {
            removeRoundBtn.onclick = () => {
                console.log('➖ Нажата кнопка удаления раунда');
                this.removeRound();
            };
        }
    }

    addRound() {
        const isTeamGame = document.getElementById('team-game-toggle')?.checked;
        
        if (isTeamGame) {
            // ДЛЯ КОМАНД
            const tableBody = document.querySelector('#horizontal-scores-table tbody');
            const teams = this.getTeams();
            
            if (!tableBody || teams.length === 0) return;
            
            const currentRounds = tableBody.querySelectorAll('.round-row').length;
            const newRoundNumber = currentRounds + 1;
            
            const roundRow = document.createElement('tr');
            roundRow.className = 'round-row';
            
            const roundCell = document.createElement('td');
            roundCell.textContent = `Раунд ${newRoundNumber}`;
            roundCell.className = 'round-label';
            roundRow.appendChild(roundCell);
            
            teams.forEach(team => {
                const scoreCell = document.createElement('td');
                scoreCell.className = 'team-score-cell';
                scoreCell.innerHTML = `
                    <input type="number" class="team-score-input" 
                        data-team-id="${team.id}" 
                        data-round="${newRoundNumber}" 
                        min="0" 
                        value="0">
                `;
                roundRow.appendChild(scoreCell);
            });
            
            tableBody.appendChild(roundRow);  // ✅ ТОЛЬКО ОДИН РАЗ!
            
        } else {
            // ДЛЯ ИНДИВИДУАЛЬНЫХ ИГР
            this.currentRounds++;
            const newRoundNumber = this.currentRounds;
            
            const table = document.getElementById('horizontal-scores-table');
            if (!table) return;

            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const selectedPlayers = this.getSelectedPlayers();

            const newRow = document.createElement('tr');
            newRow.className = 'round-row';
            newRow.dataset.round = newRoundNumber;
            
            const roundLabel = document.createElement('td');
            roundLabel.className = 'round-label';
            roundLabel.textContent = `Раунд ${newRoundNumber}`;
            newRow.appendChild(roundLabel);
            
            selectedPlayers.forEach(player => {
                const scoreCell = document.createElement('td');
                scoreCell.className = 'score-cell';
                
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'score-input';
                input.dataset.player = player;
                input.dataset.round = newRoundNumber;
                input.value = '0';
                
                scoreCell.appendChild(input);
                newRow.appendChild(scoreCell);
            });
            
            tbody.appendChild(newRow);
        }
    }

    removeRound() {
        const isTeamGame = document.getElementById('team-game-toggle')?.checked;
        
        if (isTeamGame) {
            // ДЛЯ КОМАНД
            const tableBody = document.querySelector('#horizontal-scores-table tbody');
            const rounds = tableBody.querySelectorAll('.round-row');
            
            if (rounds.length > 1) {
                rounds[rounds.length - 1].remove();
            } else {
                alert('Нельзя удалить последний раунд!');
            }
            
        } else {
            // ДЛЯ ИНДИВИДУАЛЬНЫХ ИГР
            if (this.currentRounds <= 1) {
                alert('❌ Должен остаться хотя бы один раунд');
                return;
            }
            
            const table = document.getElementById('horizontal-scores-table');
            if (!table) return;

            const lastRoundRow = table.querySelector(`.round-row[data-round="${this.currentRounds}"]`);
            if (lastRoundRow) {
                lastRoundRow.remove();
                this.currentRounds--;
                this.updateAllTotals();
                this.updateWinnerIndicator();
            }
        }
    }

    // =============================================
    // 🎯 БЛОК 6: ВЫБОР ПОБЕДИТЕЛЕЙ
    // =============================================

    selectWinner(playerName, crownElement) {
        console.log('👑 Выбран победитель:', playerName);
        
        // Снимаем выделение со всех корон
        document.querySelectorAll('.crown-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.opacity = '0.5';
        });
        
        // Выделяем выбранную корону
        crownElement.classList.add('selected');
        crownElement.style.opacity = '1';
        
        // 🔥 ВАЖНО: Сохраняем победителя в свойство класса
        this.selectedWinner = playerName;
        
        // 🔥 ЕСЛИ ЕСТЬ РАДИОКНОПКИ: отмечаем соответствующую
        const radioBtn = document.querySelector(`input[name="winner"][value="${playerName}"]`);
        if (radioBtn) {
            radioBtn.checked = true;
            console.log('✅ Радиокнопка отмечена для:', playerName);
        }
        
        console.log('✅ Победитель сохранен:', this.selectedWinner);
    }

    selectTeamWinner(teamId, crownElement) {
        const teams = this.getTeams();
        const winningTeam = teams.find(team => team.id === teamId);
        
        if (winningTeam) {
            console.log('👑 Выбрана команда-победитель:', winningTeam.name);
            
            document.querySelectorAll('.team-crown-btn').forEach(btn => {
                btn.classList.remove('selected');
                btn.style.opacity = '0.5';
            });
            
            crownElement.classList.add('selected');
            crownElement.style.opacity = '1';
            this.selectedTeamWinner = teamId;
        }
    }

    getSelectedPlayers() {
        const playerCheckboxes = document.querySelectorAll('#players-selection input[type="checkbox"]:checked');
        return Array.from(playerCheckboxes).map(cb => cb.value);
    }

    // =============================================
    // 🎯 БЛОК 7: ОБРАБОТКА ФОРМЫ И ДАННЫХ
    // =============================================

    async handleFormSubmit(event) {
        event.preventDefault();
        console.log('📝 Обрабатываю отправку формы сессии');
        
        const gameType = document.querySelector('input[name="game-type"]:checked')?.value || 'scoring';
        const isTeamGame = document.getElementById('team-game-toggle')?.checked || false;

        let formData = gameType === 'scoring' 
            ? this.prepareScoringSessionData(isTeamGame)
            : this.prepareNonScoringSessionData(isTeamGame);

        if (!formData || !this.validateSessionData(formData, gameType, isTeamGame)) {
            return;
        }

        try {
            const newSession = await this.sessionsManager.addSession(formData);
            
            // 🎯 УСПЕШНО ДОБАВИЛИ - ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ
            this.showNotification(`✅ Сессия добавлена! Победитель: ${formData.winner}`, 'success');
            
            // 🎯 СБРАСЫВАЕМ ПАГИНАЦИЮ
            if (this.pagination) {
                this.pagination.resetPagination();
            }
            
            // 🎯 ПЕРЕРЕНДЕРИВАЕМ СПИСОК С ПАГИНАЦИЕЙ
            this.renderSessionsList('sessions-list');
            
            // 🎯 ОБНОВЛЯЕМ СТАТИСТИКУ
            this.updateStats();
            
            // 🎯 ОЧИЩАЕМ ФОРМУ (ТОЛЬКО ОПРЕДЕЛЁННЫЕ ПОЛЯ)
            this.resetFormAfterSubmit();
            
            // 🎯 ПОВТОРНО ВЫЗЫВАЕМ АВТОВЫБОР
            this.autoSelectAfterSubmit();
            
            console.log('✅ Сессия добавлена:', newSession);
            
        } catch (error) {
            console.error('❌ Ошибка при добавлении сессии:', error);
            this.showNotification('❌ Ошибка при добавлении сессии', 'error');
        }
    }

    // 🆕 МЕТОД ДЛЯ АВТОВЫБОРА ПОСЛЕ ОТПРАВКИ
    autoSelectAfterSubmit() {
        console.log('🎯 Автовыбор игроков после добавления сессии');
        
        const players = ['Егор', 'Мама', 'Папа'];
        
        // Даем немного времени на обновление DOM
        setTimeout(() => {
            const checkboxes = document.querySelectorAll('input[name="session-players"]');
            
            if (checkboxes.length === 0) {
                console.log('❌ Чекбоксы не найдены, пробую снова...');
                setTimeout(() => this.autoSelectAfterSubmit(), 100);
                return;
            }
            
            console.log(`✅ Найдено ${checkboxes.length} чекбоксов, выбираю...`);
            
            // Очищаем все выборы
            checkboxes.forEach(cb => cb.checked = false);
            
            // Выбираем наших игроков
            players.forEach(playerName => {
                const checkbox = Array.from(checkboxes).find(cb => cb.value === playerName);
                if (checkbox) {
                    checkbox.checked = true;
                    console.log(`✅ Выбран: ${playerName}`);
                }
            });
            
            // Обновляем таблицу
            this.updateTableVisibility();
            this.updateTeamsPlayersList();
            
            // 🎯 АВТОМАТИЧЕСКАЯ ДАТА ТОЖЕ ДОЛЖНА ОБНОВЛЯТЬСЯ
            this.setAutoDate();
            
        }, 100);
    }

    // 🆕 МЕТОД ДЛЯ ОЧИСТКИ ФОРМЫ ПОСЛЕ УСПЕШНОЙ ОТПРАВКИ
    resetFormAfterSubmit() {
        console.log('🔄 Очищаю форму после добавления...');
        
        // Очищаем только определенные поля:
        const fieldsToClear = [
            'session-game-search',    // поле поиска игры
            'session-game',           // скрытое поле игры
            'session-description'     // комментарий
        ];
        
        fieldsToClear.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.value = '';
            }
        });
        
        // Очищаем дополнения
        const expansionsContainer = document.getElementById('expansions-container');
        if (expansionsContainer) {
            expansionsContainer.innerHTML = '';
        }
        
        // Сбрасываем очки в таблице (если она есть)
        const scoreInputs = document.querySelectorAll('.score-input, .team-score-input');
        scoreInputs.forEach(input => {
            if (input) input.value = '0';
        });
        
        // Обновляем итоги
        this.updateAllTotals();
        
        // Восстанавливаем тип игры по умолчанию
        const scoringRadio = document.querySelector('input[name="game-type"][value="scoring"]');
        if (scoringRadio) scoringRadio.checked = true;
        
        // Сбрасываем команды
        const teamToggle = document.getElementById('team-game-toggle');
        if (teamToggle) teamToggle.checked = false;
        
        // Обновляем видимость
        this.updateFormVisibility();
    }

    // 🆕 МЕТОД ДЕБАУНСА
    debouncedRender() {
        // Отменяем предыдущий таймер
        if (this.renderDebounceTimer) {
            clearTimeout(this.renderDebounceTimer);
        }
        if (this.statsDebounceTimer) {
            clearTimeout(this.statsDebounceTimer);
        }
        
        // Ставим новые таймеры
        this.renderDebounceTimer = setTimeout(() => {
            this.renderSessionsList('sessions-list');
        }, 300); // Рендерим через 300мс после последнего изменения
        
        this.statsDebounceTimer = setTimeout(() => {
            this.updateStats();
        }, 500); // Статистику через 500мс
    }

    prepareScoringSessionData(isTeamGame) {
        const selectedPlayers = this.getSelectedPlayers();
        if (selectedPlayers.length === 0) {
            alert('❌ Выберите хотя бы одного игрока');
            return null;
        }

        let scores = {};
        let totalScores = {};
        let winner = '';

        if (isTeamGame) {
            scores = this.collectTeamScores();
            totalScores = this.calculateTeamTotals(scores);
            winner = this.determineScoringWinner(totalScores);
        } else {
            scores = this.collectPlayerScores(selectedPlayers);
            totalScores = this.calculatePlayerTotals(scores);
            winner = this.determineScoringWinner(totalScores);
        }

        return {
            game: document.getElementById('session-game').value,
            date: document.getElementById('session-date').value,
            players: selectedPlayers,
            gameType: 'scoring',
            isTeamGame: isTeamGame,
            teams: isTeamGame ? this.getTeams() : null,
            scores: scores,
            totalScores: totalScores,
            winner: winner,
            duration: parseInt(document.getElementById('session-duration').value) || 0,
            description: document.getElementById('session-description').value || '',
            expansions: this.getSelectedExpansions() // 🆕 ДОБАВЛЕНО
        };
    }

    prepareNonScoringSessionData(isTeamGame) {
        console.log('📝 Подготавливаю данные non-scoring сессии...');
        
        const selectedPlayers = this.getSelectedPlayers();
        if (selectedPlayers.length === 0) {
            alert('❌ Выберите хотя бы одного игрока');
            return null;
        }

        // 🔥 СПОСОБ 1: Проверяем this.selectedWinner (самый простой)
        let winner = isTeamGame ? this.selectedTeamWinner : this.selectedWinner;
        console.log('👑 Проверяем this.selectedWinner:', this.selectedWinner);
        console.log('👑 Проверяем this.selectedTeamWinner:', this.selectedTeamWinner);
        console.log('👑 Итоговый winner:', winner);

        // 🔥 СПОСОБ 2: Проверяем выбранную корону
        if (!winner) {
            const selectedCrown = document.querySelector('.crown-btn.selected');
            if (selectedCrown) {
                winner = selectedCrown.dataset.player;
                console.log('👑 Нашли выбранную корону:', winner);
            }
        }

        // 🔥 СПОСОБ 3: Проверяем радиокнопки (если вы их добавили)
        if (!winner) {
            const selectedRadio = document.querySelector('input[name="winner"]:checked');
            if (selectedRadio) {
                winner = selectedRadio.value;
                console.log('👑 Нашли выбранную радиокнопку:', winner);
            }
        }

        console.log('✅ Финальный winner для отправки:', winner);

        if (!winner) {
            alert('❌ Выберите победителя (кликните по короне рядом с игроком)');
            return null;
        }

        return {
            game: document.getElementById('session-game').value,
            date: document.getElementById('session-date').value,
            players: selectedPlayers,
            gameType: 'non_scoring',
            isTeamGame: isTeamGame,
            teams: isTeamGame ? this.getTeams() : null,
            winner: winner,
            duration: parseInt(document.getElementById('session-duration').value) || 0,
            description: document.getElementById('session-description').value || '',
            expansions: this.getSelectedExpansions()
        };
    }

    validateSessionData(formData, gameType, isTeamGame) {
        if (!formData.game) {
            alert('❌ Выберите игру');
            return false;
        }

        if (!formData.date) {
            alert('❌ Укажите дату');
            return false;
        }

        if (gameType === 'scoring' && isTeamGame) {
            const teams = formData.teams;
            if (!teams || teams.length < 2) {
                alert('❌ Для командной игры нужно минимум 2 команды');
                return false;
            }
        }

        return true;
    }

    // =============================================
    // 🎯 БЛОК 8: ЗАПОЛНЕНИЕ ФОРМЫ (игры и игроки)
    // =============================================

    populateGameSelect() {
        const select = document.getElementById('session-game');
        if (!select) {
            console.log('❌ Select игр не найден');
            return;
        }

        select.innerHTML = '<option value="">Выберите игру</option>';
        console.log('🎮 Быстрая инициализация select...');
        
        setTimeout(() => {
            this.loadGamesToSelect(select);
        }, 100);
    }

    async loadGamesToSelect(select) {
        try {
            let games = [];
            
            if (this.gamesCatalog?.games?.length > 0) {
                games = this.gamesCatalog.games;
                console.log('🎮 Загружаю игры из gamesCatalog:', games.length);
            } else {
                console.log('🔄 Загружаю популярные игры...');
                const response = await fetch('./assets/data/tesera-collection.json');
                const allGames = await response.json();
                games = allGames.slice(0, 20);
            }
            
            games.forEach(game => {
                const gameName = game.name || game.title;
                if (gameName) {
                    const option = document.createElement('option');
                    option.value = gameName;
                    option.textContent = gameName;
                    select.appendChild(option);
                }
            });
            
            console.log('✅ Игры загружены в select:', games.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки игр:', error);
        }
    }

    updatePlayersList() {
        const playersContainer = document.getElementById('session-players-container');
        if (!playersContainer) {
            console.log('❌ Контейнер игроков не найден');
            return;
        }

        const allPlayers = this.playersManager ? 
            this.playersManager.getAllPlayers().map(p => p.name) : [];

        console.log('👥 Загружаю игроков для сессии:', allPlayers);

        if (allPlayers.length === 0) {
            playersContainer.innerHTML = `
                <div class="no-players-table">
                    <p>❌ Нет добавленных игроков</p>
                    <p>Сначала добавьте игроков на главной странице</p>
                    <a href="#/" class="btn-link">Перейти к игрокам</a>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="players-selection" id="players-selection">
                <strong>👥 Выберите участников:</strong>
                <div class="players-checkboxes">
                    ${allPlayers.map(player => `
                        <label class="player-checkbox-label">
                            <input type="checkbox" name="session-players" value="${player}">
                            <span>${player}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="horizontal-scores-container" id="scores-container" style="display: none;">
                <table class="horizontal-scores-table" id="horizontal-scores-table"></table>
                <div class="round-controls">
                    <button type="button" class="btn-secondary" id="add-round-btn">➕ Добавить раунд</button>
                    <button type="button" class="btn-secondary" id="remove-round-btn">➖ Удалить раунд</button>
                </div>
            </div>
            
            <div id="no-players-message" class="no-players-message">
                <p>🎯 Выберите игроков выше чтобы начать ввод очков</p>
            </div>
        `;

        playersContainer.innerHTML = tableHTML;
        this.setupPlayersSelection();
        
        console.log('✅ Игроки загружены:', allPlayers.length);
    }

    setupPlayersSelection() {
        const container = document.getElementById('players-selection');
        if (!container) return;

        container.addEventListener('change', (e) => {
            if (e.target.name === 'session-players') {
                setTimeout(() => {
                    this.updateTableVisibility();
                    this.updateTeamsPlayersList();
                }, 10);
            }
        });
    }

    updateTableVisibility() {
        const selectedPlayers = this.getSelectedPlayers();
        const scoresContainer = document.getElementById('scores-container');
        const noPlayersMessage = document.getElementById('no-players-message');
        const gameType = document.querySelector('input[name="game-type"]:checked')?.value || 'scoring';
        const isTeamGame = document.getElementById('team-game-toggle')?.checked || false;

        if (selectedPlayers.length > 0) {
            scoresContainer.style.display = 'block';
            if (noPlayersMessage) noPlayersMessage.style.display = 'none';
            
            // 🚨 ВАЖНО: В КОМАНДНОМ РЕЖИМЕ НЕ ОБНОВЛЯЕМ ТАБЛИЦУ ПРИ ВЫБОРЕ ИГРОКОВ!
            if (isTeamGame) {
                console.log('👥 Командный режим: игроки выбраны, но таблицу не обновляем');
                // Таблица будет обновлена только при распределении по командам
            } else {
                // Только в индивидуальном режиме обновляем таблицу
                if (gameType === 'scoring') {
                    this.setupScoringTable(selectedPlayers);
                } else {
                    this.setupNonScoringTable(selectedPlayers);
                }
            }
        } else {
            scoresContainer.style.display = 'none';
            if (noPlayersMessage) noPlayersMessage.style.display = 'block';
        }
    }
    // =============================================
    // 🎯 БЛОК 9: ОТОБРАЖЕНИЕ СЕССИЙ И СТАТИСТИКИ
    // =============================================

    renderSessionsList(containerId) {
        const sessions = this.sessionsManager.sessions;
        
        // 🎯 ИСПОЛЬЗУЕМ ПАГИНАЦИЮ
        if (this.pagination) {
            this.pagination.renderPaginatedList(sessions, containerId);
        } else {
            // 🎯 Fallback на старую логику (если пагинация не загрузилась)
            this.renderSessionsListLegacy(containerId);
        }
    }

    renderSessionsListLegacy(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.log('❌ Контейнер сессий не найден:', containerId);
            return;
        }

        const sessions = this.sessionsManager.sessions;
        console.log('📊 Рендерю список сессий (legacy):', sessions.length);
        
        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    <p>🎯 Пока нет записанных сессий</p>
                    <p>Добавьте первую игру чтобы начать отслеживать статистику!</p>
                </div>
            `;
            return;
        }

        // 🎯 ПОКАЗЫВАЕМ 20 САМЫХ НОВЫХ СЕССИЙ (для совместимости)
        const NEWEST_LIMIT = 20;
        const newestSessions = [...sessions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, NEWEST_LIMIT);

        const fragment = document.createDocumentFragment();
        
        newestSessions.forEach(session => {
            const sessionElement = this.createSessionElement(session);
            fragment.appendChild(sessionElement);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        if (sessions.length > NEWEST_LIMIT) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'sessions-info';
            infoDiv.style.cssText = `
                margin-top: 15px;
                padding: 8px;
                background: #f8fafc;
                border-radius: 6px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
            `;
            infoDiv.innerHTML = `📊 Всего сессий: ${sessions.length} (показаны ${NEWEST_LIMIT} самых новых)`;
            
            container.appendChild(infoDiv);
        }
        
        this.setupDeleteHandlers();
    }


    renderAllSessions(playerName) {
        const container = document.getElementById('all-sessions-container');
        const countElement = document.getElementById('total-sessions-count');
        
        if (!container) return;

        const allSessions = this.sessionsManager.getPlayerSessions(playerName);
        
        if (countElement) {
            countElement.textContent = `${allSessions.length} ${this.getPluralForm(allSessions.length, 'сессия', 'сессии', 'сессий')}`;
        }
        
        // 🎯 ИСПОЛЬЗУЕМ ПАГИНАЦИЮ ДЛЯ ПРОФИЛЯ
        if (this.pagination) {
            this.pagination.renderPaginatedList(allSessions, 'all-sessions-container', true, playerName);
        } else {
            // Fallback на старую логику
            this.renderAllSessionsLegacy(playerName);
        }
    }

    // 🎯 Fallback для профиля
    renderAllSessionsLegacy(playerName) {
        const container = document.getElementById('all-sessions-container');
        const countElement = document.getElementById('total-sessions-count');
        
        if (!container) return;

        const allSessions = this.sessionsManager.getPlayerSessions(playerName);
        
        if (countElement) {
            countElement.textContent = `${allSessions.length} ${this.getPluralForm(allSessions.length, 'сессия', 'сессии', 'сессий')}`;
        }
        
        if (!allSessions || allSessions.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    <p>🎯 Пока нет сыгранных сессий</p>
                    <p>Этот игрок еще не участвовал в играх</p>
                </div>
            `;
            return;
        }

        const PROFILE_LIMIT = 20;
        const newestSessions = [...allSessions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, PROFILE_LIMIT);

        const fragment = document.createDocumentFragment();
        
        newestSessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `session-card ${session.winner === playerName ? 'session-win' : 'session-loss'}`;
            div.dataset.sessionId = session.id;
            div.innerHTML = this.createSessionTableItem(session, playerName);
            fragment.appendChild(div);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        console.log('✅ Отображены 20 новых сессий в профиле');
    }

    // 🆕 ОТДЕЛЬНЫЙ МЕТОД ДЛЯ СОЗДАНИЯ ЭЛЕМЕНТА СЕССИИ
    createSessionElement(session) {
        const div = document.createElement('div');
        div.className = 'session-card';
        div.dataset.sessionId = session.id;
        div.innerHTML = this.createSessionItem(session);
        return div;
    }

    createSessionItem(session) {
        const isTeamGame = session.isTeamGame === true;
        const gameTitle = isTeamGame ? `👥 ${session.game} (командная)` : session.game;
        
        // 🚨 ВАЖНО: Передаем ВСЮ сессию, а не только scores
        const scoresTableHTML = this.createSessionScoresTable(session);
        
        return `
            <div class="session-card" data-session-id="${session.id}">
                <div class="session-card-header">
                    <div class="session-card-title">
                        <span class="session-game-icon">🎮</span>
                        <h3 class="session-game-name">${gameTitle}</h3>
                    </div>
                    <div class="session-card-meta">
                        <span class="session-date">📅 ${new Date(session.date).toLocaleDateString()}</span>
                        ${session.duration ? `<span class="session-duration">⏱ ${session.duration} мин</span>` : ''}
                        <button class="delete-session-btn" data-session-id="${session.id}" title="Удалить сессию">🗑️</button>
                    </div>
                </div>

                <div class="session-scores-section">${scoresTableHTML}</div>

                ${session.description ? `
                    <div class="session-description">
                        <div class="description-label">📝 Комментарий:</div>
                        <div class="description-text">${session.description}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createSessionScoresTable(session) {
        // 🚨 ПРИНИМАЕМ ЦЕЛУЮ СЕССИЮ, а не только scores
        const isTeamGame = session.isTeamGame === true;
        
        if (isTeamGame) {
            return this.createTeamSessionTable(session);
        } else {
            return this.createIndividualSessionTable(session);
        }
    }

    createTeamSessionTable(session) {
        const { scores, teams, winner } = session;
        
        if (!scores || Object.keys(scores).length === 0) {
            return '<div class="no-scores">Нет данных об очках</div>';
        }
        
        const teamIds = Object.keys(scores);
        const maxRounds = Math.max(...teamIds.map(teamId => scores[teamId].length));
        
        let tableHTML = `
            <div class="session-scores-table-container">
                <table class="session-scores-table">
                    <thead>
                        <tr>
                            <th class="round-col">Раунд</th>
                            ${teamIds.map(teamId => {
                                const team = teams?.find(t => t.id === teamId);
                                const isWinner = winner === teamId;
                                
                                const teamName = team?.name || teamId;
                                const playersList = team?.players?.join(', ') || '';
                                const title = playersList ? `${teamName} (${playersList})` : teamName;
                                
                                return `
                                    <th class="player-col ${isWinner ? 'winner-team-header' : ''}">
                                        ${title}
                                        ${isWinner ? ' 🏆' : ''}
                                    </th>
                                `;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (let round = 0; round < maxRounds; round++) {
            tableHTML += `
                <tr>
                    <td class="round-number">${round + 1}</td>
                    ${teamIds.map(teamId => {
                        const teamScores = scores[teamId] || [];
                        const score = round < teamScores.length ? teamScores[round] : '-';
                        return `<td class="score-cell">${score}</td>`;
                    }).join('')}
                </tr>
            `;
        }
        
        tableHTML += `
                    <tr class="total-row">
                        <td class="total-label"><strong>ИТОГО</strong></td>
                        ${teamIds.map(teamId => {
                            const teamScores = scores[teamId] || [];
                            const total = teamScores.reduce((sum, score) => sum + (score || 0), 0);
                            const isWinner = winner === teamId;
                            return `<td class="total-cell ${isWinner ? 'winner-team-total' : ''}">${total}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>`;
        
        return tableHTML;
    }

    createIndividualSessionTable(session) {
        const { players, winner, gameType } = session;
        
        // Проверяем, есть ли игроки
        if (!players || players.length === 0) {
            return '<div class="no-scores">Нет данных об участниках</div>';
        }
        
        // Для игр БЕЗ очков (non_scoring) показываем простую таблицу
        if (gameType === 'non_scoring' || !session.scores || Object.keys(session.scores).length === 0) {
            // 🚨 ИГРА БЕЗ ОЧКОВ - простой список участников с выделением победителя
            let tableHTML = `
                <div class="session-scores-table-container">
                    <table class="session-scores-table">
                        <thead>
                            <tr>
                                <th class="round-col">Участники</th>
                                <th class="player-col">Результат</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            players.forEach(player => {
                const isWinner = player === winner;
                tableHTML += `
                    <tr>
                        <td class="player-name ${isWinner ? 'winner-player' : ''}">
                            ${isWinner ? '👑 ' : ''}${player}
                        </td>
                        <td class="player-result ${isWinner ? 'winner-total' : ''}">
                            ${isWinner ? '<strong>🏆 ПОБЕДИТЕЛЬ</strong>' : 'Участник'}
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
        
        // Для игр С очками (scoring) - обычная таблица с очками
        const scores = session.scores;
        const maxRounds = Math.max(...players.map(player => scores[player]?.length || 0));
        
        let tableHTML = `
            <div class="session-scores-table-container">
                <table class="session-scores-table">
                    <thead>
                        <tr>
                            <th class="round-col">Раунд</th>
                            ${players.map(player => `
                                <th class="player-col ${player === winner ? 'winner-player' : ''}">${player}</th>
                            `).join('')}
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
                        return `<td class="score-cell">${score}</td>`;
                    }).join('')}
                </tr>
            `;
        }
        
        tableHTML += `
                    <tr class="total-row">
                        <td class="total-label"><strong>ИТОГО</strong></td>
                        ${players.map(player => {
                            const playerScores = scores[player] || [];
                            const total = playerScores.reduce((sum, score) => sum + (score || 0), 0);
                            const isWinner = player === winner;
                            return `<td class="total-cell ${isWinner ? 'winner-total' : ''}">${isWinner ? '🏆 ' : ''}${total}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>`;
        
        return tableHTML;
    }

    updateStats() {
        const statsContainer = document.getElementById('sessions-stats');
        if (!statsContainer) return;

        const sessions = this.sessionsManager.sessions;
        
        // 🚀 ОПТИМИЗАЦИЯ: Быстрые вычисления без сложных преобразований
        const totalSessions = sessions.length;
        
        // Используем Set для уникальных игр
        const gamesSet = new Set();
        let totalTime = 0;
        
        // Проходим по сессиям только один раз
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            gamesSet.add(session.game);
            totalTime += session.duration || 0;
        }
        
        const totalGames = gamesSet.size;
        
        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalSessions}</div>
                    <div class="stat-label">Всего сессий</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalGames}</div>
                    <div class="stat-label">Уникальных игр</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalTime}</div>
                    <div class="stat-label">Минут игры</div>
                </div>
            </div>
        `;

        statsContainer.innerHTML = statsHTML;
    }

    // =============================================
    // 🎯 БЛОК 10: УДАЛЕНИЕ СЕССИЙ И УТИЛИТЫ
    // =============================================

    async executeSessionDeletion(sessionId) {
        console.log('🗑️ Выполняем удаление сессии ID:', sessionId);
        const deleteBtn = document.querySelector(`.delete-session-btn[data-session-id="${sessionId}"]`);
        
        try {
            const success = await this.sessionsManager.deleteSession(sessionId);
            
            if (success) {
                if (deleteBtn) {
                    deleteBtn.textContent = '⏳';
                    deleteBtn.disabled = true;
                }

                // 🎯 СБРАСЫВАЕМ ПАГИНАЦИЮ
                if (this.pagination) {
                    this.pagination.resetPagination();
                }
                
                setTimeout(() => {
                    // 🎯 ПЕРЕРЕНДЕРИВАЕМ СПИСОК С ПАГИНАЦИЕЙ
                    this.renderSessionsList('sessions-list');
                    
                    // 🎯 ОБНОВЛЯЕМ СТАТИСТИКУ
                    this.updateStats();
                    
                    // 🎯 ОБНОВЛЯЕМ ПРОФИЛИ ИГРОКОВ
                    this.updatePlayerProfiles();
                    
                    // 🎯 ОБНОВЛЯЕМ КАТАЛОГ ИГР (ЕСЛИ НУЖНО)
                    if (this.gamesCatalog?.renderGames) {
                        this.gamesCatalog.renderGames();
                    }
                    
                    console.log('✅ Сессия успешно удалена');
                    this.showNotification('✅ Сессия успешно удалена', 'success');
                }, 300);
                
            } else {
                throw new Error('Не удалось удалить сессию');
            }
        } catch (error) {
            console.error('❌ Ошибка при удалении сессии:', error);
            this.showNotification('❌ Ошибка при удалении сессии: ' + error.message, 'error');
            
            if (deleteBtn) {
                this.resetDeleteButton(deleteBtn);
            }
        }
    }

    async executeSessionDeletion(sessionId) {
        console.log('🗑️ Выполняем удаление сессии ID:', sessionId);
        const deleteBtn = document.querySelector(`.delete-session-btn[data-session-id="${sessionId}"]`);
        
        try {
            const success = await this.sessionsManager.deleteSession(sessionId);
            
            if (success) {
                if (deleteBtn) {
                    deleteBtn.textContent = '⏳';
                    deleteBtn.disabled = true;
                }

                setTimeout(() => {
                    this.renderSessionsList('sessions-list');
                    this.updateStats();
                    this.updatePlayerProfiles();
                    
                    if (this.gamesCatalog?.renderGames) {
                        this.gamesCatalog.renderGames();
                    }
                    
                    console.log('✅ Сессия успешно удалена');
                    this.showNotification('✅ Сессия успешно удалена', 'success');
                }, 300);
                
            } else {
                throw new Error('Не удалось удалить сессию');
            }
        } catch (error) {
            console.error('❌ Ошибка при удалении сессии:', error);
            this.showNotification('❌ Ошибка при удалении сессии: ' + error.message, 'error');
            
            if (deleteBtn) {
                this.resetDeleteButton(deleteBtn);
            }
        }
    }

    setupDeleteHandlers() {
        document.querySelectorAll('.delete-session-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const sessionId = button.dataset.sessionId;
                this.deleteSession(sessionId);
            });
        });
    }

    resetDeleteButton(button) {
        button.textContent = '🗑️';
        button.classList.remove('confirm-mode');
        button.disabled = false;
        button.title = 'Удалить сессию';
    }

    resetFormToDefaults() {
        const scoringRadio = document.querySelector('input[name="game-type"][value="scoring"]');
        if (scoringRadio) scoringRadio.checked = true;
        
        const teamToggle = document.getElementById('team-game-toggle');
        if (teamToggle) teamToggle.checked = false;
        
        const nonScoringFields = document.getElementById('non-scoring-fields');
        const teamFields = document.getElementById('team-fields');
        const scoringFields = document.getElementById('scoring-fields');
        
        if (nonScoringFields) nonScoringFields.style.display = 'none';
        if (teamFields) teamFields.style.display = 'none';
        if (scoringFields) scoringFields.style.display = 'block';
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    updatePlayerProfiles() {
        if (window.app && window.app.playerProfile) {
            const currentPlayerId = window.app.getPlayerIdFromURL();
            if (currentPlayerId) {
                setTimeout(() => {
                    window.app.playerProfile.refreshProfile(currentPlayerId);
                }, 100);
            }
        }
    }

    // =============================================
    // 🎯 БЛОК 11: ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (оставшиеся)
    // =============================================

    debugTeams() {
        const teamsDragArea = document.querySelector('.teams-drag-area');
        if (!teamsDragArea) {
            console.log('❌ teamsDragArea не найден');
            return;
        }
        
        console.log('=== ДЕБАГ КОМАНД ===');
        console.log('teamsDragArea содержимое:', teamsDragArea.innerHTML);
        
        const allBoxes = teamsDragArea.querySelectorAll('.team-box');
        console.log('Все .team-box элементы:', allBoxes.length);
        
        allBoxes.forEach((box, i) => {
            console.log(`Box ${i}: id="${box.id}", class="${box.className}"`);
        });
        
        const nonUnassigned = teamsDragArea.querySelectorAll('.team-box:not(.unassigned-box)');
        console.log('Команды (без unassigned):', nonUnassigned.length);
    }

    setupTableHandlers() {
        const addBtn = document.getElementById('add-round-btn');
        const removeBtn = document.getElementById('remove-round-btn');
        
        if (addBtn) {
            addBtn.replaceWith(addBtn.cloneNode(true));
        }
        if (removeBtn) {
            removeBtn.replaceWith(removeBtn.cloneNode(true));
        }

        document.getElementById('add-round-btn')?.addEventListener('click', () => {
            console.log('➕ Нажата кнопка добавления раунда');
            this.addRound();
        });
        
        document.getElementById('remove-round-btn')?.addEventListener('click', () => {
            console.log('➖ Нажата кнопка удаления раунда');
            this.removeRound();
        });

        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        table.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.updatePlayerTotal(e.target.dataset.player);
                this.updateWinnerIndicator();
            }
        });
    }

    updatePlayerTotal(playerName) {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const totalCell = table.querySelector(`.total-cell[data-player="${playerName}"]`);
        if (!totalCell) return;

        let total = 0;
        const inputs = table.querySelectorAll(`.score-input[data-player="${playerName}"]`);
        inputs.forEach(input => {
            if (!input.disabled && input.value) {
                total += parseInt(input.value) || 0;
            }
        });

        totalCell.textContent = total;
    }

    updateAllTotals() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const playerHeaders = table.querySelectorAll('th[data-player]');
        playerHeaders.forEach(header => {
            const playerName = header.dataset.player;
            const checkbox = document.querySelector(`input[name="session-players"][value="${playerName}"]`);
            if (checkbox && checkbox.checked) {
                this.updatePlayerTotal(playerName);
            }
        });
    }

    updateWinnerIndicator() {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const indicators = table.querySelectorAll('.winner-indicator');
        indicators.forEach(indicator => {
            indicator.className = 'winner-indicator';
        });

        let maxScore = -1;
        let winner = '';

        const playerHeaders = table.querySelectorAll('th[data-player]');
        playerHeaders.forEach(header => {
            const playerName = header.dataset.player;
            const checkbox = document.querySelector(`input[name="session-players"][value="${playerName}"]`);
            
            if (checkbox && checkbox.checked) {
                const totalCell = table.querySelector(`.total-cell[data-player="${playerName}"]`);
                const totalScore = parseInt(totalCell?.textContent) || 0;
                
                if (totalScore > maxScore) {
                    maxScore = totalScore;
                    winner = playerName;
                }
            }
        });

        if (winner && maxScore > 0) {
            const winnerIndicator = table.querySelector(`.winner-indicator[data-player="${winner}"]`);
            if (winnerIndicator) {
                winnerIndicator.className = 'winner-indicator winner';
            }
        }
    }

    // =============================================
    // 🎯 БЛОК 12: МЕТОДЫ ДЛЯ РАБОТЫ С ТАБЛИЦЕЙ ОЧКОВ
    // =============================================

    setupHorizontalScoresTable() {
        const container = document.querySelector('.horizontal-scores-container');
        if (!container) return;

        container.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.updatePlayerTotal(e.target.dataset.player);
                this.updateWinnerIndicator();
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.name === 'session-players') {
                this.updateTableForSelectedPlayers();
            }
        });
    }

    updateTableForSelectedPlayers() {
        const selectedPlayers = Array.from(document.querySelectorAll('input[name="session-players"]:checked'))
            .map(checkbox => checkbox.value);

        console.log('🔄 Обновляю таблицу для игроков:', selectedPlayers);

        if (selectedPlayers.length === 0) {
            alert('❌ Должен быть выбран хотя бы один игрок');
            const lastUnchecked = document.querySelector('input[name="session-players"]:not(:checked)');
            if (lastUnchecked) lastUnchecked.checked = true;
            return;
        }

        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        this.rebuildTableWithPlayers(selectedPlayers);
    }

    rebuildTableWithPlayers(selectedPlayers) {
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return;

        const currentData = this.getCurrentTableData();
        
        // 🆕 ПЕРЕСТРАИВАЕМ ЗАГОЛОВКИ
        const headerRow = table.querySelector('thead tr');
        headerRow.innerHTML = '<th class="round-header">Раунд</th>';
        
        selectedPlayers.forEach(player => {
            const th = document.createElement('th');
            th.className = 'player-header';
            th.dataset.player = player;
            th.textContent = player;
            headerRow.appendChild(th);
        });

        // 🆕 ПЕРЕСТРАИВАЕМ ТЕЛО ТАБЛИЦЫ
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        for (let round = 1; round <= this.currentRounds; round++) {
            const row = document.createElement('tr');
            row.className = 'round-row';
            row.dataset.round = round;

            const roundLabel = document.createElement('td');
            roundLabel.className = 'round-label';
            roundLabel.textContent = `Раунд ${round}`;
            row.appendChild(roundLabel);

            selectedPlayers.forEach(player => {
                const scoreCell = document.createElement('td');
                scoreCell.className = 'score-cell';

                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'score-input';
                input.dataset.player = player;
                input.dataset.round = round;
                input.value = currentData[player]?.[round] || '0';


                scoreCell.appendChild(input);
                row.appendChild(scoreCell);
            });

            tbody.appendChild(row);
        }

        // 🆕 ПЕРЕСТРАИВАЕМ ИТОГИ И ПОБЕДИТЕЛЯ
        const tfoot = table.querySelector('tfoot');
        tfoot.innerHTML = '';

        // СТРОКА ИТОГОВ
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        
        const totalLabel = document.createElement('td');
        totalLabel.className = 'total-label';
        totalLabel.innerHTML = '<strong>ИТОГО</strong>';
        totalRow.appendChild(totalLabel);

        selectedPlayers.forEach(player => {
            const totalCell = document.createElement('td');
            totalCell.className = 'total-cell';
            totalCell.dataset.player = player;
            totalCell.textContent = '0';
            totalRow.appendChild(totalCell);
        });
        tfoot.appendChild(totalRow);

        // СТРОКА ПОБЕДИТЕЛЯ
        const winnerRow = document.createElement('tr');
        winnerRow.className = 'winner-row';
        
        const winnerLabel = document.createElement('td');
        winnerLabel.className = 'winner-label';
        winnerLabel.innerHTML = '<strong>🏆</strong>';
        winnerRow.appendChild(winnerLabel);

        selectedPlayers.forEach(player => {
            const winnerCell = document.createElement('td');
            winnerCell.className = 'winner-cell';
            winnerCell.dataset.player = player;
            
            const indicator = document.createElement('span');
            indicator.className = 'winner-indicator';
            indicator.dataset.player = player;
            indicator.textContent = '👑';
            
            winnerCell.appendChild(indicator);
            winnerRow.appendChild(winnerCell);
        });
        tfoot.appendChild(winnerRow);

        setTimeout(() => {
            this.updateAllTotals();
            this.updateWinnerIndicator();
        }, 100);
    }

    getCurrentTableData() {
        const data = {};
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return data;

        const inputs = table.querySelectorAll('.score-input');
        inputs.forEach(input => {
            const player = input.dataset.player;
            const round = parseInt(input.dataset.round);
            const value = input.value;

            if (!data[player]) data[player] = {};
            data[player][round] = value;
        });

        return data;
    }

    // =============================================
    // 🎯 БЛОК 13: МЕТОДЫ ДЛЯ СБОРА ДАННЫХ СЕССИЙ
    // =============================================

    collectTeams() {
        const teams = {};
        const teamElements = document.querySelectorAll('.team-setup');
        
        teamElements.forEach((teamElement, index) => {
            const teamName = `Команда ${index + 1}`;
            const memberSelects = teamElement.querySelectorAll('.team-member-select');
            const members = Array.from(memberSelects)
                .map(select => select.value)
                .filter(player => player);
            
            if (members.length > 0) {
                teams[teamName] = members;
            }
        });
        
        return teams;
    }

    collectTeamScores() {
        const scores = {};
        const teamInputs = document.querySelectorAll('.team-score-input');
        
        teamInputs.forEach(input => {
            const teamId = input.dataset.teamId;
            const round = parseInt(input.dataset.round);
            const score = parseInt(input.value) || 0;
            
            if (!scores[teamId]) {
                scores[teamId] = [];
            }
            scores[teamId][round - 1] = score;
        });
        
        return scores;
    }

    collectPlayerScores(selectedPlayers) {
        const scores = {};
        const table = document.getElementById('horizontal-scores-table');
        if (!table) return scores;

        selectedPlayers.forEach(player => {
            scores[player] = [];
            const inputs = table.querySelectorAll(`.score-input[data-player="${player}"]`);
            
            inputs.forEach(input => {
                const round = parseInt(input.dataset.round);
                const score = parseInt(input.value) || 0;
                scores[player][round - 1] = score;
            });
        });
        
        return scores;
    }

    calculateTeamTotals(scores) {
        const totals = {};
        
        Object.entries(scores).forEach(([teamId, teamScores]) => {
            totals[teamId] = teamScores.reduce((sum, score) => sum + (score || 0), 0);
        });
        
        return totals;
    }

    calculatePlayerTotals(scores) {
        const totals = {};
        
        Object.entries(scores).forEach(([player, playerScores]) => {
            totals[player] = playerScores.reduce((sum, score) => sum + (score || 0), 0);
        });
        
        return totals;
    }

    determineScoringWinner(totalScores) {
        let winner = '';
        let maxScore = -1;
        
        Object.entries(totalScores).forEach(([entity, score]) => {
            if (score > maxScore) {
                maxScore = score;
                winner = entity;
            }
        });
        
        return winner;
    }
}

