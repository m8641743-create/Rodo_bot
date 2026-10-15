const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req,res)=>{
  res.send('🤖 Rodo_bot شغال فخم - بوت اوامر واتساب فخم');
});

app.listen(PORT, ()=> console.log('Server running on '+PORT));

// هنا كود البوت بتاعك
console.log('Rodo_bot Started Successfully ✅');
