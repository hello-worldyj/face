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

  formData.append('review', JSON.stringify(aiResult));
  formData.append('email', 'no-reply@example.com');

  try {
    const formspreeResponse = await axios.post(FORMSPREE_URL, formData, {
      headers: formData.getHeaders(),
    });
    console.log('Formspree 전송 성공:', formspreeResponse.status);
  } catch (error) {
    console.error('Formspree 전송 실패:', error.response?.data || error.message);
    // 여기서 에러를 사용자에게 절대 전달하지 않고 무시
  } finally {
    fs.unlinkSync(imagePath);
  }

  // 사용자에게는 항상 성공과 AI 결과만 응답
  res.json({ success: true, aiResult });
});
