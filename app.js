const tg = window.Telegram.WebApp;
const API_BASE = "https://search.sigmaboy.us";

const i18n = {
    "daily": "Ежедневно",
    "hourly": "Ежечасно",
    "realtime": "В реальном времени",
    "never": "Никогда",
    "total_msgs": "сообщ.",
    "topics_all": "Все разделы",
    "topics_sel": "Разделов: "
};

tg.ready();
tg.expand();

let currentPreview = null;
let userProfile = null;
let sourcesCache = {}; // Глобальный кэш для хранения описаний
// Глобальная переменная для ID пользователя (резервный вход)
let globalUserId = new URLSearchParams(window.location.search).get('user_id');

async function initUserProfile() {
    const initData = tg.initData;
    console.log("Starting init request to:", `${API_BASE}/api/user/init`);
    
    try {
        const response = await fetch(`${API_BASE}/api/user/init?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        
        if (!response.ok) throw new Error("Auth failed");
        
        userProfile = await response.json();
        document.getElementById('user-name').innerText = userProfile.full_name;
        console.log("Profile loaded:", userProfile);
        
        // Запускаем WebSocket соединение
        WebSocketClient.connect(userProfile.id, API_BASE);
        setupWebSocketHandlers();

        loadUserSources();
    } catch (e) {
        console.error("Critical init error:", e);
        document.getElementById('user-name').innerText = "Ошибка входа";
    }
}

// Показ данных профиля (Личный кабинет)
document.getElementById('settings-btn').addEventListener('click', () => {
    if (!userProfile) return tg.showAlert("Данные профиля еще не загружены");
    
    const info = `
👤 Профиль: ${userProfile.full_name}
🆔 ID: ${userProfile.id}
🌍 Язык: ${userProfile.lang}
📅 Регистрация: ${userProfile.created_at}
    `;
    tg.showAlert(info);
});

initUserProfile();





// Логика работы гармошек
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const parent = header.parentElement;
        parent.classList.toggle('active');
		    });
		});

function toggleAddForm() {
    const form = document.getElementById('add-source-form');
    const btn = document.getElementById('add-group-btn');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    btn.style.display = isHidden ? 'none' : 'block';
}



async function previewSource() {
    const urlInput = document.getElementById('new-group-url');
    const saveBtn = document.querySelector('#add-source-form .btn-primary');
    const url = urlInput.value.trim();
    if (!url) return;
    
    // Блокируем ввод и кнопку
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
        saveBtn.disabled = false;
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


// Кнопка поиска
let lastResults = [];

document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-query').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const selectedChats = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    const selectedTopics = Array.from(document.querySelectorAll('.topic-check:checked')).map(el => el.value);

    if (selectedChats.length === 0 && selectedTopics.length === 0) {
        return tg.showAlert("Выберите источники или разделы для поиска");
    }

    document.getElementById('search-btn').innerText = "ПОИСК...";
    try {
        let url = `${API_BASE}/api/messages/search?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&query=${encodeURIComponent(query)}&d_from=${dateFrom}&d_to=${dateTo}`;
        
        if (selectedChats.length > 0) url += `&chat_ids=${selectedChats.join(',')}`;
        if (selectedTopics.length > 0) url += `&topic_ids=${selectedTopics.join(',')}`;

        const response = await fetch(url);
        lastResults = await response.json();
        
        renderResults(lastResults);
        
        // Авто-переключение гармошек
        document.getElementById('action-section').classList.remove('active');
        document.getElementById('result-section').classList.add('active');
    } catch (e) {
        tg.showAlert("Ошибка при поиске");
    }
    document.getElementById('search-btn').innerText = "НАЙТИ";
});

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
