app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imagePath = req.file.path;
  const formData = new FormData();
  formData.append('photo', fs.createReadStream(imagePath), req.file.originalname);

  let aiResult = null;

  try {
    // AI 처리 시도
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const MAX_BASE64_LENGTH = 10000;
    const trimmedBase64 = base64Image.slice(0, MAX_BASE64_LENGTH);

    const prompt = `
이 이미지를 보고 어떤 동물상인지 알려주고, 0부터 10까지 점수로 솔직하게 얼평해줘. 
만약 판단해서 40대 이상이라면 칭찬만 주고, 점수는 7점 이상 9이하로 해줘. 
동물 종과 얼평 점수를 JSON으로 알려줘. 사람사진이 아니면은 "?"라고 보내
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
    // AI 처리 실패해도 사진은 formData에 있고 전송은 시도함
    console.error('AI processing failed:', error);
    formData.append('review', JSON.stringify({ error: 'AI processing failed' }));
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
