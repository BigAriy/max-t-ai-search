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

let userFilters = []; // Список активных фильтров пользователя
let editingFilterId = null; // ID редактируемого фильтра (null = создание)
let lastResults = []; // Глобальное хранилище результатов поиска
