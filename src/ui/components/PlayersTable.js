export class PlayersTable {
    constructor(playersManager, playersService) {
        this.playersManager = playersManager;
        this.playersService = playersService;
    }

    updateTable() {
        const tableBody = document.getElementById('players-table-body');
        const noPlayers = document.getElementById('no-players');
        const playersCount = document.getElementById('players-count');
        
        if (!tableBody) return;

        const players = this.playersManager.getAllPlayers();
        
        // Обновляем счетчик
        if (playersCount) {
            playersCount.textContent = players.length;
        }

        // Показываем/скрываем сообщение "нет игроков"
        if (noPlayers) {
            if (players.length === 0) {
                noPlayers.classList.remove('hidden');
                tableBody.innerHTML = '';
            } else {
                noPlayers.classList.add('hidden');
            }
        }

        if (players.length === 0) return;

        const rowsHTML = players.map(player => this.createPlayerRow(player)).join('');
        tableBody.innerHTML = rowsHTML;

        // Добавляем обработчики удаления
        this.addDeleteHandlers();
    }

    createPlayerRow(player) {
        const date = new Date(player.createdAt).toLocaleDateString('ru-RU');
        const avatarText = this.getAvatarText(player.name);
        
        return `
            <tr>
                <td>
                    <div class="player-name">
                        <div class="player-avatar">${avatarText}</div>
                        <a href="#/player/${player.id}" class="player-link" data-player-id="${player.id}">${player.name}</a>
                    </div>
                </td>
                <td class="player-date">${date}</td>
                <td>
                    <button class="delete-btn" data-player-id="${player.id}">
                        <svg class="delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }

    getAvatarText(name) {
        // Берем первые буквы имени и фамилии
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    addDeleteHandlers() {
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async (e) => { // 🔥 ДОБАВЬ async
                const playerId = e.currentTarget.dataset.playerId; // 🔥 УБЕРИ parseInt
                await this.deletePlayer(playerId); // 🔥 ДОБАВЬ await
            });
        });
    }

    async deletePlayer(playerId) {
        if (confirm('Вы уверены, что хотите удалить этого игрока?')) {
            try {
                // 🔥 ТЕПЕРЬ АСИНХРОННЫЙ ВЫЗОВ
                await this.playersManager.deletePlayer(playerId);
                this.updateTable();
            } catch (error) {
                console.error('Ошибка удаления игрока:', error);
                alert('Ошибка при удалении игрока');
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { PlayersTable };