require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(uploadDir));
app.use(express.json({ limit: '15mb' }));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`);
    }
});
const upload = multer({ storage });

const User = require('./models/User'); // Büyük U ile!
const friendshipSchema = new mongoose.Schema({ gonderen: String, alan: String, durum: String }, { timestamps: true });
const Friendship = mongoose.model('Friendship', friendshipSchema);

const messageSchema = new mongoose.Schema({
    from: String, fromNickname: String, toEposta: String, toNickname: String, text: String, image: String, time: String
}, { timestamps: true });
messageSchema.index({ toNickname: 1, fromNickname: 1 });
const Message = mongoose.model('Message', messageSchema);

mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB Bağlı! 🚀"));

// --- ROTALAR ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'login.html')));

app.post('/kayit', async (req, res) => { /* Aynı kodun */ res.json({ success: true }); });
app.post('/giris', async (req, res) => { /* Aynı kodun */ res.json({ success: true }); });

app.get('/api/mesajlar-v2/:benEposta/:arkadasNickname', async (req, res) => {
    try {
        const { benEposta, arkadasNickname } = req.params;
        const ozelKonusma = await Message.find({ $or: [{ from: benEposta, toNickname: arkadasNickname }, { fromNickname: arkadasNickname, toNickname: benEposta }] }).sort({ createdAt: -1 }).limit(50);
        res.json(ozelKonusma.reverse());
    } catch (e) { res.json([]); }
});

app.post('/api/mesaj-gonder-v2', upload.single('messageImage'), async (req, res) => {
    try {
        const { fromEposta, toNickname, text } = req.body;
        const yeniMesaj = new Message({ from: fromEposta, toNickname, text, image: req.file ? `/uploads/${req.file.filename}` : '' });
        await yeniMesaj.save();
        res.json({ success: true, yeniMesaj });
    } catch (e) { res.json({ success: false }); }
});

// HATA YÖNETİMİ (En sona)
app.use((err, req, res, next) => {
    res.status(500).json({ success: false, mesaj: "Sunucu hatası" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Sunucu aktif!`));