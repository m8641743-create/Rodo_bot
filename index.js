const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = null;
let isConnected = false;

app.get('/', (req, res) => {
  if (isConnected) {
    res.send('<h1>🤖 Rodo_bot شغال وموصل واتساب ✅</h1>');
  } else if (qrCodeData) {
    res.send(`
      <h1>امسح الكود ده بواتسابك يا عماد</h1>
      <p>واتساب > الاجهزة المرتبطة > ربط جهاز</p>
      <img src="${qrCodeData}" />
      <br><br><a href="/"><button>تحديث</button></a>
    `);
  } else {
    res.send('<h1>⏳ جاري تشغيل البوت... حدث الصفحة بعد 10 ثواني</h1><a href="/"><button>تحديث</button></a>');
  }
});

app.listen(PORT, () => console.log('Server on ' + PORT));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Rodo_bot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('QR جديد');
      qrCodeData = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      console.log('اتقطع، بيعيد تشغيل...');
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Rodo_bot اتصل بنجاح');
      isConnected = true;
      qrCodeData = null;
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const from = msg.key.remoteJid;

    console.log('رسالة:', text);

    // === الأوامر الفخمة ===
    if (text === '.بوت' || text === '.ping') {
      await sock.sendMessage(from, { text: '🤖 Rodo_bot شغال فخم ✅\n\nالأوامر:\n.منشن\n.بوت\n.حب\n.طرد' });
    }
    else if (text.startsWith('.منشن')) {
      // منشن الكل
      const groupMetadata = await sock.groupMetadata(from).catch(() => null);
      if (groupMetadata) {
        let members = groupMetadata.participants.map(a => a.id);
        await sock.sendMessage(from, { text: '👑 منشن للكل بواسطة Rodo_bot\n' + members.map(m => '@' + m.split('@')[0]).join(' '), mentions: members });
      }
    }
    else if (text === '.حب') {
      await sock.sendMessage(from, { text: '❤️ بتحبك رودو يا عماد 🌹' });
    }
  });
}

startBot();
