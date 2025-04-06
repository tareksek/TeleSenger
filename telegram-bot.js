const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// إنشاء بوت تلغرام جديد
const bot = new Telegraf(telegramConfig.apiToken);

// وظيفة تحميل الفيديو من تلغرام
async function downloadTelegramFile(fileId) {
  try {
    const fileInfo = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${telegramConfig.apiToken}/${fileInfo.file_path}`;
    
    // إنشاء مسار للتحميل المؤقت
    const tempFilePath = path.join(__dirname, 'temp', `video_${Date.now()}.mp4`);
    
    // تحميل الملف
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream'
    });
    
    // حفظ الملف محليًا بشكل مؤقت
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(tempFilePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('خطأ في تحميل الملف من تلغرام:', error);
    throw error;
  }
}

// وظيفة إرسال الفيديو للسيرفر
async function uploadVideoToServer(filePath, caption, messageId) {
  try {
    const formData = new FormData();
    formData.append('video', fs.createReadStream(filePath));
    formData.append('caption', caption || '');
    formData.append('messageId', messageId.toString());
    
    const response = await axios.post(telegramConfig.serverEndpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // حذف الملف المؤقت بعد الرفع
    fs.unlinkSync(filePath);
    
    return response.data;
  } catch (error) {
    console.error('خطأ في رفع الفيديو للسيرفر:', error);
    throw error;
  }
}

// الاستماع للرسائل الجديدة في القناة
bot.on('channel_post', async (ctx) => {
  // التحقق من أن المصدر هو القناة المطلوبة
  if (ctx.channelPost.chat.username === telegramConfig.channelId.replace('@', '')) {
    // التحقق من أن الرسالة تحتوي على فيديو
    if (ctx.channelPost.video) {
      console.log('تم استلام فيديو جديد من القناة');
      
      try {
        // تحميل الفيديو
        const videoPath = await downloadTelegramFile(ctx.channelPost.video.file_id);
        
        // استخراج التعليق إن وجد
        const caption = ctx.channelPost.caption || '';
        
        // رفع الفيديو للسيرفر
        const result = await uploadVideoToServer(videoPath, caption, ctx.channelPost.message_id);
        
        console.log('تم رفع الفيديو بنجاح للسيرفر:', result);
      } catch (error) {
        console.error('حدث خطأ أثناء معالجة الفيديو:', error);
      }
    }
  }
});

// بدء تشغيل بوت التلغرام
bot.launch().then(() => {
  console.log('بوت التلغرام يعمل الآن ويستمع للقناة');
});
