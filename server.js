import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const upload = multer({ dest: "uploads/" });

app.use(express.static("./"));

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  const imageBase64 = fs.readFileSync(filePath, "base64");

  /* ===============================
     1️⃣ Discord: 이미지 바로 보이게 embed
     =============================== */
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "📸 새 얼굴 업로드",
        embeds: [
          {
            title: "업로드된 사진",
            image: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      })
    });
  } catch (e) {
    console.error("디스코드 실패:", e.message);
  }

  /* ===============================
     2️⃣ Gemini 얼굴 평가
     =============================== */
  let score = "N/A";
  let comment = "AI 평가 실패";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "이 사람 얼굴을 1~10점으로 평가해. " +
                    "무조건 '점수|한줄평가' 형식으로만 답해."
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text && text.includes("|")) {
      const [s, c] = text.split("|");
      score = s.trim();
      comment = c.trim();
    } else {
      comment = "얼굴 인식 실패 또는 응답 없음";
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
