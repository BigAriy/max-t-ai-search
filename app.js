const tg = window.Telegram.WebApp;
const API_BASE = "https://your-backend-api.com"; // Замени на свой URL

tg.ready();
tg.expand();

// Инициализация профиля пользователя при входе
async function initUserProfile() {
    const initData = tg.initData;
    try {
        const response = await fetch(`${API_BASE}/api/user/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        const user = await response.json();
        document.getElementById('user-name').innerText = user.full_name || "Пользователь";
        loadUserSources();
    } catch (e) {
        console.error("Ошибка инициализации:", e);
    }
}

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

let currentPreview = null;

async function previewSource() {
    const url = document.getElementById('new-group-url').value;
    if (!url) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/sources/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData, url: url })
        });
        currentPreview = await response.json();
        
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
        await fetch(`${API_BASE}/api/sources/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initData: tg.initData,
                chat_id: currentPreview.chat_id,
                title: currentPreview.title,
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
                <input type="checkbox" class="source-check" value="${src.chat_id}">
                <div class="source-info">
                    <span class="source-title">${src.title}</span>
                    <span class="source-meta">${src.update_interval}</span>
                </div>
            `;
            list.appendChild(item);
        });
        document.getElementById('count-sources').innerText = sources.length;
    } catch (e) {
        console.error("Ошибка загрузки источников:", e);
    }
}


// Заглушка списка групп
const mockGroups = [
    { id: 1, title: "Агро-Клуб 🚜" },
    { id: 2, title: "Крипто-Чат 💰" },
    { id: 3, title: "Заметки о тракторах" }
];

const groupsList = document.getElementById('groups-list');
mockGroups.forEach(group => {
    const div = document.createElement('div');
    div.innerHTML = `
        <label>
            <input type="checkbox" value="${group.id}"> ${group.title}
        </label>
    `;
    groupsList.appendChild(div);
});

// Кнопка поиска
document.getElementById('search-btn').addEventListener('click', () => {
    // 1. Показываем визуально, что ищем
    document.getElementById('search-btn').innerText = "ИЩУ...";
    
    // 2. Имитируем запрос к бэкенду
    setTimeout(() => {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = ""; // Очищаем

        // Генерируем тестовый результат
        for(let i=0; i<3; i++) {
            const card = document.createElement('div');
            card.className = "message-card";
            card.innerHTML = `
                <div class="message-date">2024-05-20 14:30</div>
                <b>Петрович:</b>
                <p>Мы решили брать тот самый <i>сельскохозяйственный</i> плуг.</p>
            `;
            resultsContainer.appendChild(card);
        }

        // Переключаем гармошку на результат
        document.getElementById('action-section').classList.remove('active');
        document.getElementById('result-section').classList.add('active');
        document.getElementById('search-btn').innerText = "НАЙТИ";
        document.getElementById('result-count').innerText = "3";
        document.querySelector('.result-actions').style.display = "block";
    }, 1000);
});
