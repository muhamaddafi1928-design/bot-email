const TelegramBot = require("node-telegram-bot-api");
const nodemailer = require("nodemailer");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("TOKEN BOT GA ADA!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ================= DATABASE =================
let db = { userSenders: {} };

if (fs.existsSync("data.json")) {
  try {
    db = JSON.parse(fs.readFileSync("data.json"));
  } catch {
    db = { userSenders: {} };
  }
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
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000
    });

    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000)
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

  state[chatId] = { step: null };

  bot.sendMessage(
    chatId,
    `🔥 SHUU FIX MERAH BOT

⚡ Multi sender system
📩 Kirim langsung

Pilih menu:`,
    {
      reply_markup: {
        keyboard: [
          ["📤 Tambah Sender", "📋 List Sender"],
          ["🗑 Hapus Sender", "❌ Cancel"]
        ],
        resize_keyboard: true
      }
    }
  );
});

// ================= MAIN HANDLER =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  if (!state[chatId]) state[chatId] = { step: null };

  const userState = state[chatId];

  // ================= CANCEL =================
  if (text === "❌ Cancel") {
    state[chatId] = { step: null };
    return bot.sendMessage(chatId, "❌ Dibatalkan");
  }

  // ================= MENU =================
  if (text === "📤 Tambah Sender") {
    state[chatId] = { step: "email" };
    return bot.sendMessage(chatId, "📧 Masukkan email Gmail:");
  }

  if (text === "📋 List Sender") {
    const list = db.userSenders[chatId] || [];

    if (list.length === 0) {
      return bot.sendMessage(chatId, "❌ Belum ada sender");
    }

    let msgText = "📋 List Sender:\n\n";
    list.forEach((s, i) => {
      msgText += `${i + 1}. ${s.email}\n`;
    });

    return bot.sendMessage(chatId, msgText);
  }

  if (text === "🗑 Hapus Sender") {
    db.userSenders[chatId] = [];
    saveDB();
    return bot.sendMessage(chatId, "🗑 Semua sender dihapus");
  }

  // ================= FLOW =================
  if (userState.step === "email") {
    if (!isValidGmail(text)) {
      return bot.sendMessage(chatId, "❌ Harus email @gmail.com");
    }

    userState.email = text;
    userState.step = "password";

    return bot.sendMessage(chatId, "🔑 Masukkan App Password:");
  }

  if (userState.step === "password") {
    const email = userState.email;
    const password = text;

    bot.sendMessage(chatId, "⏳ Checking email (15 detik max)...");

    const valid = await checkEmail(email, password);

    if (!valid) {
      state[chatId] = { step: null };
      return bot.sendMessage(chatId, "❌ Email / Password salah / timeout");
    }

    if (!db.userSenders[chatId]) db.userSenders[chatId] = [];

    db.userSenders[chatId].push({ email, password });
    saveDB();

    state[chatId] = { step: null };

    return bot.sendMessage(chatId, "✅ Sender berhasil ditambahkan");
  }

});
