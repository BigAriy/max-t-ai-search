function toggleAddForm() {
    const form = document.getElementById('add-source-form');
    const btn = document.getElementById('add-group-btn');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    btn.style.display = isHidden ? 'none' : 'block';
}

function renderResults(messages) {
    const container = document.getElementById('results-container');
    const resultActions = document.querySelector('.result-actions');
    
    // Очищаем контейнер только если это новый поиск (offset был сброшен)
    // Но так как renderResults получает ВЕСЬ массив lastResults, мы его перерисовываем целиком
    document.getElementById('result-count').innerText = messages.length;
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<p class="hint">Ничего не найдено</p>';
        if (resultActions) resultActions.style.display = 'none';
        return;
    }

    messages.forEach(m => {
        const card = document.createElement('div');
        card.className = 'message-card';
        
        // Рендерим Markdown
        const renderedText = marked.parse(m.text || "");
        
        // Формируем ссылку на сообщение через API Telegram
        let msgLink = "";
        if (m.chat_username) {
            msgLink = `<span onclick="openTelegramMessage('${m.chat_username}', ${m.tg_id})" style="cursor:pointer; margin-left:8px; font-size: 14px;">🔗</span>`;
        }

        card.innerHTML = `
            <div class="message-meta">
                <span class="m-date">${m.date}</span>
                <span class="m-user">${m.sender}${msgLink}</span>
            </div>
            <div class="m-text">${renderedText}</div>
        `;
        container.appendChild(card);
    });
    if (resultActions) resultActions.style.display = 'flex';

    // Если количество результатов кратно странице, вероятно есть еще данные
    const perPage = 50; // Здесь можно будет динамически получать из настроек
    if (messages.length > 0 && messages.length % perPage === 0) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'btn-secondary';
        moreBtn.style.margin = '20px 0';
        moreBtn.innerText = 'ПОКАЗАТЬ ЕЩЕ';
        moreBtn.onclick = () => performSearch(true);
        container.appendChild(moreBtn);
    }
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
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function showDownloadLink(url) {
    const container = document.getElementById('results-container');
    if (!container) return;
    
    // Прячем иконки экспорта на время показа ссылки
    const resultActions = document.querySelector('.result-actions');
    if (resultActions) resultActions.style.display = 'none';

    container.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 40px; margin-bottom: 15px;">📄</div>
            <p style="margin-bottom: 20px;">Ваш файл готов к скачиванию</p>
            <button class="btn-primary" onclick="tg.openLink('${url}')">СКАЧАТЬ ФАЙЛ</button>
            <button class="btn-secondary" style="margin-top:10px; border:none;" onclick="renderResults(lastResults)">Вернуться к результатам</button>
        </div>
    `;
    const resSection = document.getElementById('result-section');
    if (resSection) resSection.classList.add('active');
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
    } else if (activeMode === 'chat') {
        performAIAnalysis();
    } else if (activeMode === 'analysis') {
        const tool = document.getElementById('analysis-tool').value;
        if (tool === 'experts') performExpertsAnalysis();
        else if (tool === 'graph') performGraphAnalysis();
        else tg.showAlert("Этот инструмент в разработке");
    } else {
        tg.showAlert("Этот инструмент сейчас находится в разработке");
    }
}

function openTelegramMessage(username, msgId) {
    // Используем специальный метод Mini App для открытия внутренних ссылок
    tg.openTelegramLink(`https://t.me/${username}/${msgId}`);
}

function renderAIResult(text) {
    const container = document.getElementById('results-container');
    const resultActions = document.querySelector('.result-actions');
    document.getElementById('result-count').innerText = "AI";
    
    container.innerHTML = `
        <div class="message-card" style="border-left: 4px solid var(--primary-color); background: rgba(51, 144, 236, 0.03);">
            <div class="message-meta">
                <span class="m-user">🤖 Ответ ИИ-ассистента</span>
            </div>
            <div class="m-text" id="ai-response-text">${marked.parse(text)}</div>
        </div>
    `;

    if (resultActions) {
        resultActions.style.display = 'flex';
        // Прячем иконку XLS для текста ИИ, так как она там не нужна
        const xlsBtn = resultActions.querySelector('.export-btn[onclick*="excel"]');
        if (xlsBtn) xlsBtn.style.display = 'none';
        
        // Подменяем функции экспорта для этого случая
        const exportBtns = resultActions.querySelectorAll('.export-btn');
        exportBtns.forEach(btn => {
            const fmt = btn.querySelector('span').innerText.toLowerCase().replace('htm', 'html');
            if (fmt !== 'xls') {
                btn.onclick = () => exportRawText(text, fmt);
            }
        });
    }
}

async function exportRawText(text, format) {
    tg.MainButton.setText("СОХРАНЕНИЕ...");
    tg.MainButton.show();
    try {
        const response = await fetch(`${API_BASE}/api/export/raw-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, format })
        });
        const result = await response.json();
        if (result.download_url) showDownloadLink(result.download_url);
    } catch (e) { tg.showAlert("Ошибка экспорта"); }
    finally { tg.MainButton.hide(); }
}

function renderExpertsResult(experts) {
    const container = document.getElementById('results-container');
    const resultActions = document.querySelector('.result-actions');
    document.getElementById('result-count').innerText = experts.length;
    container.innerHTML = '';

    if (!experts || experts.length === 0) {
        container.innerHTML = '<p class="hint">Активных пользователей не найдено</p>';
        if (resultActions) resultActions.style.display = 'none';
        return;
    }

    experts.forEach(exp => {
        const card = document.createElement('div');
        card.className = 'message-card';
        card.style.borderLeft = '4px solid #f39c12';
        card.innerHTML = `
            <div class="message-meta">
                <span class="m-user" style="color:var(--text-color)">👤 ${exp.name}</span>
                <span class="status-badge" style="background:#f39c12; color:white; padding:2px 6px; border-radius:4px;">${exp.count} сообщ.</span>
            </div>
            <div class="m-text" style="font-style: italic; color: var(--hint-color); margin-top:5px;">
                ${exp.bio}
            </div>
        `;
        container.appendChild(card);
    });
    
    if (resultActions) {
        resultActions.style.display = 'flex';
        // Для списка экспертов Excel может быть полезен, но PDF/TXT тоже ок.
        // Пока оставляем логику как есть.
    }
}

function renderGraphResult(data) {
    const container = document.getElementById('results-container');
    const resultActions = document.querySelector('.result-actions');
    document.getElementById('result-count').innerText = data.links.length;
    container.innerHTML = '';

    // 1. Блок вердикта ИИ
    const aiCard = document.createElement('div');
    aiCard.className = 'message-card';
    aiCard.style.borderLeft = '4px solid #9b59b6';
    aiCard.innerHTML = `
        <div class="message-meta"><span class="m-user">🟣 Анализ структуры сообщества</span></div>
        <div class="m-text">${marked.parse(data.verdict)}</div>
    `;
    container.appendChild(aiCard);

    // 2. Список топ-связей
    if (data.links.length > 0) {
        const listTitle = document.createElement('p');
        listTitle.style = 'font-size:12px; font-weight:bold; margin: 15px 0 10px; color:var(--hint-color);';
        listTitle.innerText = 'ТОП ВЗАИМОДЕЙСТВИЙ (ОТВЕТОВ):';
        container.appendChild(listTitle);

        data.links.forEach(link => {
            const row = document.createElement('div');
            row.style = 'display:flex; justify-content:space-between; font-size:13px; padding:8px; background:var(--bg-color); border-radius:8px; margin-bottom:4px; border:1px solid rgba(0,0,0,0.03);';
            row.innerHTML = `
                <span><b>${link.source}</b> ➔ ${link.target}</span>
                <span style="color:var(--primary-color); font-weight:bold;">${link.value}</span>
            `;
            container.appendChild(row);
        });
    }

    if (resultActions) resultActions.style.display = 'flex';
}
