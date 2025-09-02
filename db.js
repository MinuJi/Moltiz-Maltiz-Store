// db.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || '127.0.0.1',
  port:     Number(process.env.MYSQL_PORT || 3306),
  user:     process.env.MYSQL_USER     || 'moltiz',
  password: process.env.MYSQL_PASSWORD || 'moltiz_pw',
  database: process.env.MYSQL_DATABASE || 'moltiz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  multipleStatements: false,
});

module.exports = pool;


