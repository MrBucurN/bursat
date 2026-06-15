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

// DOM Elemanları
const friendForm = document.getElementById('friend-form');
const friendInput = document.getElementById('friend-username-input');
const requestsBox = document.getElementById('requests-box');
const dynamicRequestsList = document.getElementById('dynamic-requests-list');
const dynamicChatList = document.getElementById('dynamic-chat-list');

const chatMainArea = document.getElementById('chat-main-area');
const settingsMainArea = document.getElementById('settings-main-area');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsForm = document.getElementById('settings-form');

const activeChatTitle = document.getElementById('active-chat-title');
const activeChatStatus = document.getElementById('active-chat-status');
const activeAvatar = document.getElementById('active-avatar');
const activeAvatarImg = document.getElementById('active-avatar-img');

const messagesBox = document.getElementById('messages-box');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');

// --- PANELLER ARASI GEÇİŞ (AYARLAR MANTIĞI) ---
openSettingsBtn.addEventListener('click', () => {
    chatMainArea.style.display = 'none';
    settingsMainArea.style.display = 'flex';
    // Mevcut profil verilerimizi kutucuklara dolduralım
    fetch(`/api/profil-getir/${aktifKullanici}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('set-avatar-url').value = data.avatar || '';
            document.getElementById('set-status-text').value = data.status || '';
        });
});

closeSettingsBtn.addEventListener('click', () => {
    settingsMainArea.style.display = 'none';
    chatMainArea.style.display = 'flex';
});

// PROFİL AYARLARINI KAYDETME
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const avatar = document.getElementById('set-avatar-url').value.trim();
    const status = document.getElementById('set-status-text').value.trim();

    try {
        const response = await fetch('/api/profil-guncelle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eposta: aktifKullanici, avatar, status })
        });
        const data = await response.json();
        alert(data.mesaj);
        settingsMainArea.style.display = 'none';
        chatMainArea.style.display = 'flex';
        paneliGuncelle(); // Alt barı anında tazele
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
                            sohbetiAc(arkadas.nickname, arkadas.avatar, arkadas.status, chatItem);
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
            dynamicChatList.innerHTML = '<div style="font-size:0.85rem; color:var(--text-muted); padding:1rem;">Henüz hiç arkadaşınız yok. Üstten ekleyin!</div>';
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
async function sohbetiAc(arkadasNickname, avatar, status, eleman) {
    secilenAliciNickname = arkadasNickname;

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
}

// --- 5. MESAJLARI CANLI GÖSTEREN ARKA PLAN MOTORU ---
async function mesajlariCanliGetir() {
    if (!secilenAliciNickname) return;

    try {
        const response = await fetch(`/api/mesajlar-v2/${aktifKullanici}/${secilenAliciNickname}`);
        const mesajlar = await response.json();

        const kullaniciAsagidaMi = messagesBox.scrollHeight - messagesBox.scrollTop <= messagesBox.clientHeight + 100;
        const mevcutMesajSayisi = messagesBox.querySelectorAll('.message').length;

        if (mesajlar.length !== mevcutMesajSayisi) {
            messagesBox.innerHTML = '';
            mesajlar.forEach(m => {
                const mesajBalonu = document.createElement('div');
                mesajBalonu.className = `message ${m.from === aktifKullanici ? 'outgoing' : 'incoming'}`;
                mesajBalonu.textContent = m.text;
                messagesBox.appendChild(mesajBalonu);
            });

            if (kullaniciAsagidaMi) {
                messagesBox.scrollTop = messagesBox.scrollHeight;
            }
        }
    } catch (error) {
        console.error("Canlı mesajlar çekilirken hata:", error);
    }
}

// --- 6. MESAJ GÖNDERME ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mesajMetni = msgInput.value.trim();

    if (!mesajMetni || !secilenAliciNickname) {
        alert("Lütfen bir arkadaşınızı seçin!");
        return;
    }

    try {
        const response = await fetch('/api/mesaj-gonder-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromEposta: aktifKullanici,
                toNickname: secilenAliciNickname,
                text: mesajMetni
            })
        });
        const data = await response.json();
        if (data.success) {
            const mesajBalonu = document.createElement('div');
            mesajBalonu.className = 'message outgoing';
            mesajBalonu.textContent = data.yeniMesaj.text;
            messagesBox.appendChild(mesajBalonu);
            messagesBox.scrollTop = messagesBox.scrollHeight;
            msgInput.value = '';
        }
    } catch (error) {
        console.error("Mesaj yollanamadı:", error);
    }
});

// --- 7. ZAMANLAYICI MOTORU ---
paneliGuncelle();
setInterval(() => {
    paneliGuncelle();
    mesajlariCanliGetir();
}, 2000);