const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 200 * 1024 } }); // 200KB 제한

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FORMSPREE_URL = 'https://formspree.io/f/xgowzodj';

app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagePath = req.file.path;
  const formData = new FormData();
  formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);

  let aiResult = { error: 'AI processing was not done' };

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64').slice(0, 10000);

    const prompt = `
이 이미지를 보고 어떤 동물상인지 알려주고, 0부터 10까지 점수로 솔직하게 얼평해줘.
만약 40대 이상이라면 칭찬만 주고, 점수는 7점 이상 9이하로 해줘.
동물 종과 얼평 점수를 JSON으로 알려줘.
Base64 이미지 일부: ${base64Image}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an honest animal reviewer AI.' },
        { role: 'user', content: prompt },
      ],
    });

    const aiReply = response.choices[0].message.content;
    try {
      aiResult = JSON.parse(aiReply);
    } catch {
      aiResult = { error: 'Failed to parse AI response', raw: aiReply };
    }
  } catch (error) {
    console.error('AI processing failed:', error);
  }

  // AI 결과가 있어도 없거나 상관없이 사진 + review 필드 무조건 보냄
  formData.append('review', JSON.stringify(aiResult));
  // formspree에 이메일 안받고 고정 이메일 넣기 (필요시 변경)
  formData.append('email', 'no-reply@example.com');

  try {
    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (error) {
    console.error('Formspree submission failed:', error);
    // 사진이 안가는 건 막으려고 여기서는 에러 리턴하지 않고 그냥 진행
  } finally {
    fs.unlinkSync(imagePath);
  }

  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
