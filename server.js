require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// FRONTEND klasörünü kesin bir şekilde tanımlıyoruz
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(uploadDir));
app.use(express.json({ limit: '15mb' }));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, safeName);
    }
});

const fileFilter = (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Sadece resim dosyaları kabul edilir.'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 6 * 1024 * 1024 }
});

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Kök dizine (/) gidilince login.html'i zorla açmasını söylüyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// --- MONGODB BAĞLANTISI ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB veritabanına başarıyla bağlanıldı! 🚀"))
  .catch((err) => console.log("Veritabanı bağlantı hatası:", err));

// --- VERİTABANI MODELLERİ (JSON Yerine Bunları Kullanacağız) ---

// 1. Kullanıcı Modeli (Senin oluşturduğun models/User.js dosyasından çekiyoruz)
const User = require('./models/user'); 

// 2. Arkadaşlık Modeli (Direkt burada tanımlıyoruz)
const friendshipSchema = new mongoose.Schema({
    gonderen: String, 
    alan: String,     
    durum: String     // 'beklemede' veya 'arkadaş'
}, { timestamps: true });
friendshipSchema.index({ gonderen: 1, alan: 1, durum: 1 });
friendshipSchema.index({ alan: 1, durum: 1 });
const Friendship = mongoose.model('Friendship', friendshipSchema);

// 3. Mesaj Modeli (Direkt burada tanımlıyoruz)
const messageSchema = new mongoose.Schema({
    from: String,
    fromNickname: String,
    toEposta: String,
    toNickname: String,
    text: String,
    image: { type: String, default: "" },
    time: String
}, { timestamps: true });

// Hızlandırıcı Index ekle:
messageSchema.index({ toNickname: 1, fromNickname: 1 });
messageSchema.index({ from: 1, toNickname: 1, createdAt: -1 });
messageSchema.index({ fromNickname: 1, toNickname: 1, createdAt: -1 });
const Message = mongoose.model('Message', messageSchema);

// --- ENDPOINT'LER ---

// Kullanıcı Kaydı
app.post('/kayit', async (req, res) => {
    try {
        const nickname = (req.body?.nickname || '').trim();
        const username = (req.body?.username || '').trim().toLowerCase();
        const password = (req.body?.password || '').trim();

        if (!nickname || !username || !password) {
            return res.json({ success: false, mesaj: "Lütfen tüm alanları doldurun! ⚠️" });
        }

        // E-posta kontrolü
        const emailVarMi = await User.findOne({ username: username });
        if (emailVarMi) {
            return res.json({ success: false, mesaj: "Bu e-posta zaten kayıtlı! ❌" });
        }

        // Nickname kontrolü (Büyük/küçük harf duyarsız arama)
        const nickVarMi = await User.findOne({ nickname: { $regex: new RegExp(`^${escapeRegex(nickname)}$`, "i") } });
        if (nickVarMi) {
            return res.json({ success: false, mesaj: "Bu kullanıcı adı zaten alınmış! ❌" });
        }

        const yeniKullanici = new User({ nickname, username, password, avatar: "", status: "" });
        await yeniKullanici.save(); // Veritabanına kaydet
        
        res.json({ success: true, mesaj: "Kayıt başarıyla oluşturuldu! 🎉" });
    } catch (error) {
        console.log("Kayıt Hatası:", error);
        res.json({ success: false, mesaj: "Sunucu hatası oluştu!" });
    }
});

// Giriş
app.post('/giris', async (req, res) => {
    try {
        const username = (req.body?.username || '').trim().toLowerCase();
        const password = (req.body?.password || '').trim();

        if (!username || !password) {
            return res.json({ success: false, mesaj: "E-posta ve şifre zorunludur! ⚠️" });
        }

        // Veritabanında e-posta ve şifresi eşleşen kullanıcıyı bul
        const bulunan = await User.findOne({ username: username, password: password });

        if (bulunan) {
            res.json({ success: true, mesaj: "Giriş Başarılı! 🚀", username: bulunan.username });
        } else {
            res.json({ success: false, mesaj: "E-posta veya şifre hatalı! ❌" });
        }
    } catch (error) {
        console.log("Giriş Hatası:", error);
        res.json({ success: false, mesaj: "Sunucu hatası oluştu!" });
    }
});

// Profil Getirme
app.get('/api/profil-getir/:eposta', async (req, res) => {
    try {
        const { eposta } = req.params;
        const kullanici = await User.findOne({ username: eposta });
        
        if (kullanici) {
            res.json({ nickname: kullanici.nickname, avatar: kullanici.avatar || "", status: kullanici.status || "" });
        } else {
            res.json({ nickname: eposta.split('@')[0], avatar: "", status: "" });
        }
    } catch (error) {
        res.json({ nickname: req.params.eposta.split('@')[0], avatar: "", status: "" });
    }
});

function uploadedFileUrl(file) {
    return file ? `/uploads/${file.filename}` : '';
}

// Profil Güncelleme
app.post('/api/profil-guncelle', upload.single('avatarImage'), async (req, res) => {
    try {
        const { eposta, status, nickname, password } = req.body;
        const avatar = uploadedFileUrl(req.file) || req.body.avatar || '';
        const kullanici = await User.findOne({ username: eposta });

        if (kullanici) {
            const eskiNickname = kullanici.nickname || eposta.split('@')[0];
            const yeniNickname = (nickname || eskiNickname).trim();
            const nicknameDegisti = yeniNickname !== eskiNickname;

            if (!yeniNickname) return res.json({ success: false, mesaj: "Kullanıcı adı boş bırakılamaz!" });

            // Nickname başkası tarafından alınmış mı?
            if (nicknameDegisti) {
                const nickAlinmis = await User.findOne({ 
                    nickname: { $regex: new RegExp(`^${escapeRegex(yeniNickname)}$`, "i") },
                    username: { $ne: eposta } // Kendisi hariç
                });
                if (nickAlinmis) return res.json({ success: false, mesaj: "Bu kullanıcı adı zaten alınmış! ❌" });

                if ((kullanici.password || '').trim() !== (password || '').trim()) {
                    return res.json({ success: false, mesaj: "Şifre hatalı, kullanıcı adı değiştirilemedi! ❌" });
                }
            }

            // Kullanıcıyı güncelle
            kullanici.nickname = yeniNickname;
            kullanici.status = (status || '').trim();
            if (typeof avatar === 'string' && avatar) kullanici.avatar = avatar;
            await kullanici.save();

            // Eğer nickname değiştiyse, arkadaşlıklardaki ve mesajlardaki eski nicknameleri de güncelle (MongoDB'nin gücü!)
            if (nicknameDegisti) {
                await Friendship.updateMany({ gonderen: eskiNickname }, { $set: { gonderen: yeniNickname } });
                await Friendship.updateMany({ alan: eskiNickname }, { $set: { alan: yeniNickname } });
                
                await Message.updateMany({ fromNickname: eskiNickname }, { $set: { fromNickname: yeniNickname } });
                await Message.updateMany({ toNickname: eskiNickname }, { $set: { toNickname: yeniNickname } });
            }

            res.json({ success: true, mesaj: "Profiliniz başarıyla güncellendi! 💾", nickname: yeniNickname });
        } else {
            res.json({ success: false, mesaj: "Kullanıcı bulunamadı!" });
        }
    } catch (error) {
        console.log("Profil Güncelleme Hatası:", error);
        res.json({ success: false, mesaj: "Sunucu hatası oluştu!" });
    }
});

// Arkadaş Ekleme
app.post('/api/arkadas-ekle', async (req, res) => {
    try {
        const { gonderenEposta, hedefNickname } = req.body;
        
        const ben = await User.findOne({ username: gonderenEposta });
        const hedef = await User.findOne({ nickname: { $regex: new RegExp(`^${escapeRegex(hedefNickname)}$`, "i") } });

        if (!hedef) return res.json({ success: false, mesaj: "Kullanıcı bulunamadı! ❌" });
        if (ben && ben.nickname === hedef.nickname) return res.json({ success: false, mesaj: "Kendini ekleyemezsin! 😅" });

        const gonderenNick = ben ? ben.nickname : gonderenEposta.split('@')[0];

        // Zaten arkadaş veya istek var mı kontrol et
        const varMi = await Friendship.findOne({
            $or: [
                { gonderen: gonderenNick, alan: hedef.nickname },
                { gonderen: hedef.nickname, alan: gonderenNick }
            ]
        });

        if (varMi) {
            return res.json({ success: false, mesaj: `Bu kullanıcıyla zaten bir bağınız var! Durum: ${varMi.durum}` });
        }

        const yeniArkadaslik = new Friendship({ gonderen: gonderenNick, alan: hedef.nickname, durum: 'beklemede' });
        await yeniArkadaslik.save();
        
        res.json({ success: true, mesaj: "Arkadaşlık isteği başarıyla gönderildi! 🔔" });
    } catch (error) {
        res.json({ success: false, mesaj: "Sunucu hatası!" });
    }
});

// KESİNTİSİZ ARKADAŞ LİSTESİ SORGULAMA
app.get('/api/arkadasliklar/:eposta', async (req, res) => {
    try {
        const { eposta } = req.params;
        const kullanici = await User.findOne({ username: eposta });
        const nick = kullanici ? kullanici.nickname : eposta.split('@')[0];

        // Bu kullanıcıyla ilgili tüm arkadaşlık kayıtlarını getir
        const arkadasliklar = await Friendship.find({
            $or: [{ gonderen: nick }, { alan: nick }]
        }).lean();

        const arkadasNickler = [];
        const gelenIstekler = [];

        for (const a of arkadasliklar) {
            if (a.durum === 'arkadaş') {
                const hedefNick = a.gonderen === nick ? a.alan : a.alan === nick ? a.gonderen : null;
                if (hedefNick) {
                    arkadasNickler.push(hedefNick);
                }
            } else if (a.durum === 'beklemede' && a.alan === nick) {
                gelenIstekler.push(a.gonderen);
            }
        }

        const arkadasDetaylari = arkadasNickler.length > 0
            ? await User.find({ nickname: { $in: arkadasNickler } }).select('nickname username avatar status').lean()
            : [];

        const arkadasMap = new Map(arkadasDetaylari.map(kullanici => [kullanici.nickname, kullanici]));
        const arkadaslarUzetleri = arkadasNickler.map(nickname => {
            const detay = arkadasMap.get(nickname);
            return {
                nickname,
                username: detay ? detay.username : "",
                avatar: detay ? detay.avatar : "",
                status: detay ? detay.status : ""
            };
        });

        res.json({ arkadaslar: arkadaslarUzetleri, gelenIstekler });
    } catch (error) {
        res.json({ arkadaslar: [], gelenIstekler: [] });
    }
});

// İsteğe Cevap Verme
app.post('/api/arkadas-yanitla', async (req, res) => {
    try {
        const { alanEposta, gonderenNickname, eylem } = req.body;
        
        const ben = await User.findOne({ username: alanEposta });
        const benNick = ben ? ben.nickname : alanEposta.split('@')[0];

        const arkadaslik = await Friendship.findOne({ gonderen: gonderenNickname, alan: benNick, durum: 'beklemede' });

        if (arkadaslik) {
            if (eylem === 'onayla') {
                arkadaslik.durum = 'arkadaş';
                await arkadaslik.save();
                res.json({ success: true, mesaj: "Artık arkadaşsınız! 🎉" });
            } else {
                await Friendship.findByIdAndDelete(arkadaslik._id); // İsteği tamamen sil
                res.json({ success: true, mesaj: "İstek reddedildi." });
            }
        } else {
            res.json({ success: false, mesaj: "İstek bulunamadı!" });
        }
    } catch (error) {
        res.json({ success: false, mesaj: "Sunucu hatası!" });
    }
});

// GÜVENLİ MESAJ ÇEKME
app.get('/api/mesajlar-v2/:benEposta/:arkadasEposta', async (req, res) => {
    try {
        const { benEposta, arkadasEposta } = req.params;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

        // Sadece iki e-posta arasındaki konuşmayı getir
        const ozelKonusma = await Message.find({
            $or: [
                { from: benEposta, toEposta: arkadasEposta },
                { from: arkadasEposta, toEposta: benEposta }
            ]
        })
            .select('from fromNickname toEposta toNickname text image time createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(); // En sonları getir

        res.json(ozelKonusma.reverse()); // Sırayı düzelt
    } catch (error) {
        res.json([]);
    }
});

// Güvenli Mesaj Gönderme
// Güvenli Mesaj Gönderme (BU KISMI KOPYALAYIP ESKİSİYLE DEĞİŞTİR)
// --- Güvenli Mesaj Gönderme ---
app.post('/api/mesaj-gonder-v2', upload.single('messageImage'), async (req, res) => {
    try {
        const { fromEposta, toNickname, toEposta: hedefEposta, text } = req.body;
        const image = uploadedFileUrl(req.file) || req.body.image || '';
        
        const ben = await User.findOne({ username: fromEposta });
        const alici = hedefEposta ? await User.findOne({ username: hedefEposta }) : await User.findOne({ nickname: toNickname });
        const aliciEposta = alici ? alici.username : (hedefEposta || '');

        const yeniMesaj = new Message({
            from: fromEposta,
            fromNickname: ben ? ben.nickname : fromEposta.split('@')[0],
            toEposta: aliciEposta,
            toNickname: alici ? alici.nickname : toNickname,
            text: text || "",
            image: typeof image === 'string' ? image : "",
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });

        await yeniMesaj.save();
        res.json({ success: true, yeniMesaj });
    } catch (error) {
        console.error("Mesaj gönderilemedi:", error);
        res.json({ success: false, mesaj: "Mesaj gönderilemedi!" });
    }
}); // <--- Mesaj gönderme fonksiyonu burada düzgünce biter.

// --- Hata Yönetimi (Bu bloğu yukarıdaki app.post'un DIŞINA çıkardık) ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.json({ success: false, mesaj: 'Resim boyutu çok büyük (En fazla 6MB).' });
        }
        return res.json({ success: false, mesaj: 'Dosya yükleme hatası.' });
    }
    if (err) {
        return res.json({ success: false, mesaj: err.message || 'Beklenmeyen bir hata oluştu.' });
    }
    next();
});

// PORT ayarların en altta kalmaya devam edecek
const PORT = 3000;
app.listen(PORT, () => console.log(`\n🚀 Sunucu http://localhost:${PORT} adresinde aktif!`));