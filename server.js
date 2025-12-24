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

/**
 * ✅ 같은 사진이면 같은 점수 나오게 하는 핵심
 */
function getStableScore(buffer) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const seed = parseInt(hash.slice(0, 8), 16);

  // 6.0 ~ 9.5 사이
  return (6 + (seed % 35) / 10).toFixed(1);
}

function generateFeedback(score) {
  const s = parseFloat(score);

  if (s >= 9)
    return "황금비율에 매우 근접한 얼굴형입니다. 전체적인 균형과 인상이 매우 뛰어납니다.";
  if (s >= 8)
    return "이목구비 비율이 안정적이고 조화롭습니다. 첫인상이 좋은 얼굴형입니다.";
  if (s >= 7)
    return "전체적인 비율은 괜찮으나 특정 부위에서 약간의 불균형이 보입니다.";
  return "얼굴 비율이 평균 범위에 있으며 스타일이나 표정에 따라 인상이 크게 달라질 수 있습니다.";
}

app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    const imageBuffer = fs.readFileSync(req.file.path);

    const score = getStableScore(imageBuffer);
    const feedback = generateFeedback(score);

    /** 🔥 디스코드 전송 (미리보기) */
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path), "face.jpg");

    form.append(
      "payload_json",
      JSON.stringify({
        embeds: [
          {
            title: "📊 얼굴 평가 결과",
            description: `**점수:** ${score}/10\n\n${feedback}`,
            color: 0x38bdf8,
            image: { url: "attachment://face.jpg" }
          }
        ]
      })
    );

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });

    fs.unlink(req.file.path, () => {});

    res.json({
      score,
      feedback
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "평가 실패" });
  }
});

app.listen(10000, () => {
  console.log("✅ Server running on port 10000");
});
