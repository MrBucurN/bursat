const aktifKullanici = sessionStorage.getItem('aktifKullanici');

if (!aktifKullanici) {
    window.location.href = '/';
}

const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem('aktifKullanici');
    window.location.href = '/';
});

let secilenAliciNickname = null;
let secilenAliciEposta = null;
let mevcutNickname = '';
let secilenAvatar = '';

// DOM Elemanları
const bursatContainer = document.getElementById('bursat-container');
const friendForm = document.getElementById('friend-form');
const friendInput = document.getElementById('friend-username-input');
const requestsBox = document.getElementById('requests-box');
const dynamicRequestsList = document.getElementById('dynamic-requests-list');
const dynamicChatList = document.getElementById('dynamic-chat-list');

const chatMainArea = document.getElementById('chat-main-area');
const settingsMainArea = document.getElementById('settings-main-area');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const mobileBackBtn = document.getElementById('mobile-back-btn');
const settingsForm = document.getElementById('settings-form');
const avatarFileInput = document.getElementById('set-avatar-file');
const avatarPreview = document.getElementById('set-avatar-preview');
const chatImageInput = document.getElementById('chat-image-input');

const activeChatTitle = document.getElementById('active-chat-title');
const activeChatStatus = document.getElementById('active-chat-status');
const activeAvatar = document.getElementById('active-avatar');
const activeAvatarImg = document.getElementById('active-avatar-img');

const messagesBox = document.getElementById('messages-box');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');

function listeEkraniniAc() {
    bursatContainer.classList.remove('chat-is-open', 'settings-is-open');
}

function sohbetEkraniniAc() {
    settingsMainArea.style.display = 'none';
    chatMainArea.style.display = 'flex';
    bursatContainer.classList.remove('settings-is-open');
    bursatContainer.classList.add('chat-is-open');
}

function ayarlarEkraniniAc() {
    chatMainArea.style.display = 'none';
    settingsMainArea.style.display = 'flex';
    bursatContainer.classList.remove('chat-is-open');
    bursatContainer.classList.add('settings-is-open');
}

function avatarOnizlemeGuncelle(src) {
    if (src) {
        avatarPreview.src = src;
        avatarPreview.style.display = 'block';
    } else {
        avatarPreview.removeAttribute('src');
        avatarPreview.style.display = 'none';
    }
}

function seciliAvatarYukle() {
    const dosya = avatarFileInput.files && avatarFileInput.files[0];

    if (!dosya) {
        return Promise.resolve(secilenAvatar);
    }

    if (secilenAvatar) {
        return Promise.resolve(secilenAvatar);
    }

    return new Promise((resolve, reject) => {
        const okuyucu = new FileReader();
        okuyucu.onload = () => {
            secilenAvatar = String(okuyucu.result || '');
            avatarOnizlemeGuncelle(secilenAvatar);
            resolve(secilenAvatar);
        };
        okuyucu.onerror = () => reject(new Error('Avatar okunamadı'));
        okuyucu.readAsDataURL(dosya);
    });
}

function onizlemeUrliniTemizle(url) {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

async function resimDosyasiniKucult(dosya, maxGenislik = 1600, maxYukseklik = 1600, kalite = 0.82) {
    if (!dosya || !dosya.type || !dosya.type.startsWith('image/')) {
        return dosya;
    }

    if (dosya.size <= 900 * 1024) {
        return dosya;
    }

    const kaynakUrl = URL.createObjectURL(dosya);

    try {
        const goruntu = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Resim okunamadı'));
            img.src = kaynakUrl;
        });

        const oran = Math.min(maxGenislik / goruntu.width, maxYukseklik / goruntu.height, 1);
        const genislik = Math.max(1, Math.round(goruntu.width * oran));
        const yukseklik = Math.max(1, Math.round(goruntu.height * oran));

        const canvas = document.createElement('canvas');
        canvas.width = genislik;
        canvas.height = yukseklik;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return dosya;
        }

        ctx.drawImage(goruntu, 0, 0, genislik, yukseklik);

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', kalite);
        });

        if (!blob) {
            return dosya;
        }

        return new File([blob], dosya.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    } finally {
        URL.revokeObjectURL(kaynakUrl);
    }
}

function geciciMesajBalonuOlustur({ text, imageUrl }) {
    const mesajBalonu = document.createElement('div');
    mesajBalonu.className = 'message outgoing pending-message';
    mesajBalonu.style.opacity = '0.7';

    if (imageUrl) {
        const imageEl = document.createElement('img');
        imageEl.src = imageUrl;
        imageEl.alt = 'Gönderiliyor';
        imageEl.className = 'message-image';
        mesajBalonu.appendChild(imageEl);
    }

    if (text) {
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = text;
        mesajBalonu.appendChild(textEl);
    }

    const durumEl = document.createElement('div');
    durumEl.className = 'message-status';
    durumEl.textContent = 'Gönderiliyor...';
    durumEl.style.fontSize = '12px';
    durumEl.style.opacity = '0.8';
    mesajBalonu.appendChild(durumEl);

    return mesajBalonu;
}

avatarFileInput.addEventListener('change', () => {
    const dosya = avatarFileInput.files && avatarFileInput.files[0];

    if (!dosya) {
        secilenAvatar = '';
        avatarOnizlemeGuncelle('');
        return;
    }

    if (!dosya.type.startsWith('image/')) {
        alert('Lütfen bir resim dosyası seçin.');
        avatarFileInput.value = '';
        secilenAvatar = '';
        avatarOnizlemeGuncelle('');
        return;
    }

    const okuyucu = new FileReader();
    okuyucu.onload = () => {
        secilenAvatar = String(okuyucu.result || '');
        avatarOnizlemeGuncelle(secilenAvatar);
    };
    okuyucu.readAsDataURL(dosya);
});

// --- PANELLER ARASI GEÇİŞ (AYARLAR MANTIĞI) ---
openSettingsBtn.addEventListener('click', () => {
    ayarlarEkraniniAc();
    // Mevcut profil verilerimizi kutucuklara dolduralım
    fetch(`/api/profil-getir/${aktifKullanici}`)
        .then(res => res.json())
        .then(data => {
            mevcutNickname = data.nickname || aktifKullanici.split('@')[0];
            secilenAvatar = data.avatar || '';
            document.getElementById('set-nickname').value = mevcutNickname;
            document.getElementById('set-status-text').value = data.status || '';
            document.getElementById('set-password-confirm').value = '';
            avatarFileInput.value = '';
            avatarOnizlemeGuncelle(secilenAvatar);
        });
});

closeSettingsBtn.addEventListener('click', () => {
    settingsMainArea.style.display = 'none';
    chatMainArea.style.display = 'flex';
    listeEkraniniAc();
});

mobileBackBtn.addEventListener('click', () => {
    listeEkraniniAc();
});

// PROFİL AYARLARINI KAYDETME
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('set-nickname').value.trim();
    const status = document.getElementById('set-status-text').value.trim();
    const password = document.getElementById('set-password-confirm').value.trim();
    let avatar = secilenAvatar;

    if (!nickname) {
        alert("Kullanıcı adı boş bırakılamaz!");
        return;
    }

    if (nickname !== mevcutNickname && !password) {
        alert("Kullanıcı adını değiştirmek için şifrenizi girin!");
        return;
    }

    if (avatarFileInput.files && avatarFileInput.files[0] && !avatar) {
        try {
            avatar = await seciliAvatarYukle();
        } catch (error) {
            console.error('Avatar okunamadı:', error);
            alert('Profil resmi okunamadı. Lütfen tekrar deneyin.');
            return;
        }
    }

    try {
        const formData = new FormData();
        formData.append('eposta', aktifKullanici);
        formData.append('nickname', nickname);
        formData.append('status', status);
        formData.append('password', password);

        const avatarDosyasi = avatarFileInput.files && avatarFileInput.files[0];
        if (avatarDosyasi) {
            formData.append('avatarImage', avatarDosyasi);
        } else if (avatar) {
            formData.append('avatar', avatar);
        }

        const response = await fetch('/api/profil-guncelle', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        alert(data.mesaj);

        if (data.success) {
            mevcutNickname = data.nickname || nickname;
            settingsMainArea.style.display = 'none';
            chatMainArea.style.display = 'flex';
            listeEkraniniAc();
            paneliGuncelle(); // Alt barı anında tazele
        }
    } catch (error) {
        console.error("Profil güncellenemedi:", error);
    }
});

// --- 1. SİDEBAR VE VERİLERİ YÜKLEME ---
async function paneliGuncelle() {
    try {
        // Kendi profil özetimizi alt bar için çekelim
        const profRes = await fetch(`/api/profil-getir/${aktifKullanici}`);
        const profilim = await profRes.json();
        
        document.getElementById('my-footer-name').textContent = profilim.nickname || aktifKullanici.split('@')[0];
        document.getElementById('my-footer-status').textContent = profilim.status || "Durum ayarlanmadı";
        document.getElementById('my-footer-avatar').src = profilim.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profilim.nickname}`;

        // Arkadaşlık ve istek listesini çekelim
        const response = await fetch(`/api/arkadasliklar/${aktifKullanici}`);
        const data = await response.json();

        // A. Gelen İstekleri Çiz
        dynamicRequestsList.innerHTML = '';
        if (data.gelenIstekler && data.gelenIstekler.length > 0) {
            requestsBox.style.display = 'block';
            data.gelenIstekler.forEach(istekGonderen => {
                const item = document.createElement('div');
                item.className = 'request-item';
                item.innerHTML = `
                    <span>${istekGonderen}</span>
                    <div class="request-buttons">
                        <button class="req-btn accept" data-user="${istekGonderen}" data-action="onayla">✓</button>
                        <button class="req-btn reject" data-user="${istekGonderen}" data-action="reddet">✕</button>
                    </div>
                `;
                dynamicRequestsList.appendChild(item);
            });
        } else {
            requestsBox.style.display = 'none';
        }

        // B. Onaylı Arkadaşlar Listesini Çiz (Detaylı resimli/durumlu)
        const mevcutElemanSayisi = dynamicChatList.querySelectorAll('.chat-item').length;
        if (data.arkadaslar && data.arkadaslar.length > 0) {
            if (mevcutElemanSayisi !== data.arkadaslar.length) {
                dynamicChatList.innerHTML = '';
                data.arkadaslar.forEach(arkadas => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    if (secilenAliciNickname === arkadas.nickname) chatItem.classList.add('active');
                    
                    const imgUrl = arkadas.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${arkadas.nickname}`;
                    
                    chatItem.innerHTML = `
                        <img src="${imgUrl}" class="avatar-img" alt="avatar">
                        <div class="chat-info">
                            <div class="chat-info-top">
                                <span class="chat-name">${arkadas.nickname}</span>
                            </div>
                            <span class="chat-preview" id="preview-${arkadas.nickname}">${arkadas.status || "Sohbet etmek için tıklayın..."}</span>
                        </div>
                    `;
                    chatItem.addEventListener('click', () => {
                        if (secilenAliciNickname !== arkadas.nickname) {
                            sohbetiAc(arkadas.nickname, arkadas.username, arkadas.avatar, arkadas.status, chatItem);
                        } else {
                            sohbetEkraniniAc();
                            messagesBox.scrollTop = messagesBox.scrollHeight;
                        }
                    });
                    dynamicChatList.appendChild(chatItem);
                });
            } else {
                // Eğer liste boyutu aynıysa sadece durum yazılarını ve önizlemeleri güncelle (titremeden)
                data.arkadaslar.forEach(arkadas => {
                    const previewEl = document.getElementById(`preview-${arkadas.nickname}`);
                    if (previewEl && previewEl.textContent.startsWith("Sohbet etmek") && arkadas.status) {
                        previewEl.textContent = arkadas.status;
                    }
                });
            }
        } else {
            dynamicChatList.innerHTML = '<div class="empty-state">Henüz hiç arkadaşınız yok. Üstten ekleyin!</div>';
        }

    } catch (error) {
        console.error("Panel güncellenirken hata:", error);
    }
}

// --- 2. ARKADAŞLIK İSTEĞI GÖNDERME ---
friendForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hedefNickname = friendInput.value.trim();

    try {
        const response = await fetch('/api/arkadas-ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gonderenEposta: aktifKullanici, hedefNickname })
        });
        const data = await response.json();
        alert(data.mesaj);
        friendInput.value = '';
        paneliGuncelle();
    } catch (error) {
        console.error("İstek gönderilemedi:", error);
    }
});

// --- 3. İSTEK CEVAPLAMA MANTIĞI ---
dynamicRequestsList.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('req-btn')) {
        const gonderenNickname = e.target.getAttribute('data-user');
        const eylem = e.target.getAttribute('data-action');

        try {
            const response = await fetch('/api/arkadas-yanitla', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alanEposta: aktifKullanici, gonderenNickname, eylem })
            });
            const data = await response.json();
            alert(data.mesaj);
            paneliGuncelle();
        } catch (error) {
            console.error("İşlem başarısız:", error);
        }
    }
});

// --- 4. SOHBETİ SEÇME VE AKTİF ETME ---
async function sohbetiAc(arkadasNickname, arkadasEposta, avatar, status, eleman) {
    secilenAliciNickname = arkadasNickname;
    secilenAliciEposta = arkadasEposta || null;

    const eskiAktif = document.querySelector('.chat-item.active');
    if (eskiAktif) eskiAktif.classList.remove('active');
    eleman.classList.add('active');

    activeChatTitle.textContent = arkadasNickname;
    activeChatStatus.textContent = status || "Bursat Üyesi";

    if (avatar) {
        activeAvatar.style.display = 'none';
        activeAvatarImg.style.display = 'block';
        activeAvatarImg.src = avatar;
    } else {
        activeAvatarImg.style.display = 'none';
        activeAvatar.style.display = 'grid';
        activeAvatar.textContent = arkadasNickname.charAt(0).toUpperCase();
    }

    await mesajlariCanliGetir();
    messagesBox.scrollTop = messagesBox.scrollHeight;
    sohbetEkraniniAc();
}

// --- 5. MESAJLARI CANLI GÖSTEREN ARKA PLAN MOTORU ---
async function mesajlariCanliGetir() {
    if (!secilenAliciEposta) return;

    try {
        const response = await fetch(`/api/mesajlar-v2/${aktifKullanici}/${secilenAliciEposta}`);
        const mesajlar = await response.json();

        const kullaniciAsagidaMi = messagesBox.scrollHeight - messagesBox.scrollTop <= messagesBox.clientHeight + 100;
        const mevcutMesajSayisi = messagesBox.querySelectorAll('.message').length;

        if (mesajlar.length !== mevcutMesajSayisi) {
            messagesBox.innerHTML = '';
            mesajlar.forEach(m => {
                messagesBox.appendChild(mesajBalonuOlustur(m));
            });

            if (kullaniciAsagidaMi) {
                messagesBox.scrollTop = messagesBox.scrollHeight;
            }
        }
    } catch (error) {
        console.error("Canlı mesajlar çekilirken hata:", error);
    }
}

function mesajBalonuOlustur(mesaj) {
    const mesajBalonu = document.createElement('div');
    mesajBalonu.className = `message ${mesaj.from === aktifKullanici ? 'outgoing' : 'incoming'}`;

    if (mesaj.image) {
        const imageEl = document.createElement('img');
        imageEl.src = mesaj.image;
        imageEl.alt = 'Gönderilen fotoğraf';
        imageEl.className = 'message-image';
        mesajBalonu.appendChild(imageEl);
    }

    if (mesaj.text) {
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = mesaj.text;
        mesajBalonu.appendChild(textEl);
    }

    return mesajBalonu;
}

// --- 6. MESAJ GÖNDERME ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mesajMetni = msgInput.value.trim();
    const mesajDosyasi = chatImageInput.files && chatImageInput.files[0];

    if (!secilenAliciNickname) {
        alert("Lütfen bir arkadaşınızı seçin!");
        return;
    }

    if (!secilenAliciEposta) {
        alert("Seçili sohbet için alıcı bilgisi bulunamadı.");
        return;
    }

    if (!mesajMetni && !mesajDosyasi) {
        alert("Lütfen bir mesaj yazın ya da fotoğraf seçin!");
        return;
    }

    if (mesajDosyasi && !mesajDosyasi.type.startsWith('image/')) {
        alert('Lütfen bir resim dosyası seçin.');
        chatImageInput.value = '';
        return;
    }

    let onizlemeUrl = '';
    let geciciBalon = null;

    try {
        const kucultulmusDosya = mesajDosyasi ? await resimDosyasiniKucult(mesajDosyasi) : null;
        onizlemeUrl = kucultulmusDosya ? URL.createObjectURL(kucultulmusDosya) : '';
        geciciBalon = geciciMesajBalonuOlustur({ text: mesajMetni, imageUrl: onizlemeUrl });
        messagesBox.appendChild(geciciBalon);
        messagesBox.scrollTop = messagesBox.scrollHeight;
        msgInput.value = '';
        chatImageInput.value = '';
        msgInput.focus();

        const formData = new FormData();
        formData.append('fromEposta', aktifKullanici);
        formData.append('toNickname', secilenAliciNickname);
        formData.append('toEposta', secilenAliciEposta);
        formData.append('text', mesajMetni);

        if (kucultulmusDosya) {
            formData.append('messageImage', kucultulmusDosya);
        }

        const response = await fetch('/api/mesaj-gonder-v2', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            if (geciciBalon && geciciBalon.parentNode) {
                geciciBalon.replaceWith(mesajBalonuOlustur(data.yeniMesaj));
            } else {
                messagesBox.appendChild(mesajBalonuOlustur(data.yeniMesaj));
            }
        } else if (geciciBalon && geciciBalon.parentNode) {
            geciciBalon.remove();
            alert(data.mesaj || 'Mesaj gönderilemedi!');
        }
    } catch (error) {
        if (geciciBalon && geciciBalon.parentNode) {
            geciciBalon.remove();
        }
        console.error("Mesaj yollanamadı:", error);
        alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
        onizlemeUrliniTemizle(onizlemeUrl);
    }
});

// --- 7. ZAMANLAYICI MOTORU ---
let yenilemeDongusuAktif = false;

async function yenilemeDongusu() {
    if (yenilemeDongusuAktif) return;

    yenilemeDongusuAktif = true;

    try {
        await paneliGuncelle();
        await mesajlariCanliGetir();
    } finally {
        yenilemeDongusuAktif = false;
        setTimeout(yenilemeDongusu, 2000);
    }
}

yenilemeDongusu();
