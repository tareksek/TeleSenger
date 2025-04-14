const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// المتغيرات البيئية
const {
  TELEGRAM_TOKEN,
  CLOUDCONVERT_API_KEY,
  CHANNEL_ID,
  MAX_VIDEO_SIZE
} = process.env;

const bot = new Telegraf(TELEGRAM_TOKEN);

// معالجة الفيديوهات
bot.on('video', async (ctx) => {
  try {
    // التحقق من الحجم
    if (ctx.message.video.file_size > MAX_VIDEO_SIZE) {
      return ctx.reply('❌ حجم الفيديو يتجاوز 10MB!');
    }

    // تنزيل الفيديو
    const fileLink = await ctx.telegram.getFileLink(ctx.message.video.file_id);
    const tempInput = `temp_${Date.now()}.mp4`;
    await downloadFile(fileLink.href, tempInput);

    // إرسال إلى CloudConvert
    const { jobId, uploadUrl } = await createCloudConvertJob();
    await uploadToCloudConvert(uploadUrl, tempInput);
    const outputUrl = await waitForConversion(jobId);

    // تنزيل الفيديو المضغوط
    const tempOutput = `compressed_${Date.now()}.mp4`;
    await downloadFile(outputUrl, tempOutput);

    // إرسال إلى القناة
    await ctx.telegram.sendVideo(CHANNEL_ID, { source: tempOutput });

    // تنظيف الملفات
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

  } catch (error) {
    console.error('Error:', error);
    ctx.reply('حدث خطأ أثناء المعالجة!');
  }
});

// ─── وظائف المساعدة ───────────────────────────────────
async function downloadFile(url, path) {
  const response = await axios({ url, responseType: 'stream' });
  await new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(path))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function createCloudConvertJob() {
  const response = await axios.post(
    'https://api.cloudconvert.com/v2/jobs',
    {
      tasks: {
        import: { operation: 'import/upload' },
        convert: {
          operation: 'convert',
          input: 'import',
          output_format: 'mp4',
          video_codec: 'h264',
          crf: 28
        },
        export: { operation: 'export/url' }
      }
    },
    { headers: { Authorization: `Bearer ${CLOUDCONVERT_API_KEY}` } }
  );

  return {
    jobId: response.data.data.id,
    uploadUrl: response.data.data.tasks[0].result.form.url
  };
}

async function uploadToCloudConvert(url, filePath) {
  const fileStream = fs.createReadStream(filePath);
  await axios.post(url, fileStream, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

async function waitForConversion(jobId) {
  while (true) {
    const response = await axios.get(
      `https://api.cloudconvert.com/v2/jobs/${jobId}`,
      { headers: { Authorization: `Bearer ${CLOUDCONVERT_API_KEY}` } }
    );

    const status = response.data.data.status;
    if (status === 'finished') {
      return response.data.data.tasks[2].result.files[0].url;
    } else if (status === 'error') {
      throw new Error('فشل التحويل في CloudConvert');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// تشغيل البوت
bot.launch();
console.log('✅ البوت يعمل!');
