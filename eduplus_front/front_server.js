const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const sessionConfig = require("./config/sessionConfig");
const app = express();
const port = 3000;
const cors = require("cors");
const path = require("path");

app.use(cors({
  origin: [
    'http://127.0.0.1:80',
  ],
  credentials: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`SERVER START ON PORT : ${port}`);
});

// 메인/웰컴 페이지
app.get('/', (req, res) => {
  console.log(req.session.user);
  if (!req.session.user) {
    res.sendFile(path.join(__dirname, './views/welecome/index.html'));
  } else {
    res.sendFile(path.join(__dirname, './views/main/index.html'));
  }
});

// 로그인 페이지
app.get('/login', (req, res) => {
  const ip = req.headers['cf-connecting-ip'];
  res.sendFile(path.join(__dirname, './views/sign_in/index.html'));
});

// 회원가입 페이지
app.get('/signup', (req, res) => {
  const ip = req.headers['cf-connecting-ip'];
  res.sendFile(path.join(__dirname, './views/sign_up/index.html'));
});

// 학생 정보(관리) 페이지
app.get('/students', (req, res) => {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    res.sendFile(path.join(__dirname, './views/student_management/index.html'));
  }
});

// 랜덤 자리 페이지
app.get('/random_seat', (req, res) => {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    res.sendFile(path.join(__dirname, './views/random_seat/index.html'));
  }
});

// 랜덤 학생 페이지
app.get('/random_student', (req, res) => {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    res.sendFile(path.join(__dirname, './views/random_student/index.html'));
  }
});

// /main 경로 추가
app.get('/main', (req, res) => {
  res.sendFile(path.join(__dirname, './views/main/index.html'));
});