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

// ===== uploads 폴더 보장 =====
const uploadDir = path.join(process.cwd(), "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ===== multer 설정 =====
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const filePath = req.file.path;
  const fileName = path.basename(filePath);

  // **중요**: 완전한 URL로 만들어야 함
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;

  try {
    if (!DISCORD_WEBHOOK_URL) throw new Error("DISCORD_WEBHOOK_URL 환경변수가 없습니다.");

    // Discord 웹훅에 JSON payload로 이미지 URL 보냄
    const payload = {
      content: "새 얼굴 평가가 도착했어요!",
      embeds: [
        {
          title: "AI 얼굴 평가 결과",
          image: { url: imageUrl },
          color: 5814783,
          footer: { text: "Face Review Bot" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord 전송 오류: ${response.status} ${text}`);
    }

    console.log("Discord 전송 성공");
  } catch (e) {
    console.error("Discord 전송 실패:", e);
  }

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

    res.json({ score, percent, feedback, imageUrl });
  } catch (e) {
    console.error("평가 계산 중 오류:", e);
    res.status(500).json({ error: "평가 처리 중 오류가 발생했습니다." });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error("업로드 파일 삭제 실패:", err);
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
