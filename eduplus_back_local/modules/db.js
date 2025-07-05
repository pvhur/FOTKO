const sqlite3 = require("sqlite3").verbose();

module.exports = (callback) => {
  const db = new sqlite3.Database("./database.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error("Database connection error:", err.message);
      callback(err, null);
    } else {
      callback(null, db);
    }
  });
};
