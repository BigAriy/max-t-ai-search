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
            body: JSON.stringify({ initData: tg.initData, url: url })
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
                initData: tg.initData,
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
        console.log("--- FETCHING SOURCES ---");
        const url = `${API_BASE}/api/sources/list?initData=${encodeURIComponent(tg.initData)}&t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const sources = await response.json(); // ПОЛУЧАЕМ ДАННЫЕ
        console.log("Sources received from server:", sources);
        
        list.innerHTML = '';
        
        if (!Array.isArray(sources) || sources.length === 0) {
            list.innerHTML = '<div class="loading-overlay">Источников пока нет</div>';
            document.getElementById('source-status').innerText = "Выбрано: 0";
            return;
        }

        sources.forEach(src => {
            sourcesCache[src.chat_id] = src;
            
            const avatar = src.avatar_url ? `${API_BASE}${src.avatar_url}?v=${Date.now()}` : 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';
            const item = document.createElement('div');
            item.className = 'source-item';
            item.setAttribute('data-id', src.chat_id);
            item.style = "display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); transition: background 0.3s;";
            
            item.innerHTML = `
                <input type="checkbox" class="source-check" value="${src.chat_id}" onchange="updateToolButtons()" style="margin-right: 10px;">
                <div style="position: relative; margin-right: 12px;">
                    <img src="${avatar}" class="source-avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; display: block; background: #eee;">
                    <span class="msg-badge" style="position: absolute; bottom: -2px; right: -2px; background: var(--primary-color); color: white; font-size: 8px; padding: 2px 4px; border-radius: 4px; border: 2px solid var(--bg-color);">
                        ${src.msg_count}
                    </span>
                </div>
                <div class="source-info" style="flex-grow: 1; min-width: 0;">
                    <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${src.title}</div>
                    <div style="font-size: 10px; color: var(--hint-color);">
                        ${intervalLabel} • ${topicsLabel} <span class="sync-status-text" style="color:var(--primary-color); font-weight:bold;"></span>
                    </div>
                    <div class="sync-date" style="font-size: 9px; color: var(--hint-color); opacity: 0.8;">
                        Обновлено: ${src.last_sync}
                    </div>
                </div>
                <div class="source-actions" style="display: flex; gap: 4px;">
                    <button onclick="tg.openLink('https://t.me/${src.username || 'c/'+src.chat_id}')" style="background:none; border:none; padding:8px; font-size: 16px;">🔗</button>
                    <button onclick="showSourceInfo('${src.chat_id}')" style="background:none; border:none; padding:8px; font-size: 16px;">❓</button>
                </div>
            `;
            list.appendChild(item);
        });
        document.getElementById('source-status').innerText = "Всего: " + sources.length;
        updateToolButtons();
    } catch (e) {
        console.error("Critical error loading sources:", e);
        list.innerHTML = '<div class="loading-overlay" style="color:red">Ошибка загрузки данных</div>';
    }
}


// Кнопка поиска
let lastResults = [];

document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-query').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const selectedChats = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);

    if (selectedChats.length === 0) return tg.showAlert("Выберите хотя бы один источник в шаге 1");

    document.getElementById('search-btn').innerText = "ПОИСК...";
    try {
        const url = `${API_BASE}/api/messages/search?initData=${encodeURIComponent(tg.initData)}&query=${encodeURIComponent(query)}&chat_ids=${selectedChats.join(',')}&d_from=${dateFrom}&d_to=${dateTo}`;
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
    WebSocketClient.on('sync_start', (data) => {
        const item = document.querySelector(`.source-item[data-id="${data.chat_id}"]`);
        if (item) {
            item.classList.add('is-syncing');
            const statusLabel = item.querySelector('.sync-status-text');
            if (statusLabel) statusLabel.innerText = "Обновление...";
        }
    });

    WebSocketClient.on('sync_end', (data) => {
        const item = document.querySelector(`.source-item[data-id="${data.chat_id}"]`);
        if (item) {
            item.classList.remove('is-syncing');
            // Обновляем счетчик сообщений
            const badge = item.querySelector('.msg-badge');
            if (badge) badge.innerText = data.msg_count;
            // Обновляем дату
            const dateLabel = item.querySelector('.sync-date');
            if (dateLabel) dateLabel.innerText = `Обновлено: ${data.last_sync}`;
        }
    });
}


