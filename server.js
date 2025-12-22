const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// 정적 파일 서비스 추가
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);

    const base64Image = imageBuffer.toString('base64');

    const prompt = `
이 이미지를 보고 어떤 동물상 알려주고,
0부터 10까지 점수로 솔직하게 얼평해줘.
글고 만약에 너가 판단해서 40대 이상이다 그러면 칭찬만주고 글고 점수도 7점 이상.
그리고 동물 종과 얼평 점수를 JSON으로 알려줘.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for image review.' },
        { role: 'user', content: `${prompt}\n[base64 이미지 데이터]\n${base64Image}` },
      ],
    });

    const aiReply = response.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(aiReply);
    } catch {
      result = { error: 'Parsing AI response failed', raw: aiReply };
    }

    fs.unlinkSync(imagePath);

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
