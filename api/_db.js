// api/_db.js — Shared MongoDB Connection (reused across all API functions)
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI environment variable is not set!');

let client = null;

async function getDb() {
    if (!client || !client.topology || !client.topology.isConnected()) {
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        await client.connect();
        console.log("Connected to MongoDB");
    }
    return client.db('educore');
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { getDb, setCors };
