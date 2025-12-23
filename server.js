import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  console.log("🔥 /upload 요청 들어옴");

  const filePath = req.file.path;

  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: "face.jpg",
      contentType: req.file.mimetype,
    });

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!discordRes.ok) {
      console.error("❌ 디스코드 전송 실패:", await discordRes.text());
    }
  } catch (e) {
    console.error("❌ 디스코드 전송 실패:", e.message);
  }

  let aiResult = "AI 분석 실패 (사진은 정상적으로 전송됨)";
  let score = null;

  try {
    const imageBase64 = fs.readFileSync(filePath, {
      encoding: "base64",
    });

    const prompt = `
사진을 보고 1~10 사이 점수만 숫자로 먼저 알려주고, 
그 다음에 한 문장으로 솔직하고 친근하게 평가해줘. 
욕설 없이, 재미있게 말해줘.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "너는 얼굴을 평가하는 AI야." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt.trim() },
            {
              type: "image_url",
              image_url: {
                url: `data:${req.file.mimetype};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const text = response.choices[0].message.content.trim();
    aiResult = text;

    const match = text.match(/([1-9]|10)/);
    if (match) score = match[1];
  } catch (e) {
    console.error("❌ AI 평가 실패:", e.message);
  }

  fs.unlink(filePath, () => {});

  res.json({
    ok: true,
    score,
    result: aiResult,
  });
});

app.listen(PORT, () => {
  console.log("✅ Server running on", PORT);
});
