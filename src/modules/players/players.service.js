export class PlayersService {
    constructor(playersManager) {
        this.playersManager = playersManager;
    }

    showPlayerModal(player) {
        this.closePlayerModal();
        
        const modalHTML = `
        <div class="modal-overlay" id="player-modal">
            <div class="modal-content">
                <h2>👤 Профиль игрока</h2>
                <div class="player-info">
                    <p><strong>ID:</strong> ${player.id}</p>
                    <p><strong>Имя:</strong> ${player.name}</p>
                    <p><strong>Зарегистрирован:</strong> ${new Date(player.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="player-stats">
                    <h3>📊 Статистика</h3>
                    <p><strong>Всего игр:</strong> <span id="total-games">0</span></p>
                    <p><strong>Побед:</strong> <span id="total-wins">0</span></p>
                    <p><strong>Средний счет:</strong> <span id="avg-score">0</span></p>
                    <p><strong>Любимая игра:</strong> <span id="favorite-game">Неизвестно</span></p>
                </div>
                <button onclick="app.playersService.closePlayerModal()">Закрыть</button>
                <button onclick="app.playersService.editPlayer(${player.id})">✏️ Редактировать</button>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    closePlayerModal() {
        const existingModal = document.getElementById('player-modal');
        if (existingModal) {
            existingModal.remove();
        }
    }

    editPlayer(playerId) {
        console.log('Редактируем игрока:', playerId);
        alert(`Редактирование игрока ${playerId} - будет реализовано позже`);
        this.closePlayerModal();
    }
}