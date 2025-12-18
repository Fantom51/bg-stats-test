export class SPARouter {
    constructor(routes, app) {
        this.routes = routes;
        this.app = app;
        this.appContainer = document.getElementById('app');
        this.init();
    }
    
    init() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('[data-link]');
            if (link) {
                event.preventDefault();
                this.navigate(link.href);
            }
        });
        
        window.addEventListener('hashchange', () => this.loadRoute());
        window.addEventListener('load', () => this.loadRoute());
    }
    
    navigate(url) {
        let hash = '';
        if (url.startsWith('#')) {
            hash = url;
        } else if (url.includes('#')) {
            hash = '#' + url.split('#')[1];
        } else {
            hash = '#/';
        }
        
        if (!hash.startsWith('#/')) {
            hash = '#/' + hash.replace('#', '');
        }
        
        window.location.hash = hash;
    }
    
    async loadRoute() {
        const path = window.location.hash.replace('#', '') || '/';
        
        // Ищем маршрут (проверяем точное совпадение ИЛИ начинается с /player/)
        let route = this.routes.find(route => route.path === path);
        
        if (!route && path.startsWith('/player/')) {
            // Если путь начинается с /player/ - используем маршрут /player/:id
            route = this.routes.find(route => route.path === '/player/:id');
        }
        
        if (!route) {
            this.appContainer.innerHTML = '<h2>404 - Страница не найдена</h2>';
            return;
        }
        
        try {
            const templateFile = this.getTemplateFile(path);
            const response = await fetch(templateFile);
            if (!response.ok) throw new Error(`Файл не найден: ${templateFile}`);
            
            const html = await response.text();
            this.appContainer.innerHTML = html;
            
            // Загружаем скрипты для страницы если нужно
            if (route.path === '/games') {
                await this.loadGamesModule();
            }
            
            if (route.path === '/sessions') {  
                await this.loadSessionsModule();
            }   

            // Инициализация страницы
            if (route.init && typeof route.init === 'function') {
                route.init.call(this.app);
            }
            
        } catch (error) {
            console.error('💥 Ошибка загрузки:', error);
            this.appContainer.innerHTML = `
                <div style="color: red; padding: 20px;">
                    <h2>Ошибка загрузки страницы</h2>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    getTemplateFile(path) {
        // Если путь начинается с /player/ - используем home.html
        if (path.startsWith('/player/')) {
            return 'pages/player-profile.html';
        }
        
        switch(path) {
            case '/': return 'pages/home.html';
            case '/games': return 'pages/games.html';
            case '/sessions': return 'pages/sessions.html';
            case '/stats': return 'pages/stats.html';
            default: return 'pages/' + path.replace('/', '') + '.html';
        }
    }

    async loadGamesModule() {
        return new Promise((resolve) => {
            // ✅ Проверяем готовность sessionsManager
            if (!this.app.sessionsManager || !this.app.sessionsManager.isInitialized) {
                console.error('❌ sessionsManager не готов!');
                resolve();
                return;
            }
            
            // ✅ Проверяем что gamesCatalog еще не создан
            if (this.app.gamesCatalog) {
                console.log('✅ GamesCatalog уже создан');
                resolve();
                return;
            }
            
            import('../modules/games/GamesCatalog.js').then(module => {
                this.app.gamesCatalog = new module.GamesCatalog(
                    this.app.sessionsManager, 
                    this.app.bggRatingsService // ← УБЕДИСЬ ЧТО ПЕРЕДАЕШЬ bggRatingsService
                );
                this.app.gamesCatalog.init().then(resolve);
            });
        });
    }

    async loadSessionsModule() {
        return new Promise((resolve) => {
            // ✅ ПРОСТО ПРОВЕРЯЕМ ЧТО SessionsManager УЖЕ ИНИЦИАЛИЗИРОВАН
            if (this.app.sessionsManager && this.app.sessionsManager.isInitialized) {
                console.log('✅ SessionsManager уже инициализирован');
                resolve();
                return;
            }
            
            // ❌ УБИРАЕМ СОЗДАНИЕ НОВОГО МЕНЕДЖЕРА!
            console.warn('⚠️ SessionsManager не инициализирован, но должен быть создан в app.js');
            resolve();
        });
    }
}

