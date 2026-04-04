// Importem la versió de promeses de 'fs' per no bloquejar l'Event Loop
const fs = require('fs').promises; 
const path = require('path');
const { MongoClient } = require('mongodb');
const xml2js = require('xml2js');
require('dotenv').config();

// Bona pràctica: Les constants globals s'escriuen en UPPER_SNAKE_CASE per distingir-les
const XML_FILE_PATH = path.join(__dirname, '../../data/youtubers.xml');

/**
 * Llegeix i analitza un fitxer XML de forma asíncrona.
 * @param {string} filePath - Ruta absoluta o relativa de l'arxiu XML.
 * @returns {Promise<Object>} Objecte JavaScript resultant de parsejar l'XML.
 */
async function parseXMLFile(filePath) {
  try {
    // 1. Llegim asíncronament en comptes del `fs.readFileSync` original
    const xmlData = await fs.readFile(filePath, 'utf-8');
    
    const parser = new xml2js.Parser({ 
      explicitArray: false,
      mergeAttrs: true
    });
    
    // 2. Simplificació: La llibreria xml2js té un mètode natiu que ja retorna una promesa
    return await parser.parseStringPromise(xmlData);
  } catch (error) {
    console.error(`Error llegint o analitzant el fitxer XML a ${filePath}:`, error);
    throw error;
  }
}

/**
 * Processa i transforma les dades parsejades del XML a l'esquema de MongoDB.
 * @param {Object} data - Dades crues obtingudes de xml2js.
 * @returns {Array<Object>} Llista de youtubers llista per a ser inserida.
 */
function processYoutuberData(data) {
  // 3. Validació de seguretat (optional chaining) per si l'XML ve buit
  if (!data?.youtubers?.youtuber) {
    return [];
  }

  const youtubers = Array.isArray(data.youtubers.youtuber) 
    ? data.youtubers.youtuber 
    : [data.youtubers.youtuber];
  
  return youtubers.map(youtuber => {
    // 4. Mapeig segur d'arrays amb fallbacks
    const rawCategories = youtuber.categories?.category || [];
    const categories = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
    
    const rawVideos = youtuber.videos?.video || [];
    const videos = Array.isArray(rawVideos) ? rawVideos : [rawVideos];
    
    const processedVideos = videos.map(video => ({
      videoId: video.id,
      title: video.title,
      duration: video.duration,
      // 5. Afegim base 10 (radix) als parseInt i un fallback per defecte a 0
      views: parseInt(video.views, 10) || 0,
      uploadDate: new Date(video.uploadDate),
      likes: parseInt(video.likes, 10) || 0,
      comments: parseInt(video.comments, 10) || 0
    }));
    
    return {
      youtuberId: youtuber.id,
      channel: youtuber.channel,
      name: youtuber.name, 
      subscribers: parseInt(youtuber.subscribers, 10) || 0,
      joinDate: new Date(youtuber.joinDate),
      categories: categories,
      videos: processedVideos
    };
  });
}

/**
 * Funció principal que coordina la càrrega de dades a MongoDB.
 */
async function loadDataToMongoDB() {
  // 7. Connexió a la base de dades. Idealment, mai posar credencials hardcoded en producció.
  const uri = process.env.MONGODB_URI || 'mongodb://root:password@localhost:27017/';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connectat correctament a MongoDB');
    
    const database = client.db('youtubers_db');
    const collection = database.collection('youtubers');
    
    console.log('📄 Llegint el fitxer XML...');
    const xmlData = await parseXMLFile(XML_FILE_PATH);
    
    console.log('⚙️ Processant les dades...');
    const youtubers = processYoutuberData(xmlData);
    
    if (youtubers.length === 0) {
      console.log('⚠️ No s\'han trobat dades vàlides per inserir.');
      return;
    }
    
    console.log('🗑️ Eliminant dades existents a la col·lecció (reset)...');
    await collection.deleteMany({});
    
    console.log('💾 Inserint noves dades a MongoDB...');
    const result = await collection.insertMany(youtubers);
    
    console.log(`🎉 ${result.insertedCount} documents inserits correctament!`);
    
  } catch (error) {
    console.error('❌ Error general carregant les dades a MongoDB:', error);
  } finally {
    await client.close();
    console.log('🔌 Connexió a MongoDB tancada');
  }
}

// 8. Bona pràctica: Només executar si l'arxiu es crida directament, per permetre ser testejar
if (require.main === module) {
  loadDataToMongoDB();
}