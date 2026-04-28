


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

async function performSearch() {
    const query = document.getElementById('search-query').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const selectedChats = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    const selectedTopics = Array.from(document.querySelectorAll('.topic-check:checked')).map(el => el.value);

    if (selectedChats.length === 0 && selectedTopics.length === 0) {
        return tg.showAlert("Выберите источники или разделы для поиска");
    }

    const actionBtn = document.getElementById('main-action-btn');
    actionBtn.innerText = "ПОИСК...";
    try {
        let url = `${API_BASE}/api/messages/search?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&query=${encodeURIComponent(query)}&d_from=${dateFrom}&d_to=${dateTo}`;
        
        if (selectedChats.length > 0) url += `&chat_ids=${selectedChats.join(',')}`;
        if (selectedTopics.length > 0) url += `&topic_ids=${selectedTopics.join(',')}`;

        const response = await fetch(url);
        lastResults = await response.json();
        
        // Сохраняем результаты в сессию браузера
        sessionStorage.setItem('last_search_results', JSON.stringify(lastResults));

        renderResults(lastResults);
        
        // Авто-переключение гармошек
        document.getElementById('action-section').classList.remove('active');
        document.getElementById('result-section').classList.add('active');
    } catch (e) {
        tg.showAlert("Ошибка при поиске");
    }
    actionBtn.innerText = "НАЙТИ";
}


