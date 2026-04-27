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

document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const parent = header.parentElement;
        parent.classList.toggle('active');
		    });
		});

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


