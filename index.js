const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  generateWAMessageFromContent,
  downloadMediaMessage,
  proto,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');

const app = express();
let lastQR = null;
let isConnected = false;
const PORT = process.env.PORT || 10000;

app.get('/', async (req, res) => {
  if (isConnected) {
    return res.send('<h1>🤖 RODO BOT شغال وموصل واتساب ✅🌹</h1>');
  }
  if (lastQR) {
    const qrImage = await QRCode.toDataURL(lastQR);
    return res.send(`<h1>امسح الـ QR</h1><img src="${qrImage}" width="300"/><br/><script>setTimeout(()=>location.reload(),10000)</script>`);
  }
  res.send('<h1>جاري تشغيل البوت... حدث بعد 10 ثواني</h1><script>setTimeout(()=>location.reload(),5000)</script>');
});
app.listen(PORT, () => console.log('Server on ' + PORT));

// ======= كودك الأصلي يبدأ هنا =======
const PREFIX = '!';
const NUMBER = '249912345678';
const CHANNEL_URL = '';

const MAX_PLAYERS = 16;
const REG_TIME = 3 * 60 * 1000;
const MOVE_TIME = 60 * 1000;
const BOMB_DUEL_TIME = 2000;
const EMOJI_WIN = 3;
const EMOJI_ROUND_TIME = 30 * 1000;
const EMOJI_MAX_ROUNDS = 15;
const EMOJIS = ['😂','❤️','🔥','😍','🤣','😎','🥺','👍','🙏','😭','🤔','😅'];

const games = new Map();
const xoGames = new Map();
const sxoGames = new Map();
const emojiGames = new Map();
const pointsDB = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (jid) => '@' + jid.split('@')[0];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const LINE = '━━━━━━━━━━━━━━━━━━';
const BRAND = '> 𝐑𝐎𝐃𝐎 𝐁𝐎𝐓 🌹';
const card = (title, rows = [], note = '', brand = true) =>
  `*${title}*\n${LINE}\n${rows.join('\n')}\n${LINE}` +
  (note? '\n' + note.split('\n').map((l) => '> ' + l).join('\n') : '') +
  (brand? `\n\n${BRAND}` : '');

function addPoints(groupId, userId, type){
  const key = `${groupId}:${userId}`;
  let pts = pointsDB.get(key) || 0;
  let add = 0;
  if(type==='bomb') add=5;
  if(type==='emoji') add=4;
  if(type==='xo') add=3;
  if(type==='sxo') add=10;
  pts+=add;
  pointsDB.set(key, pts);
  return {pts, add};
}
function pointsLine(er){ return `*+${er.add} نقاط* | مجموعك: ${er.pts}`; }

const MENU_BODY = '> اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ ﷺ\n\n'+`${LINE}\n> 𝐑𝐔𝐃𝐎---𝐋𝐈𝐒𝐓\n *إختر قسمآ من القائمة ادناه↓↓* 🌹\n\n•────────•✦•────────•`;
const GAMES_BODY = '> اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ ﷺ\n\n'+`${LINE}\n> 𝐑𝐔𝐃𝐎---𝐆𝐀𝐌𝐄𝐒\n *إختر اللعبة اللي بدك ياها↓↓* 🎮\n\n•────────•✦•────────•`;

const MAIN_ROWS = [
  { title: 'الألعاب🎮', description: 'القنبلة • XO • الايموجي', id: 'sec_games' },
  { title: '🏆 النقاط والترتيب', description: 'ترتيب • نقاطي', id: 'sec_points' },
  { title: '🛠️ أوامر عامة', description: 'ping • say • بحث صورة • فتح', id: 'sec_tools' },
];

const GAME_ROWS = [
  { title: '💣 لعبة القنبلة', description: 'المشرف يبدأها بـ stg', id: 'g_bomb' },
  { title: '❌⭕ لعبة XO', description: 'لاعبين اثنين ضد بعض', id: 'g_xo' },
  { title: '🎯 مسابقة الايموجي', description: 'تفاعل بسرعة', id: 'g_emoji' },
];

const PAGES = {
  g_bomb: card('💣 لعبة القنبلة',['🔹 *stg* ← بدء اللعبة','🔹 *stop* ← إيقافها'],'البوت بيمنشن شخص عشوائي، وعليه يمنشن غيره قبل العد لـ 3 وإلا بينطرد.\nآخر واحد هو الفائز. لازم البوت مشرف.'),
  g_xo: card('❌⭕ لعبة XO',['🔹 *xo @منشن* ← تحدي','🔹 *قبول* / *رفض*','🔹 *xo stop* ← إنهاء'],'لاعبين اثنين، كل واحد يكتب رقم 1-9 بدوره.'),
  g_emoji: card('🎯 مسابقة الايموجي',['🔹 *ايموجي* ← بدء (للمشرفين)','🔹 *ايموجي stop* ← إيقاف'],'أول واحد يتفاعل بنفس الايموجي بياخد نقطة. أول من يوصل 3 يفوز.'),
  sec_points: card('🏆 النقاط',['🔹 *ترتيب* ← أفضل 10','🔹 *نقاطي* ← بطاقتك','🔹 *تصفير النقاط* ← للمشرفين'],`الفوز يعطيك نقاط:\n💣 +5 • 🎯 +4\n❌⭕ +3 • 🏅 +10`),
  sec_tools: card('🛠️ أوامر',['🔹 *!ping*','🔹 *!say نص*','🔹 *لست*','🔹 *فتح* ← بالرد على صورة مرة واحدة']),
};

function textMenu(){ return MENU_BODY + '\n\n' + Object.values(PAGES).join('\n\n'); }

async function sendList(sock, from, quoted, body, rows, fallbackText) {
  const buttons = [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📂 اختر من هنا', sections: [{ title: 'القائمة', rows }] }) }];
  try {
    const msg = generateWAMessageFromContent(from, { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: proto.Message.InteractiveMessage.create({ body: { text: body }, footer: { text: 'Rodo 🌹' }, nativeFlowMessage: { buttons } }) } } }, { userJid: sock.user.id, quoted });
    await sock.relayMessage(from, msg.message, { messageId: msg.key.id, additionalNodes: [{ tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }] });
  } catch (e) { await sock.sendMessage(from, { text: fallbackText }, { quoted }); }
}

const voCache = new Map();
function cacheViewOnce(m) {
  const mm = m.message; if (!mm || m.key.fromMe) return;
  const inner = mm.viewOnceMessageV2?.message || mm.viewOnceMessageV2Extension?.message || mm.viewOnceMessage?.message || ((mm.imageMessage?.viewOnce || mm.videoMessage?.viewOnce || mm.audioMessage?.viewOnce)? mm : null);
  if (!inner) return; if (!['imageMessage','videoMessage','audioMessage'].some((t) => inner[t])) return;
  voCache.set(m.key.id, { key: m.key, message: inner, t: Date.now() });
}

function makeNorm(meta) {
  const map = new Map();
  for (const p of meta.participants) { for (const x of [p.id, p.lid, p.phoneNumber, p.jid]) { if (x) map.set(jidNormalizedUser(x), p.id); } }
  return (jid) => { if (!jid) return ''; const n = jidNormalizedUser(jid); return map.get(n) || n; };
}
function selfJid(sock, norm, meta) {
  const ids = new Set(meta.participants.map((p) => p.id));
  const cands = [sock.user?.id, sock.user?.lid].filter(Boolean).map(norm);
  return cands.find((c) => ids.has(c)) || cands[0] || '';
}
async function groupCtx(sock, m, from) {
  const meta = await sock.groupMetadata(from);
  const norm = makeNorm(meta);
  const self = selfJid(sock, norm, meta);
  const sender = m.key.fromMe? self : norm(m.key.participant);
  const admins = new Set(meta.participants.filter((p) => p.admin).map((p) => p.id));
  return { meta, norm, self, sender, isAdmin: m.key.fromMe || admins.has(sender), botAdmin: admins.has(self) };
}

// ===== تشغيل البوت =====
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr){ lastQR = qr; console.log('QR generated'); }
    if(connection==='close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      isConnected = false;
      console.log('Connection closed', lastDisconnect?.error);
      if(shouldReconnect) startBot();
    } else if(connection==='open'){
      isConnected = true; lastQR = null;
      console.log('Connected ✅');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages })=>{
    for(const m of messages){
      cacheViewOnce(m);
      if(m.key.fromMe) continue;
      const from = m.key.remoteJid;
      if(!from) continue;
      const isGroup = from.endsWith('@g.us');
      const type = Object.keys(m.message || {})[0];
      const body = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '';
      const clean = body.trim().toLowerCase();
      const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const ctx = m.message?.extendedTextMessage?.contextInfo;

      // أوامر أساسية
      if(clean === 'لست' || clean === '!menu' || clean === 'menu'){
        await sendList(sock, from, m, MENU_BODY, MAIN_ROWS, textMenu());
        continue;
      }
      if(clean === '!ping' || clean === 'ping'){
        await sock.sendMessage(from, { text: '🏓 pong! Rodo شغال فخم ✅🌹' }, { quoted: m });
        continue;
      }
      if(clean.startsWith('!say ')){
        await sock.sendMessage(from, { text: body.slice(5) }, { quoted: m });
        continue;
      }
      if(clean === 'رودو'){
        await sock.sendMessage(from, { text: 'نعم يا قلب رودو؟ 🌹' }, { quoted: m });
        continue;
      }
      if(clean.startsWith('نقاطي') || clean.startsWith('ترتيب')){
        const key = `${from}:${m.key.participant}`;
        const pts = pointsDB.get(key) || 0;
        await sock.sendMessage(from, { text: card('🏆 نقاطك', [`${tag(m.key.participant)}: ${pts} نقطة`], '', true), mentions: [m.key.participant] }, { quoted: m });
        continue;
      }
      if(clean === 'فتح' && ctx?.quotedMessage){
         // فتح مرة واحدة (مختصر)
         try{
           const q = ctx.quotedMessage;
           const inner = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message || q;
           const t = ['imageMessage','videoMessage'].find(x=>inner[x]);
           if(!t) continue;
           const buffer = await downloadMediaMessage({ key: { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant }, message: inner }, 'buffer', {}, { logger: pino({level:'silent'}), reuploadRequest: sock.updateMediaMessage });
           if(t==='imageMessage') await sock.sendMessage(from, { image: buffer, caption: '✅ تم الفتح' }, { quoted: m });
           else await sock.sendMessage(from, { video: buffer, caption: '✅ تم الفتح' }, { quoted: m });
         }catch(e){ console.log(e); }
         continue;
      }

      // أمر ايموجي
      if(clean.startsWith('ايموجي') && isGroup){
        // استدعاء سريع للمسابقة
        const c = await groupCtx(sock, m, from);
        if(!c.isAdmin) continue;
        if(clean.includes('stop')){ const g=emojiGames.get(from); if(g){ g.stopped=true; if(g.cur){clearTimeout(g.cur.timer); g.cur.resolve(null);} } await sock.sendMessage(from,{text:'تم إيقاف الايموجي 🛑'}); continue; }
        if(emojiGames.has(from)){ await sock.sendMessage(from,{text:'في مسابقة شغالة'}); continue; }
        if(!c.botAdmin){ await sock.sendMessage(from,{text:'لازم البوت مشرف'}); continue; }
        // بدء
        const game = { points: new Map(), round:0, cur:null, stopped:false, norm:c.norm, self:c.self };
        emojiGames.set(from, game);
        (async()=>{
          try{
            await sock.groupSettingUpdate(from,'announcement');
            const meta = await sock.groupMetadata(from);
            await sock.sendMessage(from,{text:`『 *مسابقة الايموجي* 🎮 』\n- تم قفل الشات 🔒\n- أول من يتفاعل بنفس الايموجي يفوز بنقطة\n- أول من يوصل ${EMOJI_WIN} يفوز 🏆`, mentions: meta.participants.map(p=>p.id)});
            await sleep(4000);
            let last=''; let winner=null;
            while(!game.stopped && game.round<EMOJI_MAX_ROUNDS &&!winner){
              game.round++;
              let emoji = pick(EMOJIS); while(emoji===last) emoji=pick(EMOJIS); last=emoji;
              const sent = await sock.sendMessage(from,{text:`*🎯 الجولة ${game.round}*\nتفاعل بسرعة:\n\n${emoji} ${emoji} ${emoji}`});
              const who = await new Promise((resolve)=>{
                game.cur={id:sent.key.id, emoji: emoji.replace(/\uFE0F/g,''), resolve, timer:setTimeout(()=>{game.cur=null; resolve(null);},EMOJI_ROUND_TIME)};
              });
              game.cur=null; if(game.stopped) break;
              if(!who){ await sock.sendMessage(from,{text:'⏰ ما حدا تفاعل'}); await sleep(2000); continue; }
              const pts=(game.points.get(who)||0)+1; game.points.set(who,pts);
              if(pts>=EMOJI_WIN){ winner=who; break; }
              await sock.sendMessage(from,{text:`✅ ${tag(who)} أخذ نقطة!\n`+[...game.points.entries()].map(([j,p])=>`• ${tag(j)}: ${p}/${EMOJI_WIN}`).join('\n'), mentions:[...game.points.keys()]});
              await sleep(2000);
            }
            if(winner){ const er=addPoints(from,winner,'emoji'); await sock.sendMessage(from,{text:`✦⊰ *مبروك* ${tag(winner)} ⊱\nفزت بالايموجي 🏆\n${pointsLine(er)}`, mentions:[winner]}); }
            await sock.groupSettingUpdate(from,'not_announcement');
            emojiGames.delete(from);
          }catch(e){ console.log(e); try{await sock.groupSettingUpdate(from,'not_announcement');}catch{} emojiGames.delete(from); }
        })();
        continue;
      }

      // أمر stg قنبلة مبسط
      if((clean==='stg' || clean==='قنبلة') && isGroup){
        const c = await groupCtx(sock, m, from);
        if(!c.isAdmin){ continue; }
        if(!c.botAdmin){ await sock.sendMessage(from,{text:'لازم البوت مشرف'}); continue; }
        if(games.has(from)){ await sock.sendMessage(from,{text:'في قنبلة شغالة'}); continue; }
        const meta = await sock.groupMetadata(from);
        let players = shuffle(meta.participants.map(p=>p.id)).slice(0,MAX_PLAYERS);
        games.set(from,{players, active:true});
        await sock.sendMessage(from,{text:`💣 *بدأت لعبة القنبلة*\nاللاعبين: ${players.map(tag).join(' ')}\n\nالقنبلة عند: ${tag(players[0])}\nمنشن شخص قبل 3 ثواني وإلا تنطرد!`, mentions: players});
        // لعبة مبسطة - الرد بالمنشن
        continue;
      }

      // XO مبسط
      if(clean.startsWith('xo') && isGroup){
        await sock.sendMessage(from,{text:'❌⭕ اكتب xo @منشن للتحدي (النسخة الكاملة قيد التطوير، هسا شغال ping و ايموجي و قنبلة)'});
        continue;
      }
    }
  });

  // تفاعلات ايموجي
  sock.ev.on('messages.reaction', async (reactions)=>{
    for(const r of reactions){
      const from = r.key.remoteJid;
      const g = emojiGames.get(from);
      if(!g ||!g.cur) continue;
      if(r.key.id!== g.cur.id) continue;
      if((r.text||'').replace(/\uFE0F/g,'')!== g.cur.emoji) continue;
      const meta = await sock.groupMetadata(from).catch(()=>null);
      if(!meta) continue;
      const norm = makeNorm(meta);
      const who = norm(r.key.participant);
      const cur = g.cur; g.cur=null; clearTimeout(cur.timer); cur.resolve(who);
    }
  });
}

startBot();
