const tg = window.Telegram.WebApp;
const API_BASE = "https://search.sigmaboy.us";

tg.ready();
tg.expand();

let currentPreview = null;
let userProfile = null;

async function initUserProfile() {
    const initData = tg.initData;
    console.log("Starting init request to:", `${API_BASE}/api/user/init`);
    
    try {
        const response = await fetch(`${API_BASE}/api/user/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        
        if (!response.ok) throw new Error("Auth failed");
        
        userProfile = await response.json();
        document.getElementById('user-name').innerText = userProfile.full_name;
        console.log("Profile loaded:", userProfile);
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
    const url = document.getElementById('new-group-url').value;
    if (!url) return;
    
    console.log("Attempting preview for:", url);
    console.log("API_BASE is:", API_BASE);
    
    try {
        const response = await fetch(`${API_BASE}/api/sources/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData, url: url })
        });
        
        console.log("Response status:", response.status);
        currentPreview = await response.json();
        console.log("Received preview data:", currentPreview);
        
        const topicsDiv = document.getElementById('topics-select');
        topicsDiv.innerHTML = '';
        if (currentPreview.is_forum && currentPreview.topics.length > 0) {
            topicsDiv.innerHTML = '<p>Выберите разделы:</p>';
            currentPreview.topics.forEach(t => {
                topicsDiv.innerHTML += `
                    <label><input type="checkbox" name="topic-id" value="${t.id}" checked> ${t.title}</label><br>
                `;
            });
            topicsDiv.style.display = 'block';
            document.getElementById('all-topics-row').style.display = 'none';
        } else {
            topicsDiv.style.display = 'none';
            document.getElementById('all-topics-row').style.display = 'block';
        }
    } catch (e) {
        tg.showAlert("Группа не найдена");
    }
}

async function submitNewSource() {
    if (!currentPreview) return;

    const freq = document.getElementById('update-freq').value;
    const selectedTopics = Array.from(document.querySelectorAll('input[name="topic-id"]:checked')).map(el => parseInt(el.value));
    const allTopics = document.getElementById('all-topics').checked;

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
                topic_ids: (currentPreview.is_forum && !allTopics) ? selectedTopics : null
            })
        });
        toggleAddForm();
        loadUserSources();
    } catch (e) {
        tg.showAlert("Ошибка при сохранении");
    }
    tg.MainButton.hideProgress();
}

async function loadUserSources() {
    try {
        const response = await fetch(`${API_BASE}/api/sources/list?initData=${encodeURIComponent(tg.initData)}`);
        const sources = await response.json();
        const list = document.getElementById('groups-list');
        list.innerHTML = '';
        sources.forEach(src => {
            const item = document.createElement('div');
            item.className = 'source-item';
            item.innerHTML = `
                <label>
                    <input type="checkbox" class="source-check" value="${src.chat_id}">
                    <div class="source-info" style="display:inline-block; vertical-align: middle; margin-left: 10px;">
                        <span class="source-title">${src.title}</span>
                        <span class="source-meta" style="font-size: 10px; color: var(--hint-color); display: block;">${src.update_interval}</span>
                    </div>
                </label>
            `;
            list.appendChild(item);
        });
        document.getElementById('source-status').innerText = "Всего: " + sources.length;
    } catch (e) {
        console.error("Ошибка загрузки источников:", e);
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
