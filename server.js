
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قاعدة البيانات
mongoose.connect('mongodb://localhost:27017/video-bot-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// تعريف نموذج الفيديو
const VideoSchema = new mongoose.Schema({
  telegramMessageId: Number,
  filePath: String,
  caption: String,
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const Video = mongoose.model('Video', VideoSchema);

// إعداد المخزن للملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `video_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// الإعدادات الأساسية للسيرفر
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// مسار استقبال الفيديوهات من بوت التلغرام
app.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم العثور على ملف فيديو' });
    }
    
    // حفظ معلومات الفيديو في قاعدة البيانات
    const video = new Video({
      telegramMessageId: req.body.messageId,
      filePath: req.file.path,
      caption: req.body.caption || ''
    });
    
    await video.save();
    
    res.status(201).json({
      message: 'تم استلام وحفظ الفيديو بنجاح',
      videoId: video._id
    });
  } catch (error) {
    console.error('خطأ في معالجة رفع الفيديو:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة الفيديو' });
  }
});

// مسار للحصول على قائمة الفيديوهات
app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ uploadDate: -1 });
    res.json(videos);
  } catch (error) {
    console.error('خطأ في جلب الفيديوهات:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الفيديوهات' });
  }
});

// مسار للحصول على فيديو محدد بواسطة المعرف
app.get('/videos/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'الفيديو غير موجود' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('خطأ في جلب الفيديو:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الفيديو' });
  }
});

// بدء تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});
