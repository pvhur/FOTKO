const nodemailer = require('nodemailer');
const fs = require("fs");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sendemail = async (tag, id, recipientEmail, code) => {
  const transporter = nodemailer.createTransport({
    host: process.env.email_service,
    port: 587,
    secure: false,
    auth: {
      user: process.env.user,
      pass: process.env.pass,
    },
    tls: {
      rejectUnauthorized: true, // 테스트 : false , 실제 true
    },
    debug: true, // 디버깅 활성화
  });

  try {
    // verify connection configuration
    await transporter.verify();
    
    if (tag == "forgotpassword") {
      // 발신자, 수신자와 전송할 이메일 내용 설정
      const BUSINESS_NAME = 'eduplus';
      let info = await transporter.sendMail({
        from: `eduplus <eduplus@dksh.site>`,
        to: recipientEmail, // 수신자
        subject: `EDUPLUS 비밀번호 재설정`, // 제목
        text: '본 이메일은 수신만 가능합니다.', // 이메일 내용
        html: `
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>비밀번호 재설정</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f9f9f9; font-family:Arial, sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <!-- 로고 -->
                      <img
                        src="https://postfiles.pstatic.net/MjAyNTAzMjZfMjkg/MDAxNzQyOTk1MDczMTg3.c07chEQ-Net6pmK6cQdz6Je7DkngyG-M8iWlxmE2cTMg.uIZvrvCu4W3cVv1r7YifWahCFe7V1X4PsB-mBa9Q3Zcg.PNG/eduplus-logo.png?type=w773"
                        alt="EDUPLUS Logo"
                        width="400"
                        style="display: block;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #333333; font-size: 16px; line-height: 1.6;">
                      <p style="margin: 0 0 20px 0; text-align: center;">
                        비밀번호 재설정을 위한 인증번호입니다.
                      </p>
                      <div style="background-color: #f5f5f5; border-radius: 4px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #008cff;">${code}</span>
                      </div>
                      <p style="margin: 20px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
                        본 인증번호는 5분간 유효합니다.<br>
                        요청하지 않은 인증번호라면 이 이메일을 무시하셔도 됩니다.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 30px; border-top: 1px solid #eee; margin-top: 30px;">
                      <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                        본 이메일은 발신전용입니다.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        `, // 이메일 본문에 html을 담아 전송
      });
      return true;
    }
    if (tag == "emailcheck") {
      // 발신자, 수신자와 전송할 이메일 내용 설정
      const BUSINESS_NAME = 'EDUPLUS';
      let info = await transporter.sendMail({
        from: `eduplus <eduplus@dksh.site>`,
        to: recipientEmail, // 수신자
        subject: `EDUPLUS 이메일 인증`, // 제목
        text: '본 이메일은 수신만 가능합니다.', // 이메일 내용
        html: `
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>이메일 인증</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f9f9f9; font-family:Arial, sans-serif;">
          <!-- 메인 컨테이너 -->
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
            <tr>
              <td align="center">
                <!-- 흰색 배경 박스 -->
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <!-- 로고 -->
                      <img
                        src="https://postfiles.pstatic.net/MjAyNTAzMjZfMjkg/MDAxNzQyOTk1MDczMTg3.c07chEQ-Net6pmK6cQdz6Je7DkngyG-M8iWlxmE2cTMg.uIZvrvCu4W3cVv1r7YifWahCFe7V1X4PsB-mBa9Q3Zcg.PNG/eduplus-logo.png?type=w773"
                        alt="EDUPLUS Logo"
                        width="400"
                        style="display: block;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #333333; font-size: 16px; line-height: 1.6;">
                      <!-- 인사사 -->
                      <p style="margin: 0 0 1em 0;">
                        안녕하세요 <strong>${id}</strong>님,
                      </p>
                      <p style="margin: 0 0 2em 0;">
                        EDUPLUS에 가입해 주셔서 감사합니다!<br>
                        시작하기 전에, <strong>본인 확인</strong>이 필요해요.<br>
                        아래 버튼을 클릭하시면 이메일 주소를 인증하실 수 있어요.
                      </p>
                      <!-- 이메일 인증 버튼 -->
                      <p style="text-align: center; margin: 0 0 2em 0;">
                        <a
                          href="https://eduplus.dksh.site/auth/email_check?key=${code}"
                          style="
                            display: inline-block;
                            background-color: #008cff;
                            color: #ffffff;
                            text-decoration: none;
                            padding: 14px 28px;
                            border-radius: 4px;
                            font-weight: bold;
                          "
                        >
                          이메일 인증
                        </a>
                      </p>
                      <!-- 발신전용 메시지 -->
                      <div style="background-color: #f5f5f5; border-radius: 4px; padding: 10px; text-align: center; margin: 2em 0;">
                        <span style="font-size: 14px; color: #666666;">본 이메일은 발신전용입니다.</span>
                      </div>
                      <!-- 주소/정보 -->
                      <p style="font-size: 12px; color: #999999; margin: 2em 0 0 0;">
                        EDUPLUS<br>
                        Dankook University Software High School <br>
                        21, Dogok-ro 64-gil, Gangnam-gu  <br>
                        Seoul, Republic of Korea 06256
                      </p>
                    </td>
                  </tr>
                </table>
                <!-- //끝났다 -->
              </td>
            </tr>
          </table>
        </body>
        </html>

        `, // 이메일 본문에 html을 담아 전송
      });
      return true;
    }
  } catch (error) {
    console.error("send email error:", error);
    return false;
  }
};


module.exports = { sendemail };