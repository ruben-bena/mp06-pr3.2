const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const winston = require('winston');
const crypto = require('crypto');
require('dotenv').config();

// Logger que utilizaremos para imprimir por pantalla y volcar en fichero log
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './data/logs/server.log' })
    ],
});

// WebSockets Server
const wss = new WebSocket.Server({ port: process.env.SERVER_PORT });
logger.debug('Servidor arrancado')
wss.on('connection', (ws, request) => {
    logger.info('Nuevo cliente conectado');
    ws.send(JSON.stringify({ foo: 'Conexión aceptada' }));
    const gameId = crypto.randomUUID();
    logger.info(`Identificador de la partida: ${uuid}`);

    // Cuando recibimos mensaje del cliente
    ws.on('message', (data) => {
        // Mensaje recibido
        const message = JSON.parse(data);
        logger.info(`Mensaje recibido: ${data}`);
    });

    // Cuando cliente cierra conexión
    ws.on('close', () => {
        // Cliente desconectado
        logger.info('Conexión cerrada con cliente');
    });

    // Cuando hay error de conexión con cliente
    ws.on('error', (err) => {
        // Error en la conexión
        logger.error(`Error en la conexión con cliente: ${err}`);
    });
});