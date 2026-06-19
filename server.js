const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

require('dotenv').config();
if (!process.env.MONGO_URI) {
    require('dotenv').config({ path: path.join(__dirname, '.gitignore', '.env') });
}

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

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    creatorEposta: { type: String, required: true },
    memberEpostalar: { type: [String], default: [] },
    memberRoller: { type: Object, default: {} },
    mutedMemberEpostalar: { type: [String], default: [] }
}, { timestamps: true });
groupSchema.index({ memberEpostalar: 1, updatedAt: -1 });
const Group = mongoose.model('Group', groupSchema);

const groupMessageSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    from: String,
    fromNickname: String,
    text: String,
    image: { type: String, default: '' },
    time: String
}, { timestamps: true });
groupMessageSchema.index({ groupId: 1, createdAt: -1 });
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

const notificationSchema = new mongoose.Schema({
    recipientEposta: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: String,
    body: String,
    fromEposta: String,
    fromNickname: String,
    groupId: String,
    groupName: String,
    messageId: String,
    read: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null }
}, { timestamps: true });
notificationSchema.index({ recipientEposta: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientEposta: 1, deliveredAt: 1 });
const UserNotification = mongoose.model('Notification', notificationSchema);

async function resolveUserEmailsFromTokens(tokens, creatorEposta) {
    const epostalar = new Set();
    if (creatorEposta) {
        epostalar.add(creatorEposta);
    }

    for (const rawToken of tokens) {
        const token = String(rawToken || '').trim();
        if (!token) continue;

        const lowerToken = token.toLowerCase();
        let kullanici = null;

        if (lowerToken.includes('@')) {
            kullanici = await User.findOne({ username: lowerToken }).select('username').lean();
        }

        if (!kullanici) {
            kullanici = await User.findOne({ nickname: { $regex: new RegExp(`^${escapeRegex(token)}$`, 'i') } }).select('username').lean();
        }

        if (!kullanici && !lowerToken.includes('@')) {
            kullanici = await User.findOne({ username: lowerToken }).select('username').lean();
        }

        if (!kullanici) {
            return { success: false, mesaj: `Üye bulunamadı: ${token}` };
        }

        epostalar.add(kullanici.username);
    }

    return { success: true, epostalar: Array.from(epostalar) };
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function getGroupMemberRole(group, eposta) {
    const email = normalizeEmail(eposta);
    if (!group || !email) return 'uye';
    if (normalizeEmail(group.creatorEposta) === email) return 'yonetici';

    const roller = group.memberRoller && typeof group.memberRoller === 'object' ? group.memberRoller : {};
    return roller[email] || 'uye';
}

function canManageRoles(role) {
    return role === 'yonetici';
}

function canManageMute(role) {
    return role === 'yonetici' || role === 'yardimci';
}

function groupMemberSnapshot(group, user) {
    const email = normalizeEmail(user?.username || user?.email || user?.eposta || '');
    const role = getGroupMemberRole(group, email);

    return {
        eposta: email,
        nickname: user ? user.nickname : email.split('@')[0],
        avatar: user ? user.avatar || '' : '',
        role,
        muted: Array.isArray(group?.mutedMemberEpostalar) ? group.mutedMemberEpostalar.includes(email) : false
    };
}

async function loadGroupWithDefaults(groupId) {
    const group = await Group.findById(groupId);
    if (!group) return null;

    let changed = false;
    const memberSet = new Set(Array.isArray(group.memberEpostalar) ? group.memberEpostalar.map(normalizeEmail).filter(Boolean) : []);
    const roller = group.memberRoller && typeof group.memberRoller === 'object' ? { ...group.memberRoller } : {};
    const mutedSet = new Set(Array.isArray(group.mutedMemberEpostalar) ? group.mutedMemberEpostalar.map(normalizeEmail).filter(Boolean) : []);

    if (normalizeEmail(group.creatorEposta)) {
        memberSet.add(normalizeEmail(group.creatorEposta));
        if (roller[normalizeEmail(group.creatorEposta)] !== 'yonetici') {
            roller[normalizeEmail(group.creatorEposta)] = 'yonetici';
            changed = true;
        }
    }

    for (const email of memberSet) {
        if (!roller[email]) {
            roller[email] = email === normalizeEmail(group.creatorEposta) ? 'yonetici' : 'uye';
            changed = true;
        }
    }

    for (const email of Object.keys(roller)) {
        if (!memberSet.has(normalizeEmail(email))) {
            delete roller[email];
            changed = true;
        }
    }

    for (const email of Array.from(mutedSet)) {
        if (!memberSet.has(email)) {
            mutedSet.delete(email);
            changed = true;
        }
    }

    const currentMembers = Array.from(memberSet);
    if (JSON.stringify(currentMembers.sort()) !== JSON.stringify([...(group.memberEpostalar || [])].map(normalizeEmail).filter(Boolean).sort())) {
        group.memberEpostalar = currentMembers;
        changed = true;
    }

    group.memberRoller = roller;
    group.mutedMemberEpostalar = Array.from(mutedSet);

    if (changed) {
        await group.save();
    }

    return group;
}

async function loadGroupAccessContext(groupId, userEposta) {
    const group = await loadGroupWithDefaults(groupId);
    if (!group) return null;

    const email = normalizeEmail(userEposta);
    if (!group.memberEpostalar.includes(email)) {
        return null;
    }

    const role = getGroupMemberRole(group, email);
    return { group, role, canManageRoles: canManageRoles(role), canManageMute: canManageMute(role) };
}

async function resolveGroupMemberEmails(groupId) {
    const grup = await Group.findById(groupId).select('memberEpostalar creatorEposta name').lean();
    if (!grup) {
        return { success: false, mesaj: 'Grup bulunamadı.' };
    }

    return { success: true, grup };
}

async function resolveUserEmail(token) {
    const deger = String(token || '').trim();
    if (!deger) {
        return null;
    }

    const lower = deger.toLowerCase();
    if (lower.includes('@')) {
        const kullanici = await User.findOne({ username: lower }).select('username').lean();
        return kullanici ? kullanici.username : null;
    }

    const nickKullanici = await User.findOne({ nickname: { $regex: new RegExp(`^${escapeRegex(deger)}$`, 'i') } }).select('username').lean();
    if (nickKullanici) {
        return nickKullanici.username;
    }

    const emailKullanici = await User.findOne({ username: lower }).select('username').lean();
    return emailKullanici ? emailKullanici.username : null;
}

async function deleteGroupIfEmpty(groupId) {
    const remaining = await Group.findById(groupId).select('memberEpostalar').lean();
    if (!remaining || !Array.isArray(remaining.memberEpostalar) || remaining.memberEpostalar.length === 0) {
        await GroupMessage.deleteMany({ groupId });
        await Group.findByIdAndDelete(groupId);
        return true;
    }

    return false;
}

function bildirimMetniOlustur(text, image) {
    const temizMetin = String(text || '').trim();
    if (temizMetin) {
        return temizMetin.length > 120 ? `${temizMetin.slice(0, 117)}...` : temizMetin;
    }

    return image ? 'Fotoğraf gönderildi.' : 'Yeni mesajınız var.';
}

function listedeVarMi(liste, deger) {
    const hedef = normalizeEmail(deger);
    return Array.isArray(liste) && liste.map(normalizeEmail).includes(hedef);
}

function grupSusturulmusMu(liste, groupId) {
    const hedef = String(groupId || '');
    return Array.isArray(liste) && liste.map(String).includes(hedef);
}

async function ozelMesajBildirimiOlustur(mesaj, aliciEposta) {
    const recipientEposta = normalizeEmail(aliciEposta);
    if (!recipientEposta || recipientEposta === normalizeEmail(mesaj.from)) return;

    const alici = await User.findOne({ username: recipientEposta }).select('username mutedPrivateEpostalar').lean();
    if (!alici || listedeVarMi(alici.mutedPrivateEpostalar, mesaj.from)) return;

    await UserNotification.create({
        recipientEposta,
        type: 'private-message',
        title: mesaj.fromNickname || 'Yeni mesaj',
        body: bildirimMetniOlustur(mesaj.text, mesaj.image),
        fromEposta: normalizeEmail(mesaj.from),
        fromNickname: mesaj.fromNickname || '',
        messageId: String(mesaj._id)
    });
}

async function grupMesajBildirimleriOlustur(mesaj, grup) {
    if (!grup || !Array.isArray(grup.memberEpostalar)) return;

    const groupId = String(grup._id);
    const gonderenEposta = normalizeEmail(mesaj.from);
    const alicilar = grup.memberEpostalar
        .map(normalizeEmail)
        .filter((email) => email && email !== gonderenEposta);

    if (alicilar.length === 0) return;

    const kullanicilar = await User.find({ username: { $in: alicilar } })
        .select('username mutedGroupIds')
        .lean();

    const kullaniciMap = new Map(kullanicilar.map((kullanici) => [normalizeEmail(kullanici.username), kullanici]));
    const body = bildirimMetniOlustur(mesaj.text, mesaj.image);

    const bildirilecekler = alicilar
        .filter((email) => {
            const kullanici = kullaniciMap.get(email);
            return kullanici && !grupSusturulmusMu(kullanici.mutedGroupIds, groupId);
        })
        .map((email) => ({
            recipientEposta: email,
            type: 'group-message',
            title: `${grup.name} - ${mesaj.fromNickname || 'Yeni mesaj'}`,
            body,
            fromEposta: gonderenEposta,
            fromNickname: mesaj.fromNickname || '',
            groupId,
            groupName: grup.name,
            messageId: String(mesaj._id)
        }));

    if (bildirilecekler.length > 0) {
        await UserNotification.insertMany(bildirilecekler);
    }
}

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
        await UserNotification.create({
            recipientEposta: hedef.username,
            type: 'friend-request',
            title: 'Yeni arkadaşlık isteği',
            body: `${gonderenNick} size arkadaşlık isteği gönderdi.`,
            fromEposta: gonderenEposta,
            fromNickname: gonderenNick
        });
        
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
        await ozelMesajBildirimiOlustur(yeniMesaj, aliciEposta);
        res.json({ success: true, yeniMesaj });
    } catch (error) {
        console.error("Mesaj gönderilemedi:", error);
        res.json({ success: false, mesaj: "Mesaj gönderilemedi!" });
    }
}); // <--- Mesaj gönderme fonksiyonu burada düzgünce biter.

app.post('/api/grup-kur', async (req, res) => {
    try {
        const { eposta, grupAdi, uyeler } = req.body;
        const ad = (grupAdi || '').trim();
        const creatorEposta = (eposta || '').trim().toLowerCase();

        if (!creatorEposta || !ad) {
            return res.json({ success: false, mesaj: 'Grup adı zorunludur.' });
        }

        const creator = await User.findOne({ username: creatorEposta }).select('username').lean();
        if (!creator) {
            return res.json({ success: false, mesaj: 'Grup kuracak kullanıcı bulunamadı.' });
        }

        const tokenlar = String(uyeler || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        const cozum = await resolveUserEmailsFromTokens(tokenlar, creatorEposta);
        if (!cozum.success) {
            return res.json({ success: false, mesaj: cozum.mesaj });
        }

        const yeniGrup = new Group({
            name: ad,
            creatorEposta,
            memberEpostalar: cozum.epostalar,
            memberRoller: Object.fromEntries(cozum.epostalar.map((email) => [email, email === creatorEposta ? 'yonetici' : 'uye'])),
            mutedMemberEpostalar: []
        });

        await yeniGrup.save();

        res.json({
            success: true,
            mesaj: 'Grup kuruldu! Artık toplu konuşabilirsiniz. 👥',
            grup: {
                _id: yeniGrup._id,
                name: yeniGrup.name,
                memberCount: yeniGrup.memberEpostalar.length,
                creatorEposta
            }
        });
    } catch (error) {
        console.error('Grup kurma hatası:', error);
        res.json({ success: false, mesaj: 'Grup kurulamadı!' });
    }
});

app.post('/api/grup-davet', async (req, res) => {
    try {
        const { eposta, groupId, uyeler } = req.body;
        const davetciEposta = (eposta || '').trim().toLowerCase();
        const tokenlar = String(uyeler || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        if (!davetciEposta || !groupId || tokenlar.length === 0) {
            return res.json({ success: false, mesaj: 'Grup daveti için grup ve üye bilgisi gerekli.' });
        }

        const ctx = await loadGroupAccessContext(groupId, davetciEposta);
        if (!ctx) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
        }

        if (!ctx.canManageRoles) {
            return res.json({ success: false, mesaj: 'Sadece yöneticiler üye davet edebilir.' });
        }

        const { group } = ctx;

        if (!Array.isArray(group.memberEpostalar) || !group.memberEpostalar.includes(davetciEposta)) {
            return res.json({ success: false, mesaj: 'Sadece grup üyeleri davet gönderebilir.' });
        }

        const cozum = await resolveUserEmailsFromTokens(tokenlar, null);
        if (!cozum.success) {
            return res.json({ success: false, mesaj: cozum.mesaj });
        }

        const eklenecekler = cozum.epostalar.filter((userEposta) => !group.memberEpostalar.includes(userEposta));
        if (eklenecekler.length === 0) {
            return res.json({ success: false, mesaj: 'Davet edilecek yeni üye bulunamadı.' });
        }

        const memberSet = new Set(group.memberEpostalar.map(normalizeEmail));
        const memberRoller = group.memberRoller && typeof group.memberRoller === 'object' ? { ...group.memberRoller } : {};

        for (const email of eklenecekler) {
            memberSet.add(email);
            memberRoller[email] = 'uye';
        }

        group.memberEpostalar = Array.from(memberSet);
        group.memberRoller = memberRoller;
        group.markModified('memberRoller');
        await group.save();

        await UserNotification.insertMany(eklenecekler.map((email) => ({
            recipientEposta: email,
            type: 'group-invite',
            title: group.name,
            body: 'Gruba eklendiniz.',
            fromEposta: davetciEposta,
            groupId: String(group._id),
            groupName: group.name
        })));

        const guncelGrup = await loadGroupWithDefaults(groupId);
        return res.json({
            success: true,
            mesaj: 'Davet gönderildi ve üyeler gruba eklendi.',
            grup: {
                _id: guncelGrup._id,
                name: guncelGrup.name,
                memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                creatorEposta: guncelGrup.creatorEposta,
                currentUserRole: getGroupMemberRole(guncelGrup, davetciEposta)
            }
        });
    } catch (error) {
        console.error('Grup daveti hatası:', error);
        res.json({ success: false, mesaj: 'Grup daveti gönderilemedi!' });
    }
});

app.post('/api/gruptan-ayril', async (req, res) => {
    try {
        const { eposta, groupId } = req.body;
        const kullaniciEposta = (eposta || '').trim().toLowerCase();

        if (!kullaniciEposta || !groupId) {
            return res.json({ success: false, mesaj: 'Grup ve kullanıcı bilgisi gerekli.' });
        }

        const ctx = await loadGroupAccessContext(groupId, kullaniciEposta);
        if (!ctx) {
            return res.json({ success: false, mesaj: 'Bu grupta değilsiniz.' });
        }

        const { group } = ctx;
        if (!Array.isArray(group.memberEpostalar) || !group.memberEpostalar.includes(kullaniciEposta)) {
            return res.json({ success: false, mesaj: 'Bu grupta değilsiniz.' });
        }

        if (group.creatorEposta === kullaniciEposta) {
            const kalanlar = group.memberEpostalar.filter((item) => item !== kullaniciEposta);

            if (kalanlar.length === 0) {
                await GroupMessage.deleteMany({ groupId });
                await Group.findByIdAndDelete(groupId);
                return res.json({ success: true, grupSilindi: true, mesaj: 'Grup kapatıldı çünkü son üye sizdiniz.' });
            }

            await Group.findByIdAndUpdate(groupId, {
                $set: {
                    creatorEposta: kalanlar[0],
                    memberEpostalar: kalanlar,
                    memberRoller: Object.fromEntries(kalanlar.map((email, index) => [email, index === 0 ? 'yonetici' : (group.memberRoller?.[email] || 'uye')])),
                    mutedMemberEpostalar: (group.mutedMemberEpostalar || []).filter((email) => kalanlar.includes(email)),
                    updatedAt: new Date()
                }
            });

            const guncelGrup = await loadGroupWithDefaults(groupId);
            return res.json({
                success: true,
                mesaj: 'Gruptan ayrıldınız. Yeni yönetici atandı.',
                grup: {
                    _id: guncelGrup._id,
                    name: guncelGrup.name,
                    memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                    creatorEposta: guncelGrup.creatorEposta,
                    currentUserRole: getGroupMemberRole(guncelGrup, kullaniciEposta)
                }
            });
        }

        const kalanlar = group.memberEpostalar.filter((email) => normalizeEmail(email) !== kullaniciEposta);
        const memberRoller = Object.fromEntries(kalanlar.map((email) => [email, group.memberRoller?.[email] || 'uye']));

        await Group.findByIdAndUpdate(groupId, {
            $set: {
                memberEpostalar: kalanlar,
                memberRoller,
                mutedMemberEpostalar: (group.mutedMemberEpostalar || []).filter((email) => kalanlar.includes(email)),
                updatedAt: new Date()
            }
        });

        const deleted = await deleteGroupIfEmpty(groupId);
        if (deleted) {
            return res.json({ success: true, grupSilindi: true, mesaj: 'Gruptan ayrıldınız. Grup boşaldığı için kapatıldı.' });
        }

        const guncelGrup = await loadGroupWithDefaults(groupId);
        return res.json({
            success: true,
            mesaj: 'Gruptan ayrıldınız.',
            grup: {
                _id: guncelGrup._id,
                name: guncelGrup.name,
                memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                creatorEposta: guncelGrup.creatorEposta,
                currentUserRole: getGroupMemberRole(guncelGrup, kullaniciEposta)
            }
        });
    } catch (error) {
        console.error('Gruptan ayrılma hatası:', error);
        res.json({ success: false, mesaj: 'Gruptan ayrılamadınız!' });
    }
});

app.post('/api/gruptan-cikar', async (req, res) => {
    try {
        const { eposta, groupId, hedef } = req.body;
        const yetkiliEposta = (eposta || '').trim().toLowerCase();
        const hedefEposta = await resolveUserEmail(hedef);

        if (!yetkiliEposta || !groupId || !hedefEposta) {
            return res.json({ success: false, mesaj: 'Grup ve üye bilgisi gerekli.' });
        }

        const ctx = await loadGroupAccessContext(groupId, yetkiliEposta);
        if (!ctx) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
        }

        const { group, canManageRoles } = ctx;
        if (!canManageRoles) {
            return res.json({ success: false, mesaj: 'Sadece grup yöneticisi üye çıkarabilir.' });
        }

        if (!group.memberEpostalar.includes(hedefEposta)) {
            return res.json({ success: false, mesaj: 'Bu üye grupta değil.' });
        }

        if (hedefEposta === group.creatorEposta) {
            return res.json({ success: false, mesaj: 'Yönetici çıkarılamaz. Önce gruptan ayrılmalısınız.' });
        }

        const kalanlar = group.memberEpostalar.filter((email) => normalizeEmail(email) !== hedefEposta);
        const memberRoller = Object.fromEntries(kalanlar.map((email) => [email, group.memberRoller?.[email] || 'uye']));

        await Group.findByIdAndUpdate(groupId, {
            $set: {
                memberEpostalar: kalanlar,
                memberRoller,
                mutedMemberEpostalar: (group.mutedMemberEpostalar || []).filter((email) => kalanlar.includes(email)),
                updatedAt: new Date()
            }
        });

        const deleted = await deleteGroupIfEmpty(groupId);
        if (deleted) {
            return res.json({ success: true, grupSilindi: true, mesaj: 'Üye çıkarıldı. Grup boşaldığı için kapatıldı.' });
        }

        const guncelGrup = await loadGroupWithDefaults(groupId);
        return res.json({
            success: true,
            mesaj: 'Üye gruptan çıkarıldı.',
            grup: {
                _id: guncelGrup._id,
                name: guncelGrup.name,
                memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                creatorEposta: guncelGrup.creatorEposta,
                currentUserRole: getGroupMemberRole(guncelGrup, yetkiliEposta)
            }
        });
    } catch (error) {
        console.error('Üye çıkarma hatası:', error);
        res.json({ success: false, mesaj: 'Üye çıkarılamadı!' });
    }
});

app.post('/api/grup-rol-guncelle', async (req, res) => {
    try {
        const { eposta, groupId, hedef, rol } = req.body;
        const yetkiliEposta = normalizeEmail(eposta);
        const hedefEposta = await resolveUserEmail(hedef);
        const yeniRol = String(rol || '').trim().toLowerCase();

        if (!yetkiliEposta || !groupId || !hedefEposta || !['yonetici', 'yardimci', 'uye'].includes(yeniRol)) {
            return res.json({ success: false, mesaj: 'Geçersiz grup rolü isteği.' });
        }

        const ctx = await loadGroupAccessContext(groupId, yetkiliEposta);
        if (!ctx) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
        }

        if (!ctx.canManageRoles) {
            return res.json({ success: false, mesaj: 'Sadece yöneticiler rol değiştirebilir.' });
        }

        const { group } = ctx;
        if (!group.memberEpostalar.includes(hedefEposta)) {
            return res.json({ success: false, mesaj: 'Bu üye grupta değil.' });
        }

        if (hedefEposta === group.creatorEposta && yeniRol !== 'yonetici') {
            return res.json({ success: false, mesaj: 'Ana yönetici rolü değiştirilemez.' });
        }

        const memberRoller = { ...(group.memberRoller || {}) };
        memberRoller[hedefEposta] = yeniRol;

        await Group.findByIdAndUpdate(groupId, {
            $set: {
                memberRoller,
                updatedAt: new Date()
            }
        });

        const guncelGrup = await loadGroupWithDefaults(groupId);
        return res.json({
            success: true,
            mesaj: 'Üye rolü güncellendi.',
            grup: {
                _id: guncelGrup._id,
                name: guncelGrup.name,
                memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                creatorEposta: guncelGrup.creatorEposta,
                currentUserRole: getGroupMemberRole(guncelGrup, yetkiliEposta)
            }
        });
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        res.json({ success: false, mesaj: 'Rol güncellenemedi!' });
    }
});

app.post('/api/grup-mute-toggle', async (req, res) => {
    try {
        const { eposta, groupId, hedef, mute } = req.body;
        const yetkiliEposta = normalizeEmail(eposta);
        const hedefEposta = await resolveUserEmail(hedef);
        const muteEt = mute === true || mute === 'true' || mute === 1 || mute === '1';

        if (!yetkiliEposta || !groupId || !hedefEposta) {
            return res.json({ success: false, mesaj: 'Geçersiz mute isteği.' });
        }

        const ctx = await loadGroupAccessContext(groupId, yetkiliEposta);
        if (!ctx) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
        }

        if (!ctx.canManageMute) {
            return res.json({ success: false, mesaj: 'Bu işlem için yardımcı veya yönetici olmalısınız.' });
        }

        const { group, role } = ctx;
        const hedefRol = getGroupMemberRole(group, hedefEposta);
        if (!group.memberEpostalar.includes(hedefEposta)) {
            return res.json({ success: false, mesaj: 'Bu üye grupta değil.' });
        }

        if (hedefRol === 'yonetici') {
            return res.json({ success: false, mesaj: 'Yöneticiler susturulamaz.' });
        }

        if (role === 'yardimci' && hedefRol === 'yardimci') {
            return res.json({ success: false, mesaj: 'Yardımcılar birbirini susturamaz.' });
        }

        const mutedSet = new Set(Array.isArray(group.mutedMemberEpostalar) ? group.mutedMemberEpostalar.map(normalizeEmail) : []);
        if (muteEt) mutedSet.add(hedefEposta); else mutedSet.delete(hedefEposta);

        await Group.findByIdAndUpdate(groupId, {
            $set: {
                mutedMemberEpostalar: Array.from(mutedSet),
                updatedAt: new Date()
            }
        });

        const guncelGrup = await loadGroupWithDefaults(groupId);
        return res.json({
            success: true,
            mesaj: muteEt ? 'Üye susturuldu.' : 'Üyenin susturması kaldırıldı.',
            grup: {
                _id: guncelGrup._id,
                name: guncelGrup.name,
                memberCount: Array.isArray(guncelGrup.memberEpostalar) ? guncelGrup.memberEpostalar.length : 0,
                creatorEposta: guncelGrup.creatorEposta,
                currentUserRole: getGroupMemberRole(guncelGrup, yetkiliEposta)
            }
        });
    } catch (error) {
        console.error('Mute hatası:', error);
        res.json({ success: false, mesaj: 'Mute işlemi başarısız!' });
    }
});

app.get('/api/grup-ayarlari/:eposta/:groupId', async (req, res) => {
    try {
        const { eposta, groupId } = req.params;
        const kullaniciEposta = normalizeEmail(eposta);
        const ctx = await loadGroupAccessContext(groupId, kullaniciEposta);

        if (!ctx) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
        }

        const { group, role, canManageRoles, canManageMute } = ctx;
        const userDocs = await User.find({ username: { $in: group.memberEpostalar } }).select('nickname username avatar status').lean();
        const userMap = new Map(userDocs.map((user) => [normalizeEmail(user.username), user]));

        const members = group.memberEpostalar.map((email) => {
            const user = userMap.get(normalizeEmail(email));
            return groupMemberSnapshot(group, user || { username: email, nickname: email.split('@')[0], avatar: '' });
        }).sort((a, b) => {
            const rank = { yonetici: 0, yardimci: 1, uye: 2 };
            if (a.eposta === normalizeEmail(group.creatorEposta)) return -1;
            if (b.eposta === normalizeEmail(group.creatorEposta)) return 1;
            return (rank[a.role] || 9) - (rank[b.role] || 9) || a.nickname.localeCompare(b.nickname, 'tr');
        });

        res.json({
            success: true,
            grup: {
                _id: group._id,
                name: group.name,
                creatorEposta: group.creatorEposta,
                memberCount: members.length,
                currentUserRole: role,
                canManageRoles,
                canManageMute
            },
            members
        });
    } catch (error) {
        console.error('Grup ayarları hatası:', error);
        res.json({ success: false, mesaj: 'Grup ayarları alınamadı!' });
    }
});

app.get('/api/gruplar/:eposta', async (req, res) => {
    try {
        const { eposta } = req.params;
        const kullaniciEposta = (eposta || '').trim().toLowerCase();

        const gruplar = await Group.find({ memberEpostalar: kullaniciEposta })
            .sort({ updatedAt: -1 })
            .lean();

        res.json({
            gruplar: gruplar.map((grup) => ({
                _id: grup._id,
                name: grup.name,
                creatorEposta: grup.creatorEposta,
                memberCount: Array.isArray(grup.memberEpostalar) ? grup.memberEpostalar.length : 0,
                currentUserRole: getGroupMemberRole(grup, kullaniciEposta)
            }))
        });
    } catch (error) {
        res.json({ gruplar: [] });
    }
});

app.get('/api/bildirim-ayarlar/:eposta', async (req, res) => {
    try {
        const kullaniciEposta = normalizeEmail(req.params.eposta);
        const kullanici = await User.findOne({ username: kullaniciEposta })
            .select('mutedPrivateEpostalar mutedGroupIds')
            .lean();

        if (!kullanici) {
            return res.json({ success: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        res.json({
            success: true,
            mutedPrivateEpostalar: (kullanici.mutedPrivateEpostalar || []).map(normalizeEmail),
            mutedGroupIds: (kullanici.mutedGroupIds || []).map(String)
        });
    } catch (error) {
        res.json({ success: false, mesaj: 'Bildirim ayarları alınamadı.' });
    }
});

app.post('/api/bildirim-sustur', async (req, res) => {
    try {
        const { eposta, type, target, muted } = req.body;
        const kullaniciEposta = normalizeEmail(eposta);
        const sustur = muted === true || muted === 'true' || muted === 1 || muted === '1';
        const kullanici = await User.findOne({ username: kullaniciEposta });

        if (!kullanici) {
            return res.json({ success: false, mesaj: 'Kullanıcı bulunamadı.' });
        }

        if (type === 'private') {
            const hedefEposta = await resolveUserEmail(target);
            if (!hedefEposta) {
                return res.json({ success: false, mesaj: 'Susturulacak kişi bulunamadı.' });
            }

            if (normalizeEmail(hedefEposta) === kullaniciEposta) {
                return res.json({ success: false, mesaj: 'Kendi bildirimlerinizi kişi olarak susturamazsınız.' });
            }

            const mutedSet = new Set((kullanici.mutedPrivateEpostalar || []).map(normalizeEmail));
            if (sustur) mutedSet.add(normalizeEmail(hedefEposta)); else mutedSet.delete(normalizeEmail(hedefEposta));
            kullanici.mutedPrivateEpostalar = Array.from(mutedSet);
        } else if (type === 'group') {
            const ctx = await loadGroupAccessContext(target, kullaniciEposta);
            if (!ctx) {
                return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişiminiz yok.' });
            }

            const groupId = String(ctx.group._id);
            const mutedSet = new Set((kullanici.mutedGroupIds || []).map(String));
            if (sustur) mutedSet.add(groupId); else mutedSet.delete(groupId);
            kullanici.mutedGroupIds = Array.from(mutedSet);
        } else {
            return res.json({ success: false, mesaj: 'Geçersiz bildirim susturma isteği.' });
        }

        await kullanici.save();

        res.json({
            success: true,
            mesaj: sustur ? 'Bildirimler susturuldu.' : 'Bildirimler açıldı.',
            mutedPrivateEpostalar: (kullanici.mutedPrivateEpostalar || []).map(normalizeEmail),
            mutedGroupIds: (kullanici.mutedGroupIds || []).map(String)
        });
    } catch (error) {
        console.error('Bildirim susturma hatası:', error);
        res.json({ success: false, mesaj: 'Bildirim ayarı güncellenemedi.' });
    }
});

app.get('/api/bildirimler/:eposta', async (req, res) => {
    try {
        const kullaniciEposta = normalizeEmail(req.params.eposta);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);

        const bildirimler = await UserNotification.find({ recipientEposta: kullaniciEposta, read: false })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const yeniBildirimIds = bildirimler
            .filter((bildirim) => !bildirim.deliveredAt)
            .map((bildirim) => bildirim._id);

        if (yeniBildirimIds.length > 0) {
            await UserNotification.updateMany(
                { _id: { $in: yeniBildirimIds }, recipientEposta: kullaniciEposta },
                { $set: { deliveredAt: new Date() } }
            );
        }

        const unreadCount = await UserNotification.countDocuments({ recipientEposta: kullaniciEposta, read: false });

        res.json({
            success: true,
            unreadCount,
            notifications: bildirimler.map((bildirim) => ({
                _id: bildirim._id,
                type: bildirim.type,
                title: bildirim.title,
                body: bildirim.body,
                fromEposta: bildirim.fromEposta,
                fromNickname: bildirim.fromNickname,
                groupId: bildirim.groupId,
                groupName: bildirim.groupName,
                createdAt: bildirim.createdAt,
                newForDevice: !bildirim.deliveredAt
            }))
        });
    } catch (error) {
        console.error('Bildirimler alınamadı:', error);
        res.json({ success: false, unreadCount: 0, notifications: [] });
    }
});

app.post('/api/bildirim-okundu', async (req, res) => {
    try {
        const kullaniciEposta = normalizeEmail(req.body.eposta);
        const notificationId = req.body.notificationId;
        const sorgu = { recipientEposta: kullaniciEposta, read: false };

        if (notificationId) {
            sorgu._id = notificationId;
        }

        await UserNotification.updateMany(sorgu, { $set: { read: true } });
        res.json({ success: true, mesaj: 'Bildirimler okundu.' });
    } catch (error) {
        res.json({ success: false, mesaj: 'Bildirimler güncellenemedi.' });
    }
});

app.get('/api/grup-mesajlari/:benEposta/:groupId', async (req, res) => {
    try {
        const { benEposta, groupId } = req.params;
        const kullaniciEposta = (benEposta || '').trim().toLowerCase();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

        const grup = await loadGroupWithDefaults(groupId);
        if (!grup || !grup.memberEpostalar.includes(kullaniciEposta)) {
            return res.json([]);
        }

        const grupMesajlari = await GroupMessage.find({ groupId })
            .select('from fromNickname text image time createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json(grupMesajlari.reverse());
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/grup-mesaj-gonder', upload.single('messageImage'), async (req, res) => {
    try {
        const { fromEposta, groupId, text } = req.body;
        const kullaniciEposta = (fromEposta || '').trim().toLowerCase();
        const image = uploadedFileUrl(req.file) || req.body.image || '';

        const grup = await loadGroupWithDefaults(groupId);
        if (!grup || !grup.memberEpostalar.includes(kullaniciEposta)) {
            return res.json({ success: false, mesaj: 'Grup bulunamadı veya erişim yok.' });
        }

        if ((Array.isArray(grup.mutedMemberEpostalar) ? grup.mutedMemberEpostalar : []).includes(kullaniciEposta)) {
            return res.json({ success: false, mesaj: 'Bu grupta susturuldunuz.' });
        }

        const ben = await User.findOne({ username: kullaniciEposta }).select('nickname').lean();
        const yeniMesaj = new GroupMessage({
            groupId,
            from: kullaniciEposta,
            fromNickname: ben ? ben.nickname : kullaniciEposta.split('@')[0],
            text: text || '',
            image: typeof image === 'string' ? image : '',
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });

        await yeniMesaj.save();
        await Group.findByIdAndUpdate(groupId, { $set: { updatedAt: new Date() } });
        await grupMesajBildirimleriOlustur(yeniMesaj, grup);

        res.json({ success: true, yeniMesaj });
    } catch (error) {
        console.error('Grup mesajı gönderilemedi:', error);
        res.json({ success: false, mesaj: 'Grup mesajı gönderilemedi!' });
    }
});

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🚀 Sunucu http://localhost:${PORT} adresinde aktif!`));
