const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const sessionConfig = require("./config/sessionConfig");
const apiRoutes = require('./routes/api'); //라우터로 코드 분리
const authRoutes = require('./routes/auth'); //라우터로 코드 분리
const app = express();
const port = 80;
const cors = require("cors");
const path = require("path");
const https = require('https');

app.use(cors({

  credentials: true
}));

// 미들웨어 설정
app.use(bodyParser.json());
app.use(session(sessionConfig));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

//라우터 설정
app.use('/class_api', apiRoutes) //도메인/api하고 그 뒤를 저 소스코드에서 찾으면 됨
app.use('/auth', authRoutes) //도메인/auth하고 그 뒤를 저 소스코드에서 찾으면 됨

https.createServer({
  key: fs.readFileSync('./ssl/key.pem'),
  cert: fs.readFileSync('./ssl/cert.pem')
}, app).listen(port, () => {
  console.log('Kickoff 서버 실행');
});