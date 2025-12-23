import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const visionClient = new ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}"),
});

// 업로드 설정
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  console.log("🔥 /upload 요청 들어옴");
  const filePath = req.file.path;

  // 1. 디스코드에 사진 전송 (미리보기 가능하도록)
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: req.file.originalname || "face.jpg",
      contentType: req.file.mimetype,
    });
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

  // 2. Google Vision 얼굴 감지 + 점수 산출
  let visionScore = null;
  let visionMessage = "";
  try {
    const [result] = await visionClient.faceDetection(filePath);
    const faces = result.faceAnnotations || [];

    if (faces.length === 0) {
      visionMessage = "얼굴을 찾을 수 없어요.";
      visionScore = 0;
    } else {
      // 감정 점수로 간단 평가: joyLikelihood, sorrowLikelihood 등은 숫자 0~5 (UNKNOWN to VERY_LIKELY)
      // joy 점수를 기준으로 1~10 점 환산 (매우 기쁨이 많으면 10점)
      const joy = faces[0].joyLikelihood || 0;
      // UNKNOWN(0), VERY_UNLIKELY(1), UNLIKELY(2), POSSIBLE(3), LIKELY(4), VERY_LIKELY(5)
      // 0~5 scale -> 0~10 점수 환산 (거꾸로 처리해서 너무 슬프거나 화난 얼굴은 낮게 점수)
      const sadness = faces[0].sorrowLikelihood || 0;
      const anger = faces[0].angerLikelihood || 0;
      const surprise = faces[0].surpriseLikelihood || 0;

      // 단순 점수 계산 예:
      // 기쁨과 놀람은 플러스, 슬픔과 분노는 마이너스 영향
      let scoreRaw = joy * 2 + surprise * 1.5 - sadness * 2 - anger * 2;
      // 0~10 범위로 클램프
      scoreRaw = Math.min(Math.max(scoreRaw, 0), 10);
      visionScore = Math.round(scoreRaw);

      visionMessage = `Google Vision 점수: ${visionScore}점, 감정 분석 결과 기반입니다.`;
    }
  } catch (e) {
    visionMessage = "Google Vision API 오류 발생";
    console.error("Vision API 오류:", e.message);
  }

  // 3. OpenAI에게 점수 기반 평가 코멘트 요청
  let aiResult = "AI 평가 실패";
  try {
    const prompt = `
아래 점수를 참고해서 1~10점 사이의 점수를 다시 한 번 간단히 확인하고, 
한 문장으로 친근하고 솔직한 얼굴 평가를 해줘. 욕설은 절대 금지.

점수: ${visionScore}
추가 정보: ${visionMessage}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "너는 친근한 얼굴 평가 AI야." },
        { role: "user", content: prompt.trim() },
      ],
      max_tokens: 150,
    });

    aiResult = response.choices[0].message.content.trim();
  } catch (e) {
    console.error("AI 평가 실패:", e.message);
  }

  // 4. 업로드 파일 삭제
  fs.unlink(filePath, () => {});

  // 5. 응답
  res.json({
    ok: true,
    visionScore,
    visionMessage,
    aiResult,
  });
});

app.listen(PORT, () => {
  console.log("✅ Server running on", PORT);
});
