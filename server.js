const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();

// uploads 폴더 보장
const uploadDir = path.join(__dirname, 'public/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 }, // 500KB
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSP 에러 방지
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; media-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FORMSPREE_URL = 'https://formspree.io/f/xgowzodj';

app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.json({ success: true, aiResult: null });
  }

  console.log('UPLOAD HIT:', req.file.filename);

  const imagePath = req.file.path;
  const imageBuffer = fs.readFileSync(imagePath);

  let aiResult = {
    animal_type: 'unknown',
    eye: 'unknown',
    nose: 'unknown',
    mouth: 'unknown',
    overall_impression: 'analysis failed',
    score: 0,
  };

  // AI 얼굴 분석
  try {
    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
사진을 실제로 보고 판단해라.
아부 금지, 솔직하게.

JSON으로만 응답:
{
  "animal_type": "",
  "eye": "",
  "nose": "",
  "mouth": "",
  "overall_impression": "",
  "score": 0
}
`
            },
            {
              type: 'input_image',
              image_base64: imageBuffer.toString('base64'),
            },
          ],
        },
      ],
    });

    aiResult = JSON.parse(response.output_text);
  } catch (e) {
    console.error('AI 실패:', e.message);
  }

  // 사진 공개 URL
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  // 🔥 Formspree (JSON ❌ / TEXT ✅)
  try {
    const formData = new FormData();
    formData.append('email', 'no-reply@example.com');
    formData.append('image_url', imageUrl);
    formData.append(
      'message',
      `
[AI 얼굴 평가]

사진: ${imageUrl}

동물상: ${aiResult.animal_type}
눈: ${aiResult.eye}
코: ${aiResult.nose}
입: ${aiResult.mouth}
인상: ${aiResult.overall_impression}
점수: ${aiResult.score}
`
    );

    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });

    console.log('Formspree 전송 성공');
  } catch (e) {
    console.error('Formspree 실패:', e.message);
  }

  // 유저는 항상 성공만 봄
  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
