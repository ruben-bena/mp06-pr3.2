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
wss.on('connection', async (ws, request) => {

    let gameTimer = null; // Variable para controlar el setTimeout
    let gameActive = true; // Flag para no procesar más mensajes si la partida acabó
    const INACTIVITY_LIMIT = process.env.INACTIVITY_TIME_LIMIT_IN_MS;

    // Notificar cliente
    logger.info('Nuevo cliente conectado');
    ws.send(JSON.stringify({ foo: 'Conexión aceptada' }));

    // Identificador partida
    const gameId = crypto.randomUUID();
    logger.info(`Identificador de la partida: ${gameId}`);

    // Arrancar cliente MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect(); 
        logger.info('Conexión con MongoDB establecida');
    } catch (err) {
        logger.error('Error al conectar a MongoDB:', err);
    }
    const database = client.db('movements_db');
    const collection = database.collection('movements');

    // Cuando recibimos mensaje del cliente
    ws.on('message', async (data) => {
        // Si la partida ha acabado, ignoramos mensajes de cliente
        if (!gameActive) return;

        // Mensaje recibido
        const message = JSON.parse(data);
        logger.info(`Mensaje recibido: ${data}`);


        // --- LÓGICA DEL TIMER ---
        // 1. Limpiamos cualquier timer anterior (si el usuario se mueve, reiniciamos el contador)
        if (gameTimer) {
            clearTimeout(gameTimer);
            gameTimer = null;
            logger.info("Timer cancelado: el jugador sigue activo.");
        }
        // 2. Si recibimos 'NONE', iniciamos el timer
        if (message.direction === 'NONE') {
            logger.info(`Iniciando timer de inactividad (${INACTIVITY_LIMIT / 1000}s)...`);

            gameTimer = setTimeout(async () => {
                gameActive = false;
                logger.warn(`PARTIDA ACABADA: Inactividad detectada en la partida ${gameId}`);
                
                // Lógica para calcular distancia
                const distanciaTotal = await finalizarPartida(collection, gameId);
                ws.send(JSON.stringify({ event: 'FINISHED', distanciaTotal: distanciaTotal }));
                
                ws.send(JSON.stringify({ event: 'GAME_OVER', reason: 'timeout' }));
            }, INACTIVITY_LIMIT);
        }
        // ------------------------

        // Guardar mensaje en MongoDB
        const movementJson = {
            gameId: gameId,
            direction: message.direction,
            timestampClient: message.timestamp,
            timestampProcessed: Date.now()
        };
        console.log(movementJson.toString());
        const result = await collection.insertOne(movementJson);
        logger.info(`Documento insertado: ${result.insertedId}`);
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

async function finalizarPartida(collection, gameId) {
    logger.info(`Calculando resumen final para la partida: ${gameId}...`);
    
    let x = 0;
    let y = 0;
    const VELOCIDAD = process.env.SPEED_IN_METERS_PER_SECOND;

    try {
        // 1. Obtenemos todos los movimientos de esta partida ordenados por el tiempo del cliente
        const movimientos = await collection
            .find({ gameId: gameId })
            .sort({ timestampClient: 1 })
            .toArray();

        if (movimientos.length < 2) {
            logger.info("No hay suficientes movimientos para calcular desplazamiento.");
            return 0;
        }

        // 2. Iteramos para calcular el desplazamiento entre cada punto
        for (let i = 0; i < movimientos.length - 1; i++) {
            const actual = movimientos[i];
            const siguiente = movimientos[i + 1];

            // Calculamos el tiempo transcurrido en segundos
            const deltaTiempo = (siguiente.timestampClient - actual.timestampClient) / 1000; 
            const distancia = VELOCIDAD * deltaTiempo;

            // 3. Aplicamos el movimiento según la dirección del mensaje 'actual'
            switch (actual.direction) {
                case 'UP':
                    y += distancia;
                    break;
                case 'DOWN':
                    y -= distancia;
                    break;
                case 'LEFT':
                    x -= distancia;
                    break;
                case 'RIGHT':
                    x += distancia;
                    break;
                case 'NONE':
                    // No se mueve, no sumamos nada a x o y
                    break;
            }
        }

        logger.info(`Resultado final - Partida ${gameId}: X=${x.toFixed(2)}, Y=${y.toFixed(2)}`);

        // Calcular hipotenusa de triángulo rectángulo (teorema de pitágoras)
        const distanciaTotal = Math.sqrt(
            (x*x) + (y*y)
        );
        logger.info(`Resultado final - Partida ${gameId}: distanciaTotal=${distanciaTotal.toFixed(2)}`);
        return distanciaTotal

    } catch (err) {
        logger.error(`Error en finalizarPartida: ${err.message}`);
    }
}