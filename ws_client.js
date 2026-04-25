// Модуль для работы с WebSocket
const WebSocketClient = {
    socket: null,
    listeners: {},

    connect(userId, baseUrl) {
        // Преобразуем https в wss или http в ws
        const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
        const wsUrl = `${baseUrl.replace(/^https?:\/\//, wsProtocol + '://')}/ws/${userId}`;
        
        console.log(`🔌 Connecting to WS: ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("📥 WS Message:", data);
            if (this.listeners[data.type]) {
                this.listeners[data.type].forEach(callback => callback(data));
            }
        };

        this.socket.onclose = () => {
            console.log("🔌 WS Disconnected. Reconnecting in 5s...");
            setTimeout(() => this.connect(userId, baseUrl), 5000);
        };
    },

    on(type, callback) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(callback);
    }
};
