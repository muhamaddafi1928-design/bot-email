const TelegramBot = require("node-telegram-bot-api");
const nodemailer = require("nodemailer");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// ================= DATABASE =================
let db = { userSenders: {} };

if (fs.existsSync("data.json")) {
  db = JSON.parse(fs.readFileSync("data.json"));
}

function saveDB() {
  fs.writeFileSync("data.json", JSON.stringify(db, null, 2));
}

// ================= STATE =================
let state = {};

// ================= VALIDASI =================
function isValidGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

// ================= CEK EMAIL =================
async function checkEmail(email, password) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000)
      )
    ]);

    return true;
  } catch (err) {
    return false;
  }
}

// ================= START =================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `🔥 SHUU FIX MERAH BOT

⚡️ Fix nomor WhatsApp otomatis
🚀 Multi sender system
📩 Kirim langsung ke support

Pilih menu di bawah:`,
    {
      reply_markup: {
        keyboard: [
          ["📤 Tambah Sender", "📋 List Sender"],
          ["🗑 Hapus Sender", "⚙️ Pilih Sender"],
          ["📩 Fix Nomor"]
        ],
        resize_keyboard: true
      }
    }
  );
});

// ================= MENU =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!state[chatId]) state[chatId] = {};

  // ================= TAMBAH SENDER =================
  if (text === "📤 Tambah Sender") {
    state[chatId] = { step: "email" };
    return bot.sendMessage(chatId, "📧 Masukkan email Gmail:");
  }

  // STEP EMAIL
  if (state[chatId].step === "email") {
    if (!isValidGmail(text)) {
      return bot.sendMessage(chatId, "❌ Harus email @gmail.com");
    }

    state[chatId].email = text;
    state[chatId].step = "password";
    return bot.sendMessage(chatId, "🔑 Masukkan App Password:");
  }

  // STEP PASSWORD
  if (state[chatId].step === "password") {
    const email = state[chatId].email;
    const password = text;

    bot.sendMessage(chatId, "⏳ Mengecek email... (max 10 detik)");

    const valid = await checkEmail(email, password);

    if (!valid) {
      state[chatId] = {};
      return bot.sendMessage(
        chatId,
        "❌ Email / App Password salah atau timeout"
      );
    }

    if (!db.userSenders[chatId]) db.userSenders[chatId] = [];

    db.userSenders[chatId].push({ email, password });
    saveDB();

    state[chatId] = {};

    return bot.sendMessage(chatId, "✅ Sender berhasil ditambahkan");
  }

  // ================= LIST =================
  if (text === "📋 List Sender") {
    const list = db.userSenders[chatId] || [];

    if (list.length === 0) {
      return bot.sendMessage(chatId, "❌ Belum ada sender");
    }

    let msgText = "📋 List Sender:\n\n";
    list.forEach((s, i) => {
      msgText += ${i + 1}. ${s.email}\n;
    });

    return bot.sendMessage(chatId, msgText);
  }

  // ================= HAPUS =================
  if (text === "🗑 Hapus Sender") {
    db.userSenders[chatId] = [];
    saveDB();
    return bot.sendMessage(chatId, "🗑 Semua sender dihapus");
  }
});
