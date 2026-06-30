const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.get('/', (req, res) => {
  res.send('Hello World from backend!');
});

app.get('/api/hello', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS db_time');
    res.json({
      message: 'Hello World!',
      db_time: result.rows[0].db_time,
      pod: process.env.HOSTNAME || 'unknown',
    });
  } catch (err) {
    console.error('DB query failed:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
