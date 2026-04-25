const tg = window.Telegram.WebApp;
const API_BASE = "https://search.sigmaboy.us";

// Сообщаем Telegram, что мы готовы
tg.ready();
tg.expand();

const i18n = {
    "daily": "Ежедневно",
    "hourly": "Ежечасно",
    "realtime": "В реальном времени",
    "never": "Никогда",
    "total_msgs": "сообщ.",
    "topics_all": "Все разделы",
    "topics_sel": "Разделов: "
};

let currentPreview = null;
let userProfile = null;
let sourcesCache = {}; 

async function initUserProfile() {
    // Если initData пустое, пробуем подождать 200мс (защита от медленного старта)
    if (!tg.initData) {
        console.log("⏳ initData is empty, retrying in 200ms...");
        setTimeout(initUserProfile, 200);
        return;
    }

    console.log("Starting init request, length:", tg.initData.length);
    
    try {
        const response = await fetch(`${API_BASE}/api/user/init?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
