const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from project root (so it works no matter where node is started from)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// pg driver requires password to be a string (never undefined/null). Coerce it.
const rawPassword = process.env.DB_PASSWORD;
const password = rawPassword != null ? String(rawPassword) : '';

if (process.env.NODE_ENV !== 'production') {
    console.log('[DB] password type:', typeof password, '| length:', password.length);
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'moodlift',
    user: process.env.DB_USER || 'postgres',
    password: password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

// Initialize database with schema
const initDB = async () => {
    try {
        const schemaPath = path.join(__dirname, '..', 'models', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('Database schema initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error.message);
        throw error;
    }
};

module.exports = { pool, query, getClient, initDB };
