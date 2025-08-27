// db.js (MySQL + mysql2/promise)
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     Number(process.env.MYSQL_PORT || 3306),
  user:     process.env.MYSQL_USER     || 'moltiz',
  password: process.env.MYSQL_PASSWORD || 'moltiz_pw',
  database: process.env.MYSQL_DATABASE || 'moltiz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,          // DATETIME을 문자열로
  multipleStatements: false,
});

module.exports = pool;        // ★ 풀 자체 export (중요)