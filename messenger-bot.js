const { MessengerClient } = require('messaging-api-messenger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// إعدادات بوت المسنجر
const messengerConfig = {
  accessToken: 'EAAJJCSmd2wYBO8uNdz6uB9YFqZA9SQFrekP7NhXwf3WkzhjhuczU6HZA7WSTaR9sXZAuiTpOfYnEJ98Bs6LbNgCsbddCrdAzt8xVycoKZC8JGHZCmEXpPZBpE9UWvztE26cSWfgzTZCP3lPLGQnHQHuDaVOTftVWe1UpZCrhA9HzZB0xphzdHouKqcXE0xMQr7H2XTgZDZD',
  appSecret: '5a086d1aba59227282b692b42bff1962',
  verifyToken: 'Ka9@8AnP%02&AUq#81£',
  serverUrl: 'https://telesenger.onrender.com' // عنوان السيرفر المركزي
};

// إنشاء عميل مسنجر
const client = new MessengerClient({
  accessToken: messengerConfig.accessToken,
  appSecret: messengerConfig.appSecret,
});

// تهيئة سيرفر Express لاستقبال الويبهوك
const messengerApp = express();
messengerApp.use(bodyParser.json());

// التحقق من الويبهوك
messengerApp.get('/webhook', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === messengerConfig.verifyToken
  ) {
    console.log('تم التحقق من الويبهوك');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error('فشل التحقق');
    res.sendStatus(403);
  }
});

// استقبال الرسائل من مسنجر
messengerApp.post('/webhook', (req, res) => {
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          handleMessage(event);
        }
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// وظيفة معالجة الرسائل الواردة
async function handleMessage(event) {
  const senderId = event.sender.id;
  const message = event.message;

  console.log('تم استلام رسالة من المستخدم:', senderId, message);

  // التحقق من أن الرسالة نصية
  if (message.text) {
    const text = message.text.toLowerCase();
    
    // أمر للحصول على آخر الفيديوهات
    if (text === 'آخر الفيديوهات' || text === 'فيديو' || text === 'video') {
      await sendLatestVideos(senderId);
    } 
    // أمر للحصول على فيديو محدد بالرقم
    else if (text.startsWith('فيديو ') || text.startsWith('video ')) {
      const videoIndex = parseInt(text.split(' ')[1]) - 1; // تحويل الرقم إلى فهرس (يبدأ من 0)
      await sendSpecificVideo(senderId, videoIndex);
    } 
    // رسالة مساعدة
    else {
      await client.sendText(senderId, 'مرحباً! يمكنك استخدام الأوامر التالية:\n- "فيديو": للحصول على آخر الفيديوهات\n- "فيديو 1": للحصول على فيديو محدد بالرقم');
    }
  }
}

// وظيفة إرسال آخر الفيديوهات
async function sendLatestVideos(userId) {
  try {
    // جلب قائمة الفيديوهات من السيرفر
    const response = await axios.get(`${messengerConfig.serverUrl}/videos`);
    const videos = response.data;
    
    if (videos.length === 0) {
      await client.sendText(userId, 'لا توجد فيديوهات متاحة حالياً');
      return;
    }
    
    // إرسال رسالة بقائمة الفيديوهات المتاحة
    let messageText = 'الفيديوهات المتاحة:\n';
    videos.slice(0, 5).forEach((video, index) => {
      const caption = video.caption ? `${video.caption.substring(0, 30)}...` : '(بدون عنوان)';
      messageText += `${index + 1}. ${caption}\n`;
    });
    
    messageText += '\nأرسل "فيديو 1" للحصول على الفيديو الأول وهكذا.';
    
    await client.sendText(userId, messageText);
  } catch (error) {
    console.error('خطأ في جلب الفيديوهات:', error);
    await client.sendText(userId, 'عذراً، حدث خطأ أثناء جلب الفيديوهات');
  }
}

// وظيفة تحميل وإرسال فيديو محدد
async function sendSpecificVideo(userId, index) {
  try {
    // جلب قائمة الفيديوهات من السيرفر
    const response = await axios.get(`${messengerConfig.serverUrl}/videos`);
    const videos = response.data;
    
    if (videos.length === 0) {
      await client.sendText(userId, 'لا توجد فيديوهات متاحة');
      return;
    }
    
    if (index < 0 || index >= videos.length) {
      await client.sendText(userId, 'رقم الفيديو غير صحيح');
      return;
    }
    
    const selectedVideo = videos[index];
    
    // تحميل الفيديو من السيرفر
    const videoUrl = `${messengerConfig.serverUrl}/${selectedVideo.filePath}`;
    const tempPath = path.join(__dirname, 'temp', `fb_video_${Date.now()}.mp4`);
    
    // تحميل الفيديو محلياً
    const videoResponse = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(tempPath);
    videoResponse.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // إرسال الفيديو للمستخدم
    await client.sendVideo(userId, fs.createReadStream(tempPath), {
      caption: selectedVideo.caption || ''
    });
    
    // حذف الملف المؤقت
    fs.unlinkSync(tempPath);
  } catch (error) {
    console.error('خطأ في إرسال الفيديو:', error);
    await client.sendText(userId, 'عذراً، حدث خطأ أثناء إرسال الفيديو');
  }
}

// بدء تشغيل بوت المسنجر
const MESSENGER_PORT = process.env.MESSENGER_PORT || 3001;
messengerApp.listen(MESSENGER_PORT, () => {
  console.log(`بوت المسنجر يعمل على المنفذ ${MESSENGER_PORT}`);
});
