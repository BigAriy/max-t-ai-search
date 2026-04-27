function toggleAddForm() {
    const form = document.getElementById('add-source-form');
    const btn = document.getElementById('add-group-btn');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    btn.style.display = isHidden ? 'none' : 'block';
}

function renderResults(messages) {
    const container = document.getElementById('results-container');
    document.getElementById('result-count').innerText = messages.length;
    container.innerHTML = '';

    if (messages.length === 0) {
        container.innerHTML = '<p class="hint">Ничего не найдено</p>';
        document.getElementById('export-btn').style.display = 'none';
        return;
    }

    messages.forEach(m => {
        const card = document.createElement('div');
        card.className = 'message-card';
        card.innerHTML = `
            <div class="message-meta">
                <span class="m-date">${m.date}</span>
                <span class="m-user">User ID: ${m.sender}</span>
            </div>
            <div class="m-text">${m.text.replace(/\n/g, '<br>')}</div>
        `;
        container.appendChild(card);
    });
    document.getElementById('export-btn').style.display = 'block';
}

function exportResults() {
    if (lastResults.length === 0) return;

    let md = `# Отчет о поиске\nЭкспортировано: ${new Date().toLocaleString()}\n\n---\n\n`;
    lastResults.forEach(m => {
        md += `**[${m.date}] User ${m.sender}:**\n> ${m.text.replace(/\n/g, '\n> ')}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_export_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function updateToolButtons() {
    const selected = Array.from(document.querySelectorAll('.source-check:checked'));
    const delBtn = document.getElementById('delete-group-btn');
    const syncBtn = document.getElementById('sync-group-btn');
    const hint = document.getElementById('selection-hint');
    
    const show = selected.length > 0;
    delBtn.style.display = show ? 'block' : 'none';
    syncBtn.style.display = show ? 'block' : 'none';
    hint.innerText = show ? `Выбрано: ${selected.length}` : '';
}

function showSourceInfo(chatId) {
    const src = sourcesCache[chatId];
    if (!src) return;
    tg.showAlert(`📖 ${src.title}\n\n${src.description || 'Описание отсутствует'}`);
}

function setupWebSocketHandlers() {
    WebSocketClient.on('status_update', (data) => {
        const item = document.querySelector(`.source-item[data-id="${data.chat_id}"]`);
        if (!item) return;

        const statusLabels = {
            'pending': 'Ожидание', 'ready': 'Готов', 'syncing': 'Обновление',
            'paused': 'Пауза', 'disabled': 'Отключен', 'error': 'Ошибка'
        };

        const canSearch = ['ready', 'syncing', 'paused'].includes(data.status);
        
        // Обновляем классы и состояние чекбокса
        item.className = `source-item status-${data.status} ${!canSearch ? 'is-restricted' : ''} ${data.status === 'syncing' ? 'is-syncing' : ''}`;
        
        const checkbox = item.querySelector('.source-check');
        if (checkbox) checkbox.disabled = !canSearch;

        // Обновляем текстовый статус
        const statusLabel = item.querySelector('.status-label');
        if (statusLabel) statusLabel.innerText = statusLabels[data.status] || data.status;

        if (data.msg_count !== undefined) {
            const badge = item.querySelector('.msg-badge');
            if (badge) badge.innerText = data.msg_count;
        }

        if (data.last_sync) {
            const dateLabel = item.querySelector('.sync-date');
            if (dateLabel) dateLabel.innerText = `Обновлено: ${data.last_sync}`;
        }
    });
}
