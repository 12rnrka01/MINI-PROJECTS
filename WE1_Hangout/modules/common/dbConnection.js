const { MongoClient } = require('mongodb');

let db;
let client;

module.exports = {
    async connect() {
        try {
            // Simple in-memory storage for now (no MongoDB required)
            console.log('📁 Using in-memory storage (no database needed for now)');
            
            // If you want to use MongoDB later, uncomment this:
            /*
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            db = client.db();
            console.log('✅ Connected to MongoDB');
            */
        } catch (error) {
            console.error('❌ Database connection failed:', error);
        }
    },

    getDb() {
        return db;
    },

    async close() {
        if (client) {
            await client.close();
            console.log('🔒 Database connection closed');
        }
    }
};