const TelegramBot = require("node-telegram-bot-api");
const nodemailer = require("nodemailer");
const fs = require("fs");

const TOKEN = process.env.TOKEN; // 
const bot = new TelegramBot(TOKEN, { polling: true });

// ===== DATABASE =====
let db = { userSenders: {} };

if (fs.existsSync("data.json")) {
  db = JSON.parse(fs.readFileSync("data.json"));
}

function saveDB() {
  fs.writeFileSync("data.json", JSON.stringify(db, null, 2));
}

// ===== STATE =====
let state = {};
let activeSender = {};

// ===== START =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🔥 SHUU FIX MERAH BOT

⚡ Fix nomor WhatsApp otomatis
🚀 Multi sender system
📩 Kirim langsung ke support

━━━━━━━━━━━━━━━
Pilih menu di bawah:`,
{
  reply_markup: {
    inline_keyboard: [
      [
        { text: "📤 Tambah Sender", callback_data: "add" },
        { text: "📋 List Sender", callback_data: "list" }
      ],
      [
        { text: "🗑 Hapus Sender", callback_data: "delete_menu" },
        { text: "⚙️ Pilih Sender", callback_data: "select_menu" }
      ],
      [
        { text: "📨 Fix Nomor", callback_data: "fix" }
      ]
    ]
  }
});
});

// ===== CALLBACK =====
bot.on("callback_query", (q) => {
  const id = q.message.chat.id;
  const data = q.data;

  if (data === "add") {
    state[id] = { step: "email" };
    return bot.sendMessage(id, "📧 Masukkan email Gmail:");
  }

  if (data === "list") {
    const list = db.userSenders[id];
    if (!list || list.length === 0) {
      return bot.sendMessage(id, "⚠️ Belum ada sender");
    }

    let text = "📋 Sender kamu:\n\n";
    list.forEach((s,i)=> text += `${i+1}. ${s.email}\n`);
    return bot.sendMessage(id, text);
  }

  if (data === "delete_menu") {
    const list = db.userSenders[id];
    if (!list || list.length === 0) return bot.sendMessage(id, "Kosong");

    let btn = list.map((s,i)=>[
      { text: `❌ ${s.email}`, callback_data: `delete_${i}` }
    ]);

    return bot.sendMessage(id, "Pilih yang mau dihapus:", {
      reply_markup:{ inline_keyboard: btn }
    });
  }

  if (data === "select_menu") {
    const list = db.userSenders[id];
    if (!list || list.length === 0) return bot.sendMessage(id, "Kosong");

    let btn = list.map((s,i)=>[
      { text: `${s.email}`, callback_data: `select_${i}` }
    ]);

    return bot.sendMessage(id, "Pilih sender:", {
      reply_markup:{ inline_keyboard: btn }
    });
  }

  if (data.startsWith("delete_")) {
    const i = data.split("_")[1];
    db.userSenders[id].splice(i,1);
    saveDB();
    return bot.sendMessage(id, "🗑 Sender dihapus");
  }

  if (data.startsWith("select_")) {
    const i = data.split("_")[1];
    activeSender[id] = i;
    return bot.sendMessage(id, "✅ Sender dipilih");
  }

  if (data === "fix") {
    state[id] = { step: "fix" };
    return bot.sendMessage(id, "📱 Masukkan nomor (+62xxx):");
  }

  bot.answerCallbackQuery(q.id);
});

// ===== FLOW =====
bot.on("message", async (msg) => {
  const id = msg.chat.id;
  const text = msg.text;

  if (!state[id]) return;

  // EMAIL VALIDASI
  if (state[id].step === "email") {
    if (!text.endsWith("@gmail.com")) {
      return bot.sendMessage(id, "❌ Hanya email @gmail.com yang diizinkan");
    }

    state[id].email = text;
    state[id].step = "pass";
    return bot.sendMessage(id, "🔑 Masukkan app password:");
  }

  // PASSWORD + VALIDASI SMTP
  if (state[id].step === "pass") {
    const email = state[id].email;
    const pass = text;

    const progress = await bot.sendMessage(id, "⏳ Mengecek email...");

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: email, pass: pass }
      });

      await transporter.verify();

      if (!db.userSenders[id]) db.userSenders[id] = [];

      db.userSenders[id].push({ email, pass });
      saveDB();

      delete state[id];

      return bot.editMessageText(
        "✅ Email valid & sender berhasil ditambahkan",
        {
          chat_id: id,
          message_id: progress.message_id
        }
      );

    } catch {
      delete state[id];

      return bot.editMessageText(
        "❌ Email / App Password salah",
        {
          chat_id: id,
          message_id: progress.message_id
        }
      );
    }
  }

  // FIX
  if (state[id].step === "fix") {
    const list = db.userSenders[id];
    if (!list || list.length === 0) {
      delete state[id];
      return bot.sendMessage(id, "❌ Tambah sender dulu");
    }

    const sender = list[activeSender[id] || 0];

    const progress = await bot.sendMessage(id, "⏳ Mengirim...");

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: sender.email, pass: sender.pass }
      });

      await transporter.sendMail({
        from: sender.email,
        to: "support@support.whatsapp.com",
        subject: "Appeal",
        text: `Number: ${text}`
      });

      await bot.editMessageText(
        `✅ Fix berhasil dikirim!\n📧 ${sender.email}`,
        { chat_id: id, message_id: progress.message_id }
      );

    } catch {
      await bot.editMessageText(
        "❌ Gagal kirim",
        { chat_id: id, message_id: progress.message_id }
      );
    }

    delete state[id];
  }
});
