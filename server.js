const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// FRONTEND klasörünü kesin bir şekilde tanımlıyoruz
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());

// Kök dizine (/) gidilince login.html'i zorla açmasını söylüyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

const KULLANICI_YOLU = path.join(__dirname, 'kullanicilar.json');
const MESAJ_YOLU = path.join(__dirname, 'mesajlar.json');
const ARKADAS_YOLU = path.join(__dirname, 'arkadaslar.json');

// --- ZIRHLI DOSYA FONKSİYONLARI (Çökmeyi ve Silinmeyi Önler) ---
function kullanicilariGetir() {
    try {
        if (!fs.existsSync(KULLANICI_YOLU)) return [];
        const veri = fs.readFileSync(KULLANICI_YOLU, 'utf-8');
        return veri ? JSON.parse(veri) : [];
    } catch (e) {
        return [];
    }
}
function kullanicilariKaydet(liste) {
    fs.writeFileSync(KULLANICI_YOLU, JSON.stringify(liste, null, 2), 'utf-8');
}
function mesajlariGetir() {
    try {
        if (!fs.existsSync(MESAJ_YOLU)) return [];
        const veri = fs.readFileSync(MESAJ_YOLU, 'utf-8');
        return veri ? JSON.parse(veri) : [];
    } catch (e) {
        return [];
    }
}
function mesajlariKaydet(liste) {
    fs.writeFileSync(MESAJ_YOLU, JSON.stringify(liste, null, 2), 'utf-8');
}
function arkadaslariGetir() {
    try {
        if (!fs.existsSync(ARKADAS_YOLU)) return [];
        const veri = fs.readFileSync(ARKADAS_YOLU, 'utf-8');
        return veri ? JSON.parse(veri) : [];
    } catch (e) {
        return [];
    }
}
function arkadaslariKaydet(liste) {
    fs.writeFileSync(ARKADAS_YOLU, JSON.stringify(liste, null, 2), 'utf-8');
}

// --- ENDPOINT'LER ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// Kullanıcı Kaydı
app.post('/kayit', (req, res) => {
    const nickname = (req.body?.nickname || '').trim();
    const username = (req.body?.username || '').trim().toLowerCase();
    const password = (req.body?.password || '').trim();
    const kullanicilar = kullanicilariGetir();

    if (!nickname || !username || !password) {
        return res.json({ success: false, mesaj: "Lütfen tüm alanları doldurun! ⚠️" });
    }

    if (kullanicilar.find(k => (k.username || '').trim().toLowerCase() === username)) {
        return res.json({ success: false, mesaj: "Bu e-posta zaten kayıtlı! ❌" });
    }
    if (kullanicilar.find(k => k.nickname && k.nickname.toLowerCase() === nickname.toLowerCase())) {
        return res.json({ success: false, mesaj: "Bu kullanıcı adı zaten alınmış! ❌" });
    }

    kullanicilar.push({ nickname, username, password, avatar: "", status: "" });
    kullanicilariKaydet(kullanicilar);
    res.json({ success: true, mesaj: "Kayıt başarıyla oluşturuldu! 🎉" });
});

// Giriş
app.post('/giris', (req, res) => {
    const username = (req.body?.username || '').trim().toLowerCase();
    const password = (req.body?.password || '').trim();

    if (!username || !password) {
        return res.json({ success: false, mesaj: "E-posta ve şifre zorunludur! ⚠️" });
    }

    const kullanicilar = kullanicilariGetir();
    const bulunan = kullanicilar.find(k =>
        (k.username || '').trim().toLowerCase() === username &&
        (k.password || '').trim() === password
    );

    if (bulunan) {
        res.json({ success: true, mesaj: "Giriş Başarılı! 🚀", username: bulunan.username });
    } else {
        res.json({ success: false, mesaj: "E-posta veya şifre hatalı! ❌" });
    }
});

// Profil Getirme
app.get('/api/profil-getir/:eposta', (req, res) => {
    const { eposta } = req.params;
    const kullanicilar = kullanicilariGetir();
    const kullanıcı = kullanicilar.find(k => k.username === eposta);
    
    if (kullanıcı) {
        res.json({ nickname: kullanıcı.nickname, avatar: kullanıcı.avatar || "", status: kullanıcı.status || "" });
    } else {
        // Eğer kullanıcı adı bulunamazsa e-postanın ilk kısmını nickname yapalım ki sistem tıkanmasın
        res.json({ nickname: eposta.split('@')[0], avatar: "", status: "" });
    }
});

// Profil Güncelleme
app.post('/api/profil-guncelle', (req, res) => {
    const { eposta, avatar, status } = req.body;
    let kullanicilar = kullanicilariGetir();
    const indeks = kullanicilar.findIndex(k => k.username === eposta);

    if (indeks !== -1) {
        kullanicilar[indeks].avatar = avatar;
        kullanicilar[indeks].status = status;
        kullanicilariKaydet(kullanicilar);
        res.json({ success: true, mesaj: "Profiliniz başarıyla güncellendi! 💾" });
    } else {
        res.json({ success: false, mesaj: "Kullanıcı bulunamadı!" });
    }
});

// Arkadaş Ekleme
app.post('/api/arkadas-ekle', (req, res) => {
    const { gonderenEposta, hedefNickname } = req.body;
    const kullanicilar = kullanicilariGetir();
    const arkadasliklar = arkadaslariGetir();

    const ben = kullanicilar.find(k => k.username === gonderenEposta);
    const hedef = kullanicilar.find(k => k.nickname && k.nickname.toLowerCase() === hedefNickname.toLowerCase());

    if (!hedef) return res.json({ success: false, mesaj: "Kullanıcı bulunamadı! ❌" });
    if (ben && ben.nickname === hedef.nickname) return res.json({ success: false, mesaj: "Kendini ekleyemezsin! 😅" });

    const gonderenNick = ben ? ben.nickname : gonderenEposta.split('@')[0];

    const varMi = arkadasliklar.find(a => 
        (a.gonderen === gonderenNick && a.alan === hedef.nickname) ||
        (a.gonderen === hedef.nickname && a.alan === gonderenNick)
    );

    if (varMi) {
        return res.json({ success: false, mesaj: `Bu kullanıcıyla zaten bir bağınız var! Durum: ${varMi.durum}` });
    }

    arkadasliklar.push({ gonderen: gonderenNick, alan: hedef.nickname, durum: 'beklemede' });
    arkadaslariKaydet(arkadasliklar);
    res.json({ success: true, mesaj: "Arkadaşlık isteği başarıyla gönderildi! 🔔" });
});

// KESİNTİSİZ ARKADAŞ LİSTESİ SORGULAMA (Asla Silinmez)
app.get('/api/arkadasliklar/:eposta', (req, res) => {
    const { eposta } = req.params;
    const kullanicilar = kullanicilariGetir();
    const arkadasliklar = arkadaslariGetir();

    const kullanıcı = kullanicilar.find(k => k.username === eposta);
    // Eğer kullanıcı henüz veritabanında tam oturmadıysa bile geçici isim üretip patlamasını önlüyoruz
    const nick = kullanıcı ? kullanıcı.nickname : eposta.split('@')[0];

    const arkadaslarUzetleri = [];
    const gelenIstekler = [];

    arkadasliklar.forEach(a => {
        let hedefNick = null;
        if (a.durum === 'arkadaş') {
            if (a.gonderen === nick) hedefNick = a.alan;
            if (a.alan === nick) hedefNick = a.gonderen;
            
            if (hedefNick) {
                const hDetay = kullanicilar.find(k => k.nickname === hedefNick);
                arkadaslarUzetleri.push({
                    nickname: hedefNick,
                    avatar: hDetay ? hDetay.avatar : "",
                    status: hDetay ? hDetay.status : ""
                });
            }
        } else if (a.durum === 'beklemede' && a.alan === nick) {
            gelenIstekler.push(a.gonderen);
        }
    });

    res.json({ arkadaslar: arkadaslarUzetleri, gelenIstekler });
});

// İsteğe Cevap Verme
app.post('/api/arkadas-yanitla', (req, res) => {
    const { alanEposta, gonderenNickname, eylem } = req.body;
    const kullanicilar = kullanicilariGetir();
    let arkadasliklar = arkadaslariGetir();

    const ben = kullanicilar.find(k => k.username === alanEposta);
    const benNick = ben ? ben.nickname : alanEposta.split('@')[0];

    const indeks = arkadasliklar.findIndex(a => a.gonderen === gonderenNickname && a.alan === benNick && a.durum === 'beklemede');

    if (indeks !== -1) {
        if (eylem === 'onayla') {
            arkadasliklar[indeks].durum = 'arkadaş';
            res.json({ success: true, mesaj: "Artık arkadaşsınız! 🎉" });
        } else {
            arkadasliklar.splice(indeks, 1);
            res.json({ success: true, mesaj: "İstek reddedildi." });
        }
        arkadaslariKaydet(arkadasliklar);
    } else {
        res.json({ success: false, mesaj: "İstek bulunamadı!" });
    }
});

// GÜVENLİ MESAJ ÇEKME (Hem E-posta Hem Nickname Kontrolü Yapar)
app.get('/api/mesajlar-v2/:benEposta/:arkadasNickname', (req, res) => {
    const { benEposta, arkadasNickname } = req.params;
    const kullanicilar = kullanicilariGetir();
    const tumMesajlar = mesajlariGetir();

    const ben = kullanicilar.find(k => k.username === benEposta);
    const benNick = ben ? ben.nickname : benEposta.split('@')[0];

    const ozelKonusma = tumMesajlar.filter(m => 
        (m.from === benEposta && m.toNickname === arkadasNickname) || 
        (m.fromNickname === benNick && m.toNickname === arkadasNickname) ||
        (m.fromNickname === arkadasNickname && m.toEposta === benEposta) ||
        (m.fromNickname === arkadasNickname && m.toNickname === benNick)
    );
    res.json(ozelKonusma);
});

// Güvenli Mesaj Gönderme
app.post('/api/mesaj-gonder-v2', (req, res) => {
    const { fromEposta, toNickname, text } = req.body;
    const kullanicilar = kullanicilariGetir();
    const tumMesajlar = mesajlariGetir();

    const ben = kullanicilar.find(k => k.username === fromEposta);
    const alici = kullanicilar.find(k => k.nickname === toNickname);

    const yeniMesaj = {
        from: fromEposta,
        fromNickname: ben ? ben.nickname : fromEposta.split('@')[0],
        toEposta: alici ? alici.username : "",
        toNickname: toNickname,
        text,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    tumMesajlar.push(yeniMesaj);
    mesajlariKaydet(tumMesajlar);
    res.json({ success: true, yeniMesaj });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`\n🚀 Güvenli Sunucu http://localhost:${PORT} adresinde aktif!`));