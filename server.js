import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import { Configuration, OpenAIApi } from 'openai';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);

    // OpenAI 이미지 분석 예시 (GPT-4 Vision 가정, 실제 API 문서 참고 필요)
    // 여기선 간단히 이미지 파일을 base64로 변환해 프롬프트와 함께 보내는 예시
    const base64Image = imageBuffer.toString('base64');

    const prompt = `
이 이미지를 보고 어떤 동물인지 알려주고,
0부터 10까지 점수로 솔직하게 얼평해줘.
그리고 동물 종과 얼평 점수를 JSON으로 알려줘.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 실제 이미지 분석 가능한 모델로 바꿔야 함
      messages: [
        { role: 'system', content: 'You are a helpful assistant for image review.' },
        { role: 'user', content: `${prompt}\n[base64 이미지 데이터]\n${base64Image}` },
      ],
    });

    // 예시로 GPT 응답에서 JSON만 파싱한다고 가정
    const aiReply = response.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(aiReply);
    } catch {
      result = { error: 'Parsing AI response failed', raw: aiReply };
    }

    fs.unlinkSync(imagePath); // 업로드된 파일 삭제

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
