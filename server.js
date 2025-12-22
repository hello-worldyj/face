const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');

const app = express();

// multer 200KB 제한 (200 * 1024 bytes)
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 200 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Formspree 엔드포인트
const FORMSPREE_URL = 'https://formspree.io/f/xgowzodj';

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // 이미지 버퍼 읽기
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // AI 프롬프트 (이미지 최대 200KB이지만 Base64는 꽤 커서 최대 10,000 글자만 사용)
    const MAX_BASE64_LENGTH = 10000;
    const trimmedBase64 = base64Image.slice(0, MAX_BASE64_LENGTH);

    const prompt = `
이 이미지를 보고 어떤 동물상 알려주고, 0부터 10까지 점수로 솔직하게 얼평해줘. 
글고 만약에 너가 판단해서 40대 이상이다 그러면 칭찬만주고 글고 점수도 7점 이상 9이하. 
그리고 동물 종과 얼평 점수를 JSON으로 알려줘.
Base64 이미지 일부: ${trimmedBase64}
`;

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an honest animal reviewer AI.' },
        { role: 'user', content: prompt },
      ],
    });

    const aiReply = response.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(aiReply);
    } catch {
      result = { error: 'Failed to parse AI response', raw: aiReply };
    }

    // FormData 생성 (Formspree 전송용)
    const formData = new FormData();
    formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);
    formData.append('review', JSON.stringify(result));

    // Formspree에 POST 요청
    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });

    // 업로드 파일 삭제
    fs.unlinkSync(imagePath);

    // 클라이언트에 AI 결과 반환
    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
