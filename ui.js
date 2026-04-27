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

function toggleExportMenu() {
    const menu = document.getElementById('export-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function showDownloadLink(url) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 40px; margin-bottom: 15px;">📄</div>
            <p style="margin-bottom: 20px;">Ваш файл готов к скачиванию</p>
            <button class="btn-primary" onclick="tg.openLink('${url}')">СКАЧАТЬ ФАЙЛ</button>
        </div>
    `;
    document.getElementById('result-section').classList.add('active');
}


function toggleFilterForm() {
    editingFilterId = null; // Сбрасываем режим редактирования
    const form = document.getElementById('add-filter-form');
    const btn = document.getElementById('add-filter-btn');
    const isHidden = form.style.display === 'none';
    
    // Сброс полей при открытии пустой формы
    if (isHidden) {
        document.getElementById('filter-trigger').value = '';
        document.querySelector('#add-filter-form .btn-primary').innerText = 'СОХРАНИТЬ ФИЛЬТР';
    }

    form.style.display = isHidden ? 'block' : 'none';
    btn.style.display = isHidden ? 'none' : 'block';
}

function renderFilters() {
    const list = document.getElementById('filters-list');
    if (!userFilters || userFilters.length === 0) {
        list.innerHTML = '<p class="placeholder" style="font-size: 12px; color: var(--hint-color); text-align: center; padding: 10px;">У вас пока нет настроенных фильтров</p>';
        return;
    }
    
    list.innerHTML = userFilters.map(f => `
        <div class="filter-item">
            <div class="filter-info">
                <span class="filter-name">${f.trigger}</span>
                <span class="filter-meta">${f.type === 'ai' ? '🤖 AI' : '📝 Ключи'} | ${f.object === 'messages' ? 'Сообщения' : 'Люди'}</span>
            </div>
            <div class="filter-actions" style="display: flex; gap: 8px;">
                <button class="btn-tool" onclick="viewFilterResults(${f.id})" style="width:30px; height:30px; font-size:14px; background:var(--primary-color)">📂</button>
                <button class="btn-tool" onclick="editFilter(${f.id})" style="width:30px; height:30px; font-size:14px; background:#f39c12">✏️</button>
                <button class="btn-tool" onclick="deleteFilter(${f.id})" style="width:30px; height:30px; font-size:14px; background:#e64646">×</button>
            </div>
        </div>
    `).join('');
}

function editFilter(id) {
    const f = userFilters.find(item => item.id === id);
    if (!f) return;

    editingFilterId = id;
    
    // Заполняем форму данными
    document.getElementById('filter-object').value = f.object;
    document.getElementById('filter-type').value = f.type;
    document.getElementById('filter-trigger').value = f.trigger;
    document.getElementById('f-notify').checked = f.notify;
    document.getElementById('f-save').checked = f.save;

    // Показываем форму и меняем текст кнопки
    const form = document.getElementById('add-filter-form');
    const btn = document.getElementById('add-filter-btn');
    form.style.display = 'block';
    btn.style.display = 'none';
    document.querySelector('#add-filter-form .btn-primary').innerText = 'ОБНОВИТЬ ФИЛЬТР';
}

function viewFilterResults(id) {
    const f = userFilters.find(item => item.id === id);
    // Переключаем на гармошку РЕЗУЛЬТАТ
    document.getElementById('filter-section').classList.remove('active');
    document.getElementById('result-section').classList.add('active');
    
    const container = document.getElementById('results-container');
    container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--hint-color);">
            <p>Результаты по фильтру: <b>${f.trigger}</b></p>
            <p style="font-size: 12px; margin-top: 10px;">(Здесь будет список срабатываний фильтра)</p>
        </div>
    `;
}

function setBeginningDate() {
    document.getElementById('date-from').value = '2000-01-01';
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-to').value = today;
}

function switchToolMode(mode) {
    // 1. Переключаем кнопки
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-mode-${mode}`).classList.add('active');

    // 2. Переключаем панели настроек
    document.querySelectorAll('.tool-pane').forEach(pane => pane.style.display = 'none');
    document.getElementById(`pane-${mode}`).style.display = 'block';

    // 3. Меняем текст главной кнопки
    const actionBtn = document.getElementById('main-action-btn');
    if (mode === 'search') actionBtn.innerText = 'НАЙТИ';
    else if (mode === 'chat') actionBtn.innerText = 'СПРОСИТЬ ИИ';
    else if (mode === 'analysis') actionBtn.innerText = 'АНАЛИЗИРОВАТЬ';
}

function runMainTool() {
    const activeMode = document.querySelector('.mode-btn.active').id.replace('btn-mode-', '');
    
    if (activeMode === 'search') {
        performSearch(); 
    } else {
        tg.showAlert("Этот инструмент сейчас находится в разработке");
    }
}
