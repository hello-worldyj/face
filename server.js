import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 환경변수
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// uploads 폴더 (임시 저장)
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 설정
const upload = multer({ dest: uploadDir });

// static
app.use(express.static("public"));

/**
 * 사진 업로드 + AI 얼평
 */
app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  let aiResult = "❌ AI 분석 실패";

  // 1️⃣ AI 얼평 (실패해도 OK)
  try {
    const imgBase64 = fs.readFileSync(filePath, { encoding: "base64" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "이 얼굴을 보고 외모를 100점 만점으로 평가하고 한줄 코멘트 해줘." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imgBase64}` }
            }
          ]
        }
      ]
    });

    aiResult = completion.choices[0].message.content;
  } catch (e) {
    console.log("AI 실패:", e.message);
  }

  // 2️⃣ 디스코드로 무조건 전송 (🔥 핵심)
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append(
      "payload_json",
      JSON.stringify({
        username: "얼평 봇",
        content: `📸 사진 도착\n\n🧠 AI 결과:\n${aiResult}`
      })
    );

    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.log("디스코드 전송 실패:", e.message);
  }

  // 3️⃣ 파일 삭제 (원하면 유지 가능)
  fs.unlinkSync(filePath);

  // 4️⃣ 유저 응답
  res.json({
    success: true,
    result: aiResult
  });
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
