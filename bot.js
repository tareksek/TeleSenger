const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

// متغيرات البيئة
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PSID = process.env.FB_PSID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// إعداد بوت تيليغرام
const bot = new TelegramBot(TELEGRAM_TOKEN);

// إعداد خادم Express
const app = express();
app.use(bodyParser.json());

// تعيين Webhook
app.post('/webhook', (req, res) => {
  const message = req.body;
  
  // التعامل مع الرسائل الواردة من تيليغرام
  if (message && message.message && message.message.video) {
    const fileId = message.message.video.file_id;
    bot.getFile(fileId).then(async (file) => {
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
      const localPath = await downloadTelegramVideo(fileUrl);
      await sendVideoToMessenger(localPath);
      res.sendStatus(200); // الرد إلى تيليغرام بأننا استلمنا الرسالة
    });
  }
  res.sendStatus(200); // الرد إلى تيليغرام
});

// تفعيل Webhook للبوت
bot.setWebHook(`https://your-server-url.com/webhook`);

// دالة تحميل الفيديو من تيليغرام
async function downloadTelegramVideo(fileUrl) {
  const axios = require('axios');
  const fs = require('fs');
  const path = require('path');
  
  const localPath = path.join(__dirname, 'temp_video.mp4');
  const response = await axios.get(fileUrl, { responseType: 'stream' });
  const writer = fs.createWriteStream(localPath);
  response.data.pipe(writer);
  await new Promise(resolve => writer.on('finish', resolve));
  return localPath;
}

// دالة إرسال الفيديو إلى مسنجر
async function sendVideoToMessenger(localPath) {
  const fs = require('fs');
  const FormData = require('form-data');
  const axios = require('axios');
  
  const form = new FormData();
  form.append('recipient', JSON.stringify({ id: FB_PSID }));
  form.append('message', JSON.stringify({
    attachment: {
      type: 'video',
      payload: { is_reusable: true }
    }
  }));
  form.append('filedata', fs.createReadStream(localPath));
  
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_TOKEN}`,
    form,
    { headers: form.getHeaders() }
  );
  
  console.log('تم إرسال الفيديو إلى مسنجر:', response.data);
  return true;
}

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`خادم Webhook يعمل على المنفذ ${PORT}`);
});
