
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const CloudConvert = require('cloudconvert');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const CHANNEL_ID = process.env.CHANNEL_ID;
const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY);

bot.on('video', async (ctx) => {
  try {
    const fileId = ctx.message.video.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    await ctx.reply('جاري ضغط الفيديو... انتظر قليلاً');

    // إعداد مهمة الضغط
    const job = await cloudConvert.jobs.create({
      tasks: {
        'import-my-file': {
          operation: 'import/url',
          url: fileLink.href
        },
        'compress-my-video': {
          operation: 'compress',
          input: 'import-my-file',
          output_format: 'mp4',
        },
        'export-my-file': {
          operation: 'export/url',
          input: 'compress-my-video',
        }
      }
    });

    // انتظار المهمة حتى تنتهي
    const completedJob = await cloudConvert.jobs.wait(job.id);
    const exportTask = completedJob.tasks.find(task => task.name === 'export-my-file');
    const compressedUrl = exportTask.result.files[0].url;

    // تحميل الفيديو المضغوط مؤقتاً
    const tempFilePath = path.join(__dirname, 'compressed_video.mp4');
    const writer = fs.createWriteStream(tempFilePath);
    const response = await axios.get(compressedUrl, { responseType: 'stream' });
    response.data.pipe(writer);

    writer.on('finish', async () => {
      await ctx.telegram.sendVideo(CHANNEL_ID, { source: fs.createReadStream(tempFilePath) }, { caption: 'فيديو مضغوط' });
      fs.unlinkSync(tempFilePath); // حذف الملف بعد الإرسال
    });

    writer.on('error', err => {
      console.error('فشل تحميل الملف المضغوط:', err);
    });

  } catch (error) {
    console.error('حدث خطأ:', error);
    ctx.reply('حدث خطأ أثناء ضغط الفيديو.');
  }
});

bot.launch();
