const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PSID = process.env.FB_PSID;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('video', async (msg) => {
  const fileId = msg.video.file_id;

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

    const videoPath = path.join(__dirname, 'video.mp4');
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    writer.on('finish', async () => {
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id: FB_PSID }));
      form.append('message', JSON.stringify({
        attachment: {
          type: 'video',
          payload: { is_reusable: true }
        }
      }));
      form.append('filedata', fs.createReadStream(videoPath));

      await axios.post(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_TOKEN}`,
        form,
        { headers: form.getHeaders() }
      );

      console.log('Video sent to Messenger!');
      fs.unlinkSync(videoPath);
    });
  } catch (error) {
    console.error('Error sending video:', error.message);
  }
});
