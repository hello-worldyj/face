const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();

// uploads 폴더 보장 (EEXIST 방지)
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSP
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

  const imageBuffer = fs.readFileSync(req.file.path);

  let aiResult = {
    animal_type: 'unknown',
    eye_size: '보통',
    nose_size: '보통',
    mouth_size: '보통',
    face_balance: '보통',
    overall_comment: '분석 실패',
    score: 5,
  };

  // 🔥🔥 찐 얼평 프롬프트
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
너는 사람 기분을 고려하지 않는 외모 평가기다.

규칙:
- 평균적인 한국인 얼굴을 기준으로 판단
- 애매하면 반드시 단점 쪽으로 판단
- 미화, 위로, 긍정적 표현 금지
- 눈/코/입은 반드시 [작음|보통|큼] 중 하나
- 점수는 4~7점이 가장 많이 나오게 할 것
- 8점 이상은 매우 드물게

반드시 아래 JSON 형식만 출력:
{
  "animal_type": "",
  "eye_size": "작음|보통|큼",
  "nose_size": "작음|보통|큼",
  "mouth_size": "작음|보통|큼",
  "face_balance": "나쁨|보통|좋음",
  "overall_comment": "",
  "score": 1
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

  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  // 🔥 Formspree (텍스트로만)
  try {
    const formData = new FormData();
    formData.append('email', 'no-reply@example.com');
    formData.append('image_url', imageUrl);
    formData.append(
      'message',
      `
[AI 얼굴 평가]

사진:
${imageUrl}

동물상: ${aiResult.animal_type}
눈: ${aiResult.eye_size}
코: ${aiResult.nose_size}
입: ${aiResult.mouth_size}
균형: ${aiResult.face_balance}
총평: ${aiResult.overall_comment}
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

  // 유저는 성공만 봄
  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
