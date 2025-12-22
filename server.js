import express from 'express';
import multer from 'multer';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import { OpenAI } from 'openai';
import cors from 'cors';

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 200 * 1024 } }); // 200KB 제한

app.use(cors());
app.use(express.json());

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FORMSPREE_URL = 'https://formspree.io/f/xgowzodj';

app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagePath = req.file.path;

  const formData = new FormData();
  formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);

  let aiResult = null;

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const MAX_BASE64_LENGTH = 10000;
    const trimmedBase64 = base64Image.slice(0, MAX_BASE64_LENGTH);

    const prompt = `
이 이미지를 보고 어떤 동물상 알려주고, 0부터 10까지 점수로 솔직하게 얼평해줘. 
글고 만약에 너가 판단해서 40대 이상이다 그러면 칭찬만주고 글고 점수도 7점 이상 9이하. 
그리고 동물 종과 얼평 점수를 JSON으로 알려줘.
Base64 이미지 일부: ${trimmedBase64}
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

    formData.append('review', JSON.stringify(aiResult));
  } catch (error) {
    console.error('AI processing failed:', error);
  }

  try {
    await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (error) {
    console.error('Formspree submission failed:', error);
    return res.status(500).json({ error: 'Failed to send data to Formspree' });
  } finally {
    fs.unlinkSync(imagePath);
  }

  res.json({ success: true, aiResult });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
