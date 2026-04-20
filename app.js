const tg = window.Telegram.WebApp;

// Сообщаем Telegram, что приложение готово
tg.ready();
tg.expand(); // Расширяем на весь экран

// Инициализация данных пользователя
document.getElementById('user-name').innerText = tg.initDataUnsafe.user?.first_name || "Пользователь";

// Логика работы гармошек
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const parent = header.parentElement;
        parent.classList.toggle('active');
    });
});

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