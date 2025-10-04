const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Admin@123",
  database: "authdb",
});

db.connect((err) => {
  if (err) {
    console.error("Connection failed", err);
  } else {
    console.log("Mysql connected");
  }
});

module.exports = db;
