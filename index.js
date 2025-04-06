const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Configuration

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ;
const MESSENGER_PAGE_TOKEN = process.env.MESSENGER_PAGE_TOKEN;
const MESSENGER_PAGE_ID = process.env.MESSENGER_PAGE_ID;
const MESSENGER_APP_SECRET = process.env.MESSENGER_APP_SECRET;
const SERVER_URL = process.env.SERVER_URL;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// Handle Telegram Webhook
app.post('/webhook/telegram', async (req, res) => {
  try {
    const update = req.body;
    if (update.channel_post && update.channel_post.video) {
      await handleVideo(update.channel_post.video);
    }
    res.status(200).end();
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).end();
  }
});

// Handle Messenger verification
app.get('/webhook/messenger', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

async function handleVideo(videoData) {
  try {
    // Get Telegram file URL
    const fileInfo = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`,
      { params: { file_id: videoData.file_id } }
    );

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.data.result.file_path}`;
    
    // Forward to Messenger
    await sendToMessenger(fileUrl);
  } catch (error) {
    console.error('Video handling error:', error);
  }
}

async function sendToMessenger(videoUrl) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${MESSENGER_PAGE_ID}/messages`,
      {
        recipient: { id: MESSENGER_PAGE_ID },
        message: {
          attachment: {
            type: "video",
            payload: {
              url: videoUrl,
              is_reusable: true
            }
          }
        },
        messaging_type: "MESSAGE_TAG",
        tag: "ACCOUNT_UPDATE"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MESSENGER_PAGE_TOKEN}`
        }
      }
    );

    console.log('Messenger response:', response.data);
  } catch (error) {
    console.error('Messenger API error:', error.response?.data);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  setWebhooks();
});

// Set webhooks on startup
async function setWebhooks() {
  try {
    // Set Telegram webhook
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      { url: `${SERVER_URL}/webhook/telegram` }
    );

    console.log('Webhooks set successfully');
  } catch (error) {
    console.error('Error setting webhooks:', error.response?.data);
  }
}
