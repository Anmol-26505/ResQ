const mongoose = require('mongoose');
const path = require('path');

let mongoMemoryServer = null;

// Ensure mongodb-memory-server uses a local workspace directory
const localCacheDir = path.resolve(__dirname, '../../.mongo-bin');
process.env.MONGOMS_DOWNLOAD_DIR = localCacheDir;

/**
 * Connect to MongoDB Atlas or local MongoDB instance.
 * Automatically falls back to an embedded in-memory MongoDB in development
 * if no MONGODB_URI is provided.
 */
const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;

    if (!mongoUri || mongoUri.trim() === '') {
      console.log('ℹ️  No MONGODB_URI specified. Initializing embedded MongoDB server for local development...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create({
          binary: {
            downloadDir: localCacheDir,
          },
        });
        mongoUri = mongoMemoryServer.getUri();
        console.log(`✅ Embedded in-memory MongoDB initialized: ${mongoUri}`);
      } catch (err) {
        console.warn('⚠️ Could not start mongodb-memory-server, attempting default localhost:27017/resq:', err.message);
        mongoUri = 'mongodb://127.0.0.1:27017/resq';
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: true,
    });

    console.log(`✅ MongoDB Connected successfully to host: ${conn.connection.host} (DB: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // If external Atlas connection failed and we're in dev, try in-memory fallback
    if (!mongoMemoryServer && process.env.NODE_ENV !== 'production') {
      console.log('🔄 Attempting fallback to embedded in-memory MongoDB...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create({
          binary: {
            downloadDir: localCacheDir,
          },
        });
        const fallbackUri = mongoMemoryServer.getUri();
        const conn = await mongoose.connect(fallbackUri);
        console.log(`✅ Fallback in-memory MongoDB active: ${fallbackUri}`);
        return conn;
      } catch (innerErr) {
        console.error('❌ Fallback MongoDB connection failed:', innerErr.message);
      }
    }
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
    console.log('ℹ️ MongoDB disconnected gracefully.');
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error.message);
  }
};

module.exports = { connectDB, disconnectDB };
