const WebSocket = require('ws');
require('dotenv').config();

// Crear conexión
const ws = new WebSocket(process.env.SERVER_URI);

// Conexión abierta
ws.on('open', () => {
    console.log('Conexión con el servidor exitosa');

    // Enviar mensaje inicial para mantener el loop activo
    ws.send(JSON.stringify({ hello: 'world' }));
});

// Recibir mensajes
ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('Mensaje del servidor:', message);
    } catch (err) {
        console.log('Mensaje del servidor (raw):', data.toString());
    }
});

// Detectar cierre de conexión
ws.on('close', () => {
    console.log('Conexión cerrada');
});

// Detectar errores
ws.on('error', (err) => {
    console.error('Error en la conexión:', err);
});