const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../config/db");
const PORT = process.env.PORT || 8000;

//signup
exports.signup = (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: "Hashing failed" });

    db.query(
      "INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword],
      (err, result) => {
        if (err) return res.status(400).json({ error: "Email already exists" });
        res.json({ message: "User registered successfully" });
      }
    );
  });
};

//login
exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = results[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (!match) return res.status(400).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({ message: "Login successful", token });
    });
  });
};

exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ error: "User not found" });

      const user = results[0];
      const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "5m",
      });
      const expiry = new Date(Date.now() + 5 * 60000);

      db.query("UPDATE users SET resetToken=?, resetTokenExpiry=? WHERE id=?", [
        resetToken,
        expiry,
        user.id,
      ]);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const resetURL = `http://localhost:${PORT}/api/auth/reset-password/${resetToken}`;
      await transporter.sendMail({
        to: user.email,
        subject: "Password Reset",
        html: `<a href="${resetURL}">Reset your password</a>`,
      });

      res.json({ message: "Password reset email sent" });
    }
  );
};

exports.resetPassword = (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.query(
      "SELECT * FROM users WHERE id=? AND resetToken=? AND resetTokenExpiry > NOW()",
      [decoded.id, token],
      (err, results) => {
        if (err || results.length === 0)
          return res.status(400).json({ error: "Invalid or expired token" });

        bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
          if (err) return res.status(500).json({ error: "Hashing failed" });

          db.query(
            "UPDATE users SET password=?, resetToken=NULL, resetTokenExpiry=NULL WHERE id=?",
            [hashedPassword, decoded.id]
          );

          res.json({ message: "Password reset successful" });
        });
      }
    );
  } catch (err) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
};

exports.getUser = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query(
      "SELECT id, firstName, lastName, email FROM users WHERE id=?",
      [decoded.id],
      (err, results) => {
        if (err || results.length === 0)
          return res.status(404).json({ error: "User not found" });
        res.json(results[0]);
      }
    );
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
