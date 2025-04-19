
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/generate', async (req, res) => {
  const {
    title, author, field, language, type,
    objectives, hypotheses, citation, sources
  } = req.body;

  const prompt = `
اكتب بحثًا أكاديميًا بعنوان: "${title}"
المجال: ${field}
اسم الباحث: ${author}
لغة البحث: ${language}
نوع البحث: ${type}
الأهداف:
${objectives}
الفرضيات أو التساؤلات:
${hypotheses}
طريقة التوثيق: ${citation}
المصادر المعتمدة:
${sources}

اتبع المنهجية الأكاديمية: مقدمة، إشكالية، دراسات سابقة، منهجية، تحليل، نتائج، توصيات، خاتمة، مراجع.
`;

  try {
    const response = await axios.post('https://api.together.xyz/inference', {
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      prompt: prompt,
      max_tokens: 2048,
      temperature: 0.7,
      top_p: 0.9
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const resultText = response.data.output || 'لم يتم توليد نص.';

    // إنشاء مستند Word
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: title, bold: true, size: 32 }),
              new TextRun({ text: `

${resultText}`, break: 1 })
            ]
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `بحث-${Date.now()}.docx`;

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('حدث خطأ أثناء توليد البحث.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`الخادم شغال على http://localhost:${PORT}`);
});
