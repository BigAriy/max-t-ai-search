


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


async function performSearch(isLoadMore = false) {
    const query = document.getElementById('search-query').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const selectedChats = Array.from(document.querySelectorAll('.source-check:checked')).map(el => el.value);
    const selectedTopics = Array.from(document.querySelectorAll('.topic-check:checked')).map(el => el.value);
    const searchObj = document.querySelector('input[name="s-obj"]:checked').value;

    if (selectedChats.length === 0 && selectedTopics.length === 0) {
        return tg.showAlert("Выберите источники или разделы для поиска");
    }

    if (!isLoadMore) {
        currentSearchOffset = 0;
        lastResults = [];
    }

    const actionBtn = document.getElementById('main-action-btn');
    const originalBtnText = actionBtn.innerText;
    actionBtn.innerText = isLoadMore ? "ЗАГРУЗКА..." : "ПОИСК...";
    try {
        let url = `${API_BASE}/api/messages/search?initData=${encodeURIComponent(tg.initData || "")}&user_id=${globalUserId || ""}&query=${encodeURIComponent(query)}&d_from=${dateFrom}&d_to=${dateTo}&offset=${currentSearchOffset}&search_obj=${searchObj}`;
        
        if (selectedChats.length > 0) url += `&chat_ids=${selectedChats.join(',')}`;
        if (selectedTopics.length > 0) url += `&topic_ids=${selectedTopics.join(',')}`;

        const response = await fetch(url);
        const newBatch = await response.json();
        
        lastResults = [...lastResults, ...newBatch];
        currentSearchOffset += newBatch.length;
        
        // Сохраняем результаты в сессию браузера
        sessionStorage.setItem('last_search_results', JSON.stringify(lastResults));

        renderResults(lastResults);
        
        // Авто-переключение гармошек
        document.getElementById('action-section').classList.remove('active');
        document.getElementById('result-section').classList.add('active');
    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка при поиске");
    }
    actionBtn.innerText = originalBtnText;
}


