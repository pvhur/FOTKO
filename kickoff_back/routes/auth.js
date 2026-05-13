const express = require("express");
const router = express.Router();
const dbConnect = require("../modules/db");
const { sendemail } = require("../modules/email");
const { hashPassword, verifyPassword } = require("../modules/hash");
const { v4: uuidv4 } = require('uuid'); // UUID 모듈
const authenticateSession = require("../modules/authSession");
let email_check_wow = {};
let pk_check_wow = {};
const crypto = require('crypto');
const secret = 'dskhdfkmawowlle'; // 서버에서만 아는 값
router.post("/login", (req, res) => {
  const { email, id, password: pw } = req.body;//@ : email
  if (!(email || id) || !pw) {
    return res.status(400).send({ success: false, message: "Invalid input", status: 400 });
  }
  if (id) {
    dbConnect((err, db) => {
      if (err) {
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }

      const query = "SELECT * FROM Users WHERE id = ?";
      db.get(query, [id], async (err, row) => {
        if (err) {
          db.close();
          return res.status(500).send({ success: false, message: "Database Error", status: 500 });
        }
        if (!row) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }

        // 비밀번호 검증 (argon2.verify)
        const isMatch = await verifyPassword(pw, row.pw);
        if (!isMatch) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }

        // 로그인 성공 -> 세션 저장
        req.session.user = { id: row.session_id };

        db.close();
        return res.status(200).send({ success: true, message: "Login successful", status: 200 });
      });
    });
  } else {
    dbConnect((err, db) => {
      if (err) {
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }

      const query = "SELECT * FROM Users WHERE email = ?";
      db.get(query, [email], async (err, row) => {
        if (err) {
          db.close();
          return res.status(500).send({ success: false, message: "Database Error", status: 500 });
        }
        if (!row) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }

        if (!Number(row.email_check)) {
          db.close();
          return res.status(401).send({ success: false, message: "Can be used after email verification", status: 401 });
        }

        // 비밀번호 검증 (argon2.verify)
        const isMatch = await verifyPassword(pw, row.pw);
        if (!isMatch) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }

        // 로그인 성공 -> 세션 저장
        req.session.user = { id: row.session_id };

        db.close();
        return res.status(200).send({ success: true, message: "Login successful", status: 200 });
      });
    });
  }
});

router.post("/findpassword", (req, res) => {
  const { email, id } = req.body;//@ : email
  if (!(email || id)) {
    return res.status(400).send({ success: false, message: "Invalid input", status: 400 });
  }
  if (email) {
    dbConnect((err, db) => {
      if (err) {
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }

      const query = "SELECT * FROM Users WHERE email = ?";
      db.get(query, [email], async (err, row) => {
        if (err) {
          db.close();
          return res.status(500).send({ success: false, message: "Database Error", status: 500 });
        }
        if (!row) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }
        if (!Number(row.email_check)) {
          db.close();
          return res.status(401).send({ success: false, message: "You have not verified your email address", status: 401 });
        }

        const pw_change_uuid = uuidv4(); // UUID 생성
        const fpw = findpw(pw_change_uuid);
        
        // 임시 세션 UUID를 데이터베이스에 저장
        const updateQuery = "UPDATE Users SET temporary_session = ? WHERE email = ?";
        await new Promise((resolve, reject) => {
          db.run(updateQuery, [pw_change_uuid, email], (updateErr) => {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });

        try {
          const emailResult = await sendemail("forgotpassword", row.name, row.email, fpw);
          if (!emailResult) {
            db.close();
            return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
          }
          db.close();
          return res.status(200).send({ success: true, message: "email send successful", status: 200 });
        } catch (error) {
          console.error("Email sending error:", error);
          db.close();
          return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
        }
      });
    });
  } else {
    dbConnect((err, db) => {
      if (err) {
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }

      const query = "SELECT * FROM Users WHERE id = ?";
      db.get(query, [id], async (err, row) => {
        if (err) {
          db.close();
          return res.status(500).send({ success: false, message: "Database Error", status: 500 });
        }
        if (!row) {
          db.close();
          return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
        }
        if (!row.email) {
          db.close();
          return res.status(401).send({ success: false, message: "Email is not registered", status: 401 });
        }
        if (!Number(row.email_check)) {
          db.close();
          return res.status(401).send({ success: false, message: "You have not verified your email address", status: 401 });
        }
        const pw_change_uuid = uuidv4(); // UUID 생성
        const fpw = findpw(pw_change_uuid);
        
        // 임시 세션 UUID를 데이터베이스에 저장
        const updateQuery = "UPDATE Users SET temporary_session = ? WHERE id = ?";
        await new Promise((resolve, reject) => {
          db.run(updateQuery, [pw_change_uuid, id], (updateErr) => {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });

        try {
          const emailResult = await sendemail("forgotpassword", row.name, row.email, fpw);
          if (!emailResult) {
            db.close();
            return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
          }
          db.close();
          return res.status(200).send({ success: true, message: "email send successful", status: 200 });
        } catch (error) {
          console.error("Email sending error:", error);
          db.close();
          return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
        }
      });
    });
  }
});

router.post("/findpassword_check", (req, res) => {
  const { code } = req.body;//@ : email
  if (!code) {
    return res.status(400).send({ success: false, message: "Invalid input", status: 400 });
  }
  if (pk_check_wow[code] && pk_check_wow[code].check) {
    req.session.user = { temporary_id:  pk_check_wow[code].session_id };
    pk_check_wow[code].check = false;
    return res.status(200).send({ success: true, message: "code verified", status: 200 });
  } else {
    return res.status(401).send({ success: false, message: "code not found", status: 401 });
  }
})

router.post("/findpassword_change", authenticateSession, (req, res) => {
  const { password } = req.body;//@ : email
  if (!password) {
    return res.status(400).send({ success: false, message: "Invalid input", status: 400 });
  }
  const user_id = req.session.user.temporary_id;
  dbConnect((err, db) => {
    if (err) {
      return res.status(500).send({ success: false, message: "Database Error", status: 500 });
    }

    const query = "SELECT * FROM Users WHERE temporary_session = ?";
    db.get(query, [user_id], async (err, row) => {
      if (err) {
        db.close();
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }
      if (!row) {
        db.close();
        return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
      }

      try {
        // 새로운 비밀번호 해싱
        const hashedPassword = await hashPassword(password);
        
        // 비밀번호 업데이트 및 임시 세션 삭제
        const updateQuery = "UPDATE Users SET pw = ?, temporary_session = NULL WHERE temporary_session = ?";
        await new Promise((resolve, reject) => {
          db.run(updateQuery, [hashedPassword, user_id], (updateErr) => {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });

        db.close();
        return res.status(200).send({ success: true, message: "Password changed successfully", status: 200 });
      } catch (error) {
        console.error("Password change error:", error);
        db.close();
        return res.status(500).send({ success: false, message: "Failed to change password", status: 500 });
      }
    });
  });
})

function findpw(user_id) {
  const numbers = [];
  for (let i = 0; i < 6; i++) {
    const num = Math.floor(Math.random() * 10);
    numbers.push(num);
  }
  pk_check_wow[numbers.join("")] = { check: true, session_id: user_id };
  // 5분 후 UUID 삭제
  setTimeout(() => {
    delete pk_check_wow[numbers.join("")]; // 객체에서 삭제하여 메모리에서 제
  }, 300000); // 300000ms = 5 minutes
  return numbers.join("");
}


router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send({ message: "Failed to logout", status: 500 });
    }

    res.clearCookie("connect.sid");

    res.status(200).send({ message: "Logged out successfully", status: 200 });
  });
});

router.get("/get_session", async (req, res) => {
  if (!req.session.user) {
    return res.status(200).send({
      success: true,
      isLoggedIn: false
    });
  }
  // DB에서 사용자 이름 조회
  const db = require('../modules/db');
  let name = null;
  try {
    const userRow = await db.get('SELECT name FROM users WHERE id = ?', [req.session.user.id]);
    if (userRow) name = userRow.name;
  } catch (e) {
    name = null;
  }
  res.status(200).send({
    success: true,
    isLoggedIn: true,
    name: name
  });
  return;
});

router.get("/email_check", (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).send({ success: false, message: "Invalid input", status: 400 });
  }
  if (email_check_wow[key] && email_check_wow[key].check) {
    // 이메일 인증 성공 시 DB 업데이트
    dbConnect((err, db) => {
      if (err) {
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }

      const query = "UPDATE Users SET email_check = true WHERE session_id = ?";
      db.run(query, [email_check_wow[key].session_id], (err) => {
        db.close();
        if (err) {
          return res.status(500).send({ success: false, message: "Database Error", status: 500 });
        }
        email_check_wow[key].check = false;
        res.status(200).send({ success: true, message: "Email check passed", status: 200 });
      });
    });
  } else {
    return res.status(404).send({ success: false, message: "Email check not found", status: 404 });
  }
});

router.post("/email_check", authenticateSession, (req, res) => {
  const user_id = req.session.user.id;
  dbConnect((err, db) => {
    if (err) {
      return res.status(500).send({ success: false, message: "Database Error", status: 500 });
    }

    const query = "SELECT * FROM Users WHERE session_id = ?";
    db.get(query, [user_id], async (err, row) => {
      if (err) {
        db.close();
        return res.status(500).send({ success: false, message: "Database Error", status: 500 });
      }
      if (!row) {
        db.close();
        return res.status(401).send({ success: false, message: "Invalid credentials", status: 401 });
      }
      if (row.email == null || row.email == undefined) {
        db.close();
        return res.status(400).send({ success: false, message: "Please register your email first" });
      }
      if (Number(row.email_check)) {
        db.close();
        return res.status(400).send({ success: false, message: "Already verified" });
      }
      const email_check_uuid = uuidv4(); // UUID 생성
      const email_check_final = crypto.createHmac('sha256', secret).update(email_check_uuid).digest('hex');
      email_check(user_id, email_check_final);

      try {
        const emailResult = await sendemail("emailcheck", row.name, row.email, email_check_final);
        if (!emailResult) {
          db.close();
          return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
        }
        db.close();
        return res.status(200).send({ success: true, message: "email send successful", status: 200 });
      } catch (error) {
        console.error("Email sending error:", error);
        db.close();
        return res.status(500).send({ success: false, message: "Failed to send email", status: 500 });
      }
    });
  });
});

function email_check(user_id, uuid) {
  email_check_wow[uuid] = { check: true, session_id: user_id };
  // 10분 후 UUID 삭제
  setTimeout(() => {
    delete email_check_wow[uuid]; // 객체에서 삭제하여 메모리에서 제
  }, 600000); // 600000ms = 10 minutes

  return true; // 반환된 UUID는 이메일 인증 링크에 포함될 수 있음
}

/**
 * 회원가입
 * @body {string} name - 유저의 이름
 * @body {string} id - 유저가 사용할 로그인 아이디
 * @body {string} email - 유저가 사용하는 이메일
 * @body {string} password - 유저가 사용할 비밀번호
 */
router.post("/signup", async (req, res) => {
  const { email, name, id, password } = req.body;

  // 필수값 체크
  if (!name || !id || !password) {
    return res.status(400).send({
      success: false,
      message: "Invalid input",
      status: 400,
    });
  }

  dbConnect(async (err, db) => {
    if (err) {
      return res.status(500).send({
        success: false,
        message: "Database Error",
        status: 500,
      });
    }

    try {
      // 1) 이미 같은 아이디가 있는지 확인
      const checkQuery = "SELECT * FROM Users WHERE id = ?";
      const row = await new Promise((resolve, reject) => {
        db.get(checkQuery, [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (row) {
        db.close();
        return res.status(409).send({
          success: false,
          message: "ID already exists",
          status: 409,
        });
      }

      // 2) 중복이 아니면 회원가입 진행
      const session_id = uuidv4(); // UUID 생성
      const hashedPw = await hashPassword(password); // 비밀번호 해싱 (await 필수)
      if (email) {
        const insertQuery = `
        INSERT INTO Users (session_id, name, id, email, pw, email_check)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

        await new Promise((resolve, reject) => {
          db.run(insertQuery, [session_id, name, id, email, hashedPw, false], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      } else {
        const insertQuery = `
        INSERT INTO Users (session_id, name, id, pw)
        VALUES (?, ?, ?, ?)
      `;

        await new Promise((resolve, reject) => {
          db.run(insertQuery, [session_id, name, id, hashedPw], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      }
      // 로그인 성공 -> 세션 저장
      req.session.user = { id: session_id };
      db.close();
      return res.status(201).send({
        success: true,
        message: "User created",
        status: 201,
      });

    } catch (error) {
      console.error("Signin Error:", error);
      db.close();
      return res.status(500).send({
        success: false,
        message: "Database Error",
        status: 500,
      });
    }
  });
});

router.post("/profile_info_change", authenticateSession, async (req, res) => {
  const { email, name, id, password } = req.body;
  const user_id = req.session.user.id;

  if (!email && !name && !id && !password) {
    return res.status(400).send({ success: false, message: "No changes provided", status: 400 });
  }

  dbConnect(async (err, db) => {
    if (err) {
      return res.status(500).send({ success: false, message: "Database Error", status: 500 });
    }

    try {
      // 현재 사용자 정보 조회
      const currentUserQuery = "SELECT * FROM Users WHERE session_id = ?";
      const currentUser = await new Promise((resolve, reject) => {
        db.get(currentUserQuery, [user_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!currentUser) {
        db.close();
        return res.status(401).send({ success: false, message: "User not found", status: 401 });
      }

      // ID 변경 시 중복 체크
      if (id && id !== currentUser.id) {
        const checkIdQuery = "SELECT * FROM Users WHERE id = ?";
        const existingUser = await new Promise((resolve, reject) => {
          db.get(checkIdQuery, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (existingUser) {
          db.close();
          return res.status(409).send({ success: false, message: "ID already exists", status: 409 });
        }
      }

      // 이메일 변경 시 중복 체크 및 인증 상태 초기화
      if (email && email !== currentUser.email) {
        const checkEmailQuery = "SELECT * FROM Users WHERE email = ?";
        const existingEmail = await new Promise((resolve, reject) => {
          db.get(checkEmailQuery, [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (existingEmail) {
          db.close();
          return res.status(409).send({ success: false, message: "Email already exists", status: 409 });
        }
      }

      // 업데이트할 필드와 값 준비
      const updates = [];
      const values = [];

      if (email) {
        updates.push("email = ?");
        values.push(email);
        updates.push("email_check = ?");
        values.push(false); // 이메일 변경 시 인증 상태 초기화
      }

      if (name) {
        updates.push("name = ?");
        values.push(name);
      }

      if (id) {
        updates.push("id = ?");
        values.push(id);
      }

      if (password) {
        const hashedPassword = await hashPassword(password);
        updates.push("pw = ?");
        values.push(hashedPassword);
      }

      if (updates.length === 0) {
        db.close();
        return res.status(400).send({ success: false, message: "No valid changes provided", status: 400 });
      }

      // 업데이트 쿼리 실행
      const updateQuery = `UPDATE Users SET ${updates.join(", ")} WHERE session_id = ?`;
      values.push(user_id);

      await new Promise((resolve, reject) => {
        db.run(updateQuery, values, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      db.close();
      return res.status(200).send({ success: true, message: "Profile updated successfully", status: 200 });

    } catch (error) {
      console.error("Profile update error:", error);
      db.close();
      return res.status(500).send({ success: false, message: "Failed to update profile", status: 500 });
    }
  });
});

module.exports = router;