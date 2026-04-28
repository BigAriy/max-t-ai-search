async function initUserProfile() {
    const initData = tg.initData;
    console.log("Starting init request to:", `${API_BASE}/api/user/init`);
    
    try {
        const response = await fetch(`${API_BASE}/api/user/init?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                initData: initData || "", 
                direct_user_id: globalUserId 
            })
        });
        
        if (!response.ok) throw new Error("Auth failed");
        
        userProfile = await response.json();
        document.getElementById('user-name').innerText = userProfile.full_name;
        console.log("Profile loaded:", userProfile);
        
        // Запускаем WebSocket соединение
        WebSocketClient.connect(userProfile.id, API_BASE);
        setupWebSocketHandlers();

        loadUserSources();
		loadUserFilters();
    } catch (e) {
        console.error("Critical init error:", e);
        document.getElementById('user-name').innerText = "Ошибка входа";
    }
}

async function previewSource() {
    const urlInput = document.getElementById('new-group-url');
    const saveBtn = document.querySelector('#add-source-form .btn-primary');
    const statusDiv = document.getElementById('preview-status');
    let url = urlInput.value.trim();
    
    // Скрываем старый статус при новом вводе
    statusDiv.style.display = 'none';
    if (!url) return;

    // 1. Проверка на критическую длину
    if (url.length > 200) {
        statusDiv.innerText = "Ошибка: слишком длинный адрес (макс. 200 символов)";
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(230, 70, 70, 0.1)';
        statusDiv.style.color = '#e64646';
        saveBtn.disabled = true;
        return;
    }

    // 2. Валидация формата (разрешает слэши и ID в конце)
    const tgRegex = /^(@[a-zA-Z0-9_]{4,32}|(https?:\/\/)?(t\.me|telegram\.me|telegram\.dog)\/[a-zA-Z0-9_+]{4,}(\/.*)?)$/;
    if (!tgRegex.test(url)) {
        statusDiv.innerText = "Неверный формат. Используйте @username или ссылку t.me/...";
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(230, 70, 70, 0.1)';
        statusDiv.style.color = '#e64646';
        saveBtn.disabled = true;
        return;
    }

    // 3. Нормализация URL (отрезаем хвосты типа /8002)
    if (url.includes('t.me/') || url.includes('telegram.me/')) {
        const parts = url.split('/');
        const domainIndex = parts.findIndex(p => p.includes('t.me') || p.includes('telegram.me'));
        if (domainIndex !== -1 && parts[domainIndex + 1]) {
            const proto = url.startsWith('http') ? parts[0] + '//' : 'https://';
            url = proto + parts[domainIndex] + '/' + parts[domainIndex + 1];
            console.log("🔗 URL Normalized to:", url);
        }
    }

    // Блокируем ввод и кнопку перед запросом
    urlInput.disabled = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-inline"></span> ПРОВЕРКА...';
    
    try {
        const response = await fetch(`${API_BASE}/api/sources/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                initData: tg.initData || "", 
                user_id: globalUserId,
                url: url 
            })
        });
        
        if (!response.ok) throw new Error("Not found");
        currentPreview = await response.json();
        
        statusDiv.innerHTML = currentPreview.status_text;
        statusDiv.style.display = 'block';
        statusDiv.style.background = currentPreview.is_allowed ? 'rgba(49, 181, 69, 0.1)' : 'rgba(230, 70, 70, 0.1)';
        statusDiv.style.color = currentPreview.is_allowed ? 'var(--text-color)' : '#e64646';
        
        const topicsDiv = document.getElementById('topics-select');
        topicsDiv.innerHTML = '';
        if (currentPreview.is_forum && currentPreview.topics.length > 0) {
            topicsDiv.innerHTML = '<p style="margin-bottom:8px">Выберите разделы:</p>';
            currentPreview.topics.forEach(t => {
                topicsDiv.innerHTML += `
                    <label style="display:block; margin-bottom:5px;"><input type="checkbox" name="topic-id" value="${t.id}" checked> ${t.title}</label>
                `;
            });
            topicsDiv.style.display = 'block';
            document.getElementById('all-topics-row').style.display = 'none';
        } else {
            topicsDiv.style.display = 'none';
            document.getElementById('all-topics-row').style.display = 'block';
        }
        saveBtn.disabled = !currentPreview.is_allowed;
    } catch (e) {
        tg.showAlert("Группа не найдена или доступ запрещен. Проверьте ссылку.");
        currentPreview = null;
    } finally {
        urlInput.disabled = false;
        saveBtn.innerText = 'СОХРАНИТЬ';
    }
}

async function submitNewSource() {
    if (!currentPreview) return tg.showAlert("Сначала дождитесь проверки группы");

    const saveBtn = document.querySelector('#add-source-form .btn-primary');
    const freq = document.getElementById('update-freq').value;
    const depth = document.getElementById('history-depth').value;
    const selectedTopics = Array.from(document.querySelectorAll('input[name="topic-id"]:checked')).map(el => parseInt(el.value));
    const allTopics = document.getElementById('all-topics').checked;

    const finalTopicIds = currentPreview.is_forum && !allTopics ? selectedTopics : null;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-inline"></span> СОХРАНЕНИЕ...';
    tg.MainButton.showProgress();
    try {
        const response = await fetch(`${API_BASE}/api/sources/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initData: tg.initData || "",
                user_id: globalUserId,
                chat_id: currentPreview.chat_id,
                title: currentPreview.title,
                username: currentPreview.username,
                update_interval: freq,
                history_depth_days: parseInt(depth),
				type: currentPreview.type,
                topic_ids: finalTopicIds
            })
        });
        
        if (response.ok) {
            tg.showAlert("Группа успешно добавлена в список мониторинга!");
            toggleAddForm();
            loadUserSources();
            document.getElementById('new-group-url').value = '';
            currentPreview = null;
        } else {
            const err = await response.json();
            tg.showAlert("Ошибка сервера: " + (err.detail || "неизвестно"));
        }
    } catch (e) {
        tg.showAlert("Ошибка связи с сервером при сохранении");
    }
    tg.MainButton.hideProgress();
}

async function loadUserSources() {
    const list = document.getElementById('groups-list');
    list.innerHTML = '<div class="loading-overlay"><span class="spinner-inline" style="border-top-color:var(--primary-color)"></span> Загрузка списка...</div>';
    
    try {
        const url = `${API_BASE}/api/sources/list?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const sources = await response.json();
        list.innerHTML = '';
        
        if (!Array.isArray(sources) || sources.length === 0) {
            list.innerHTML = '<div class="loading-overlay">Источников пока нет</div>';
            document.getElementById('source-status').innerText = "Выбрано: 0";
            return;
        }

        sources.forEach(src => {
            sourcesCache[src.chat_id] = src;
            
            const avatar = src.avatar_url ? `${API_BASE}${src.avatar_url}?v=${Date.now()}` : 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';
            
            // ПРАВИЛО: Выбор разрешен только для READY, SYNCING, PAUSED
            const canSearch = ['ready', 'syncing', 'paused'].includes(src.status);
            
            const statusLabels = {
                'pending': 'Ожидание', 'ready': 'Готов', 'syncing': 'Обновление',
                'paused': 'Пауза', 'disabled': 'Отключен', 'error': 'Ошибка'
            };

            const item = document.createElement('div');
            item.className = `source-item status-${src.status} ${!canSearch ? 'is-restricted' : ''}`;
            item.setAttribute('data-id', String(src.chat_id));
            
            // ВАЖНО: Принудительный стиль строки
            item.style.cssText = "display: flex; flex-direction: row; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); background: var(--bg-color); width: 100%; box-sizing: border-box;";

            item.innerHTML = `
                <div class="source-row" style="display: flex; align-items: center; width: 100%;">
                    <!-- 1. ЛЕВО -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <input type="checkbox" class="source-check" value="${src.chat_id}" 
                               onchange="updateToolButtons()" ${!canSearch ? 'disabled' : ''} 
                               style="width: 18px; height: 18px; margin: 0;">
                        <img src="${avatar}" class="source-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    </div>

                    <!-- 2. ЦЕНТР -->
                    <div class="source-info" style="flex: 1; min-width: 0; padding: 0 10px; display: flex; flex-direction: column;">
                        <div style="font-weight: 600; font-size: 14px; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${src.title || 'Без названия'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; margin: 2px 0;">
                            <span class="status-label">${statusLabels[src.status] || src.status}</span>
                            <button onclick="toggleTopics('${src.chat_id}')" class="btn-topics-toggle" 
                                    style="font-size: 10px; background: none; border: 1px solid var(--primary-color); color: var(--primary-color); border-radius: 4px; padding: 0 4px; cursor: pointer;">
                                Разделы ▼
                            </button>
                        </div>
                        <div class="sync-date" style="font-size: 9px; color: var(--hint-color); opacity: 0.7;">${src.last_sync}</div>
                    </div>

                    <!-- 3. ПРАВО -->
                    <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; flex-shrink: 0; min-width: 45px; height: 42px;">
                        <span class="msg-badge" style="background: var(--primary-color); color: white; font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: bold;">
                            ${src.msg_count}
                        </span>
                        <div style="display: flex; gap: 0;">
                            <button onclick="tg.openLink('https://t.me/${src.username || 'c/'+src.chat_id}')" style="background:none; border:none; padding:4px; font-size: 14px;">🔗</button>
                            <button onclick="showSourceInfo('${src.chat_id}')" style="background:none; border:none; padding:4px; font-size: 14px;">❓</button>
                        </div>
                    </div>
                </div>
                <!-- Контейнер для подгрупп -->
                <div id="topics-${src.chat_id}" class="topics-container" style="display: none; width: 100%; padding: 5px 0 5px 45px; background: rgba(0,0,0,0.02);"></div>
            `;
            list.appendChild(item);
        });
        document.getElementById('source-status').innerText = "Всего: " + sources.length;
        updateToolButtons();
    } catch (e) {
        console.error("Critical error in loadUserSources:", e);
        list.innerHTML = `<div class="loading-overlay" style="color:red">Ошибка: ${e.message}</div>`;
    }
}


async function deleteSelected() {
    const selected = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    if (!confirm(`Удалить выбранные источники (${selected.length}) из вашего аккаунта?`)) return;

    try {
        await fetch(`${API_BASE}/api/sources?initData=${encodeURIComponent(tg.initData)}&ids=${selected.join(',')}`, {
            method: 'DELETE'
        });
        loadUserSources();
    } catch (e) {
        tg.showAlert("Ошибка при удалении");
    }
}

async function syncSelected() {
    const selected = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    tg.showConfirm(`Запустить немедленное обновление для ${selected.length} источников?`, async (ok) => {
        if (ok) {
            try {
                await fetch(`${API_BASE}/api/sources/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initData: tg.initData, ids: selected })
                });
                tg.showAlert("Запрос на обновление принят. Это может занять несколько минут.");
            } catch (e) {
                tg.showAlert("Ошибка при запросе обновления");
            }
        }
    });
}

async function toggleTopics(chatId) {
    const container = document.getElementById(`topics-${chatId}`);
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = '<div style="font-size:10px; color:var(--hint-color)">Загрузка разделов...</div>';
    container.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/api/sources/topics?chat_id=${chatId}&initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}`);
        const topics = await response.json();
        
        if (topics.length === 0) {
            container.innerHTML = '<div style="font-size:10px; color:var(--hint-color)">В этой группе нет разделов</div>';
            return;
        }

        container.innerHTML = topics.map(t => `
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
                <input type="checkbox" class="topic-check" data-chat-id="${chatId}" value="${t.id}" style="width: 14px; height: 14px; margin: 0;">
                <span style="font-size: 12px; color: var(--text-color);">${t.title}</span>
            </label>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="font-size:10px; color:red">Ошибка загрузки</div>';
    }
}

async function startExport(format) {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const selectedChats = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    const selectedTopics = Array.from(document.querySelectorAll('.topic-check:checked')).map(el => el.value);

    if (selectedChats.length === 0) return tg.showAlert("Выберите хотя бы один источник");

    tg.MainButton.setText("ФОРМИРОВАНИЕ ФАЙЛА...");
    tg.MainButton.show();
    tg.MainButton.showProgress();

    try {
        let url = `${API_BASE}/api/messages/export?format=${format}&initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&chat_ids=${selectedChats.join(',')}`;
        if (selectedTopics.length > 0) url += `&topic_ids=${selectedTopics.join(',')}`;
        if (dateFrom) url += `&d_from=${dateFrom}`;
        if (dateTo) url += `&d_to=${dateTo}`;

        const response = await fetch(url);
        const result = await response.json();
        
        // Сначала гасим индикацию прогресса, чтобы интерфейс не зависал
        tg.MainButton.hide();
        tg.MainButton.hideProgress();

        if (result.download_url) {
            showDownloadLink(result.download_url);
            // Пытаемся закрыть меню, только если оно существует (в текущем HTML его нет)
            toggleExportMenu();
        } else {
            tg.showAlert("Ошибка: сервер не вернул ссылку на файл");
        }
    } catch (e) {
        // Если произошла ошибка, сначала убираем крутилку, потом показываем текст
        tg.MainButton.hide();
        tg.MainButton.hideProgress();
        console.error("Export error:", e);
        tg.showAlert("Ошибка связи с сервером");
    } finally {
        tg.MainButton.hide();
    }
}

async function loadUserFilters() {
    try {
        const url = `${API_BASE}/api/filters/list?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&t=${Date.now()}`;
        const response = await fetch(url);
        userFilters = await response.json();
        renderFilters();
        document.getElementById('filter-status').innerText = `${userFilters.filter(f => f.active).length} активных`;
    } catch (e) { console.error("Error loading filters:", e); }
}

async function submitNewFilter() {
    const trigger = document.getElementById('filter-trigger').value.trim();
    if (!trigger) return tg.showAlert("Введите ключевые слова или промпт");

    const payload = {
        initData: tg.initData || "",
        user_id: globalUserId,
        object: document.getElementById('filter-object').value,
        type: document.getElementById('filter-type').value,
        trigger: trigger,
        notify: document.getElementById('f-notify').checked,
        save: document.getElementById('f-save').checked
    };

    try {
        const method = editingFilterId ? 'PUT' : 'POST';
        const url = editingFilterId 
            ? `${API_BASE}/api/filters/${editingFilterId}` 
            : `${API_BASE}/api/filters/add`;

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            toggleFilterForm();
            loadUserFilters();
        } else {
            tg.showAlert("Ошибка сохранения");
        }
    } catch (e) { 
        console.error(e);
        tg.showAlert("Ошибка связи с сервером"); 
    }
}

async function deleteFilter(id) {
    if (!confirm("Удалить этот фильтр?")) return;
    try {
        await fetch(`${API_BASE}/api/filters/${id}?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}`, {
            method: 'DELETE'
        });
        loadUserFilters();
    } catch (e) { tg.showAlert("Ошибка при удалении"); }
}
