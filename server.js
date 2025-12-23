import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import vision from "@google-cloud/vision";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ 환경변수
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ Vision은 "서비스 계정 JSON"만 사용
const visionClient = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_VISION_API_JSON)
});

// 업로드
const upload = multer({ dest: "uploads/" });

app.use(express.static("."));

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  /* =====================
     1️⃣ 디스코드로 사진 전송
     ===================== */
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: "face.jpg",
      contentType: req.file.mimetype
    });

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("디스코드 전송 실패:", e.message);
  }

  /* =====================
     2️⃣ Google Vision 얼굴 분석
     ===================== */
  let visionSummary = "표정 정보 없음";

  try {
    const [result] = await visionClient.faceDetection(filePath);
    const face = result.faceAnnotations?.[0];

    if (face) {
      visionSummary = `
기쁨: ${face.joyLikelihood}
놀람: ${face.surpriseLikelihood}
분노: ${face.angerLikelihood}
      `;
    }
  } catch (e) {
    console.error("Vision 실패:", e.message);
  }

  /* =====================
     3️⃣ Gemini 평가
     ===================== */
  let score = 5;
  let comment = "평가 실패";

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
아래 얼굴 분석 정보를 참고해서
외모 점수를 1~10 사이 숫자로 정하고
한 문장으로 평가해줘.

얼굴 분석:
${visionSummary}

출력 형식:
점수: X
평가: 문장
              `
            }]
          }]
        })
      }
    );

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const match = text.match(/점수:\s*(\d+)/);
    score = match ? Number(match[1]) : 5;
    comment = text.replace(/점수:\s*\d+/, "").replace("평가:", "").trim();
  } catch (e) {
    console.error("Gemini 실패:", e.message);
  }

  res.json({
    ok: true,
    score,
    comment
  });

  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
