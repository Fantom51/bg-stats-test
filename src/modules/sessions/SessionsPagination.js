// frontend/src/modules/sessions/SessionsPagination.js

export class SessionsPagination {
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.totalPages = 1;
        this.totalItems = 0;
        this.containerId = null; // Будет устанавливаться динамически
        this.isPlayerProfile = false;
        this.playerName = null;
    }

    // 🎯 Основной метод для отображения с пагинацией
    renderPaginatedList(sessions, containerId, isPlayerProfile = false, playerName = null) {
        this.containerId = containerId;
        this.isPlayerProfile = isPlayerProfile;
        this.playerName = playerName;
        this.totalItems = sessions.length;
        
        // Рассчитываем общее количество страниц
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        if (this.totalPages === 0) this.totalPages = 1;
        
        // Ограничиваем currentPage в допустимых пределах
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
        
        // Получаем сессии для текущей страницы
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageSessions = sessions.slice(startIndex, endIndex);
        
        // Очищаем контейнер
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        // Если нет сессий
        if (sessions.length === 0) {
            const noSessionsHTML = this.isPlayerProfile 
                ? `<div class="no-sessions">
                      <p>🎯 Этот игрок еще не участвовал в играх</p>
                   </div>`
                : `<div class="no-sessions">
                      <p>🎯 Пока нет записанных сессий</p>
                      <p>Добавьте первую игру чтобы начать отслеживать статистику!</p>
                   </div>`;
            
            container.innerHTML = noSessionsHTML;
            this.renderPaginationControls(container);
            return;
        }
        
        // Рендерим сессии текущей страницы
        if (this.isPlayerProfile) {
            this.renderPlayerProfileSessions(pageSessions, container);
        } else {
            this.renderAllSessions(pageSessions, container);
        }
        
        // Добавляем пагинацию
        this.renderPaginationControls(container);
    }

    // 🎯 Рендеринг сессий для основной страницы
    renderAllSessions(sessions, container) {
        const fragment = document.createDocumentFragment();
        
        sessions.forEach(session => {
            const sessionElement = this.sessionsService.createSessionElement(session);
            fragment.appendChild(sessionElement);
        });
        
        container.appendChild(fragment);
        
        // Устанавливаем обработчики удаления
        this.sessionsService.setupDeleteHandlers();
    }

    // 🎯 Рендеринг сессий для профиля игрока
    renderPlayerProfileSessions(sessions, container) {
        const fragment = document.createDocumentFragment();
        
        sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `session-card ${session.winner === this.playerName ? 'session-win' : 'session-loss'}`;
            div.dataset.sessionId = session.id;
            div.innerHTML = this.sessionsService.createSessionTableItem(session, this.playerName);
            fragment.appendChild(div);
        });
        
        container.appendChild(fragment);
    }

    // 🎯 Пагинация (кнопки)
    renderPaginationControls(container) {
        if (this.totalPages <= 1) return;
        
        const paginationHTML = `
            <div class="pagination-controls">
                <div class="pagination-info">
                    Сессии ${((this.currentPage - 1) * this.itemsPerPage) + 1} - 
                    ${Math.min(this.currentPage * this.itemsPerPage, this.totalItems)} 
                    из ${this.totalItems}
                </div>
                
                <div class="pagination-buttons">
                    <button class="pagination-btn first-page" ${this.currentPage === 1 ? 'disabled' : ''}>
                        ⏮️ Первая
                    </button>
                    <button class="pagination-btn prev-page" ${this.currentPage === 1 ? 'disabled' : ''}>
                        ◀️ Назад
                    </button>
                    
                    <div class="page-numbers">
                        ${this.generatePageNumbers()}
                    </div>
                    
                    <button class="pagination-btn next-page" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        Вперёд ▶️
                    </button>
                    <button class="pagination-btn last-page" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        Последняя ⏭️
                    </button>
                </div>
                
                <div class="items-per-page-selector">
                    <label>Показывать по:</label>
                    <select class="items-per-page-select">
                        <option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="15" ${this.itemsPerPage === 15 ? 'selected' : ''}>15</option>
                        <option value="20" ${this.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                        <option value="30" ${this.itemsPerPage === 30 ? 'selected' : ''}>30</option>
                        <option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    </select>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterend', paginationHTML);
        
        // Вешаем обработчики
        this.setupPaginationHandlers();
    }

    // 🎯 Генерация номеров страниц
    generatePageNumbers() {
        let pagesHTML = '';
        const maxVisiblePages = 5; // Максимум видимых номеров страниц
        
        if (this.totalPages <= maxVisiblePages) {
            // Показать все страницы
            for (let i = 1; i <= this.totalPages; i++) {
                pagesHTML += `<button class="page-number ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        } else {
            // Сложная логика для многих страниц
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
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
            if (endPage < this.totalPages) {
                if (endPage < this.totalPages - 1) pagesHTML += `<span class="page-dots">...</span>`;
                pagesHTML += `<button class="page-number" data-page="${this.totalPages}">${this.totalPages}</button>`;
            }
        }
        
        return pagesHTML;
    }

    // 🎯 Обработчики пагинации
    setupPaginationHandlers() {
        // Кнопки навигации
        document.querySelector('.first-page')?.addEventListener('click', () => this.goToPage(1));
        document.querySelector('.prev-page')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.querySelector('.next-page')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.querySelector('.last-page')?.addEventListener('click', () => this.goToPage(this.totalPages));
        
        // Номера страниц
        document.querySelectorAll('.page-number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                this.goToPage(page);
            });
        });
        
        // Изменение количества сессий на странице
        const itemsPerPageSelect = document.querySelector('.items-per-page-select');
        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1; // Сбрасываем на первую страницу
                this.refreshCurrentView();
            });
        }
    }

    // 🎯 Переход на страницу
    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        
        this.currentPage = page;
        this.refreshCurrentView();
        
        // Прокрутка к верху контейнера
        const container = document.getElementById(this.containerId);
        if (container) {
            container.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // 🎯 Обновление текущего вида
    refreshCurrentView() {
        // Удаляем старые элементы пагинации
        this.removePaginationControls();
        
        // Получаем нужные сессии в зависимости от контекста
        let sessions;
        
        if (this.isPlayerProfile && this.playerName) {
            sessions = this.sessionsService.sessionsManager.getPlayerSessions(this.playerName);
        } else {
            sessions = this.sessionsService.sessionsManager.getSessions();
        }
        
        // Рендерим заново
        this.renderPaginatedList(
            sessions, 
            this.containerId, 
            this.isPlayerProfile, 
            this.playerName
        );
    }

    // 🎯 Удаление элементов пагинации
    removePaginationControls() {
        const paginationControls = document.querySelector('.pagination-controls');
        if (paginationControls) {
            paginationControls.remove();
        }
    }

    // 🎯 Сброс пагинации (например, при добавлении новой сессии)
    resetPagination() {
        this.currentPage = 1;
        this.removePaginationControls();
    }
}