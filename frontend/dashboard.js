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
let secilenGrupId = null;
let secilenGrup = null;
let secilenGrupAdi = '';
let mevcutNickname = '';
let secilenAvatar = '';
let aktifSohbetToken = 0;
let sohbetTipi = 'private';
const ilkSohbetMesajLimiti = 20;
const sohbetYenilemeAraligiMs = 2000;
const panelYenilemeAraligiMs = 10000;
const bildirimYenilemeAraligiMs = 4000;
let bildirimAyarlar = { mutedPrivateEpostalar: [], mutedGroupIds: [] };
let sonArkadasListeAnahtari = '';
let sonBildirimler = [];

// DOM Elemanları
const bursatContainer = document.getElementById('bursat-container');
const friendForm = document.getElementById('friend-form');
const friendInput = document.getElementById('friend-username-input');
const groupForm = document.getElementById('group-form');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersInput = document.getElementById('group-members-input');
const requestsBox = document.getElementById('requests-box');
const dynamicRequestsList = document.getElementById('dynamic-requests-list');
const dynamicChatList = document.getElementById('dynamic-chat-list');
const dynamicGroupList = document.getElementById('dynamic-group-list');

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
const groupActionsBar = document.getElementById('group-actions');
const groupSettingsBtn = document.getElementById('group-settings-btn');
const groupInviteBtn = document.getElementById('group-invite-btn');
const groupKickBtn = document.getElementById('group-kick-btn');
const groupLeaveBtn = document.getElementById('group-leave-btn');
const groupSettingsMainArea = document.getElementById('group-settings-main-area');
const closeGroupSettingsBtn = document.getElementById('close-group-settings-btn');
const groupSettingsTitle = document.getElementById('group-settings-title');
const groupSettingsSummary = document.getElementById('group-settings-summary');
const groupRoleForm = document.getElementById('group-role-form');
const groupRoleMember = document.getElementById('group-role-member');
const groupRoleSelect = document.getElementById('group-role-select');
const groupMuteForm = document.getElementById('group-mute-form');
const groupMuteMember = document.getElementById('group-mute-member');
const groupMuteAction = document.getElementById('group-mute-action');
const groupRemoveForm = document.getElementById('group-remove-form');
const groupRemoveMember = document.getElementById('group-remove-member');
const groupMemberList = document.getElementById('group-member-list');

const messagesBox = document.getElementById('messages-box');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const notificationPermissionBtn = document.getElementById('notification-permission-btn');
const notificationBadge = document.getElementById('notification-badge');
const notificationPanel = document.getElementById('notification-panel');
const notificationList = document.getElementById('notification-list');
const clearNotificationsBtn = document.getElementById('clear-notifications-btn');
const chatMuteBtn = document.getElementById('chat-mute-btn');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function ozelBildirimSusturulduMu(eposta) {
    const hedef = normalizeEmail(eposta);
    return !!hedef && bildirimAyarlar.mutedPrivateEpostalar.map(normalizeEmail).includes(hedef);
}

function grupBildirimSusturulduMu(groupId) {
    const hedef = String(groupId || '');
    return !!hedef && bildirimAyarlar.mutedGroupIds.map(String).includes(hedef);
}

function aktifSohbetSusturulduMu() {
    if (sohbetTipi === 'group') {
        return grupBildirimSusturulduMu(secilenGrupId);
    }

    return ozelBildirimSusturulduMu(secilenAliciEposta);
}

function bildirimButonunuGuncelle() {
    if (!notificationPermissionBtn) return;

    const destekleniyor = 'Notification' in window;
    notificationPermissionBtn.disabled = !destekleniyor;
    notificationPermissionBtn.classList.toggle('is-denied', destekleniyor && Notification.permission === 'denied');
    notificationPermissionBtn.title = destekleniyor
        ? (Notification.permission === 'granted' ? 'Bildirimler açık' : 'Bildirim izni ver')
        : 'Bu tarayıcı bildirimleri desteklemiyor';
}

function sohbetSusturmaButonunuGuncelle() {
    if (!chatMuteBtn) return;

    const seciliSohbetVar = sohbetTipi === 'group' ? !!secilenGrupId : !!secilenAliciEposta;
    if (!seciliSohbetVar) {
        chatMuteBtn.style.display = 'none';
        return;
    }

    const susturuldu = aktifSohbetSusturulduMu();
    chatMuteBtn.style.display = 'grid';
    chatMuteBtn.classList.toggle('is-muted', susturuldu);
    chatMuteBtn.textContent = susturuldu ? '🔔' : '🔕';
    chatMuteBtn.title = susturuldu ? 'Bu sohbetin bildirimlerini aç' : 'Bu sohbetin bildirimlerini sustur';
    chatMuteBtn.setAttribute('aria-label', chatMuteBtn.title);
}

function bildirimleriCiz(bildirimler, unreadCount) {
    sonBildirimler = Array.isArray(bildirimler) ? bildirimler : [];

    if (notificationBadge) {
        if (unreadCount > 0) {
            notificationBadge.style.display = 'inline-flex';
            notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        } else {
            notificationBadge.style.display = 'none';
            notificationBadge.textContent = '0';
        }
    }

    if (!notificationList) return;

    notificationList.innerHTML = '';
    if (sonBildirimler.length === 0) {
        notificationList.innerHTML = '<div class="empty-state">Yeni bildirim yok.</div>';
        return;
    }

    sonBildirimler.forEach((bildirim) => {
        const item = document.createElement('div');
        item.className = 'notification-item';
        item.dataset.notificationId = bildirim._id || '';

        const title = document.createElement('div');
        title.className = 'notification-item-title';
        title.textContent = bildirim.title || 'Bildirim';

        const body = document.createElement('div');
        body.className = 'notification-item-body';
        body.textContent = bildirim.body || '';

        item.appendChild(title);
        item.appendChild(body);
        notificationList.appendChild(item);
    });
}

function tarayiciBildirimiGoster(bildirim) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !bildirim.newForDevice) {
        return;
    }

    const browserNotification = new Notification(bildirim.title || 'Bursat', {
        body: bildirim.body || 'Yeni bildirim',
        tag: bildirim._id || `${bildirim.type}-${Date.now()}`,
        silent: false
    });

    browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
    };
}

async function bildirimAyarlariniYukle() {
    try {
        const response = await fetch(`/api/bildirim-ayarlar/${aktifKullanici}`);
        const data = await response.json();

        if (data.success) {
            bildirimAyarlar = {
                mutedPrivateEpostalar: (data.mutedPrivateEpostalar || []).map(normalizeEmail),
                mutedGroupIds: (data.mutedGroupIds || []).map(String)
            };
            sohbetSusturmaButonunuGuncelle();
        }
    } catch (error) {
        console.error('Bildirim ayarları alınamadı:', error);
    }
}

async function bildirimleriYokla() {
    try {
        const response = await fetch(`/api/bildirimler/${aktifKullanici}?limit=15`);
        const data = await response.json();

        if (data.success) {
            (data.notifications || []).forEach(tarayiciBildirimiGoster);
            bildirimleriCiz(data.notifications || [], data.unreadCount || 0);
        }
    } catch (error) {
        console.error('Bildirimler alınamadı:', error);
    }
}

async function seciliSohbetBildirimSusturmaGuncelle() {
    if (!chatMuteBtn) return;

    const type = sohbetTipi === 'group' ? 'group' : 'private';
    const target = type === 'group' ? secilenGrupId : secilenAliciEposta;
    if (!target) return;

    const muted = !aktifSohbetSusturulduMu();
    chatMuteBtn.disabled = true;

    try {
        const response = await fetch('/api/bildirim-sustur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eposta: aktifKullanici, type, target, muted })
        });
        const data = await response.json();

        if (!data.success) {
            alert(data.mesaj || 'Bildirim ayarı güncellenemedi.');
            return;
        }

        bildirimAyarlar = {
            mutedPrivateEpostalar: (data.mutedPrivateEpostalar || []).map(normalizeEmail),
            mutedGroupIds: (data.mutedGroupIds || []).map(String)
        };
        sohbetSusturmaButonunuGuncelle();
        await paneliGuncelle();
    } catch (error) {
        console.error('Bildirim susturma güncellenemedi:', error);
    } finally {
        chatMuteBtn.disabled = false;
    }
}

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
    if (groupSettingsMainArea) groupSettingsMainArea.style.display = 'none';
    bursatContainer.classList.remove('chat-is-open');
    bursatContainer.classList.add('settings-is-open');
}

function grupAyarlariniAc() {
    chatMainArea.style.display = 'none';
    settingsMainArea.style.display = 'none';
    if (groupSettingsMainArea) groupSettingsMainArea.style.display = 'flex';
    bursatContainer.classList.remove('chat-is-open', 'settings-is-open');
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

function grupIslemleriniGuncelle() {
    const grupAcikMi = sohbetTipi === 'group' && secilenGrupId;
    if (!groupActionsBar) return;

    groupActionsBar.style.display = grupAcikMi ? 'flex' : 'none';

    if (groupInviteBtn) {
        groupInviteBtn.style.display = grupAcikMi ? 'inline-flex' : 'none';
    }

    if (groupKickBtn) {
        const yoneticiMi = secilenGrup && secilenGrup.creatorEposta === aktifKullanici;
        groupKickBtn.style.display = grupAcikMi && yoneticiMi ? 'inline-flex' : 'none';
    }

    if (groupLeaveBtn) {
        groupLeaveBtn.style.display = grupAcikMi ? 'inline-flex' : 'none';
    }

    if (groupSettingsBtn) {
        groupSettingsBtn.style.display = grupAcikMi ? 'inline-flex' : 'none';
    }
}

function sohbetPenceresiniSifirla() {
    aktifSohbetKartlariniKaldir();
    secilenAliciNickname = null;
    secilenAliciEposta = null;
    secilenGrupId = null;
    secilenGrup = null;
    secilenGrupAdi = '';
    sohbetTipi = 'private';

    activeChatTitle.textContent = 'Bir sohbet seçin';
    activeChatStatus.textContent = 'Bursat Mesajlaşma';
    activeAvatarImg.style.display = 'none';
    activeAvatar.style.display = 'grid';
    activeAvatar.textContent = '?';
    messagesBox.innerHTML = '<div class="message incoming" style="align-self: center; border-radius: 12px; font-size: 0.85rem; background: var(--input-bg); opacity: 0.7;">Sohbete başlamak için soldan bir arkadaş seçin veya sağ alttaki ⚙️ simgesinden profilinizi düzenleyin!</div>';
    grupIslemleriniGuncelle();
    sohbetSusturmaButonunuGuncelle();
}

function roleLabel(role) {
    if (role === 'yonetici') return 'Yönetici';
    if (role === 'yardimci') return 'Yardımcı';
    return 'Üye';
}

function renderGroupMemberOptions(members) {
    const optionsHtml = members.map((member) => `<option value="${member.eposta}">${member.nickname} (${roleLabel(member.role)})</option>`).join('');
    if (groupRoleMember) groupRoleMember.innerHTML = optionsHtml;
    if (groupMuteMember) groupMuteMember.innerHTML = optionsHtml;
    if (groupRemoveMember) groupRemoveMember.innerHTML = optionsHtml;
}

function renderGroupMemberList(members) {
    if (!groupMemberList) return;

    groupMemberList.innerHTML = '';
    members.forEach((member) => {
        const item = document.createElement('div');
        item.className = 'group-member-item';

        const avatarSrc = member.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.nickname}`;
        const canManageRoles = secilenGrup && secilenGrup.currentUserRole === 'yonetici';
        const canManageMute = secilenGrup && (secilenGrup.currentUserRole === 'yonetici' || secilenGrup.currentUserRole === 'yardimci');
        const self = member.eposta === aktifKullanici;
        const isCreator = secilenGrup && member.eposta === secilenGrup.creatorEposta;

        const roleButtons = [];
        if (canManageRoles && member.role !== 'yonetici') {
            roleButtons.push(`<button type="button" data-action="set-role" data-target="${member.eposta}" data-role="yardimci">Yardımcı Yap</button>`);
            roleButtons.push(`<button type="button" data-action="set-role" data-target="${member.eposta}" data-role="uye">Üye Yap</button>`);
            if (!isCreator) {
                roleButtons.push(`<button type="button" data-action="set-role" data-target="${member.eposta}" data-role="yonetici">Yönetici Yap</button>`);
            }
        }

        if (canManageMute && member.role !== 'yonetici') {
            if (member.muted) {
                roleButtons.push(`<button type="button" data-action="unmute" data-target="${member.eposta}">Mute Kaldır</button>`);
            } else {
                roleButtons.push(`<button type="button" data-action="mute" data-target="${member.eposta}">Mute At</button>`);
            }
        }

        if (canManageRoles && !self && !isCreator) {
            roleButtons.push(`<button type="button" data-action="remove" data-target="${member.eposta}" class="danger-btn">Çıkar</button>`);
        }

        item.innerHTML = `
            <div class="group-member-left">
                <img class="group-member-avatar" src="${avatarSrc}" alt="${member.nickname}">
                <div class="group-member-name-wrap">
                    <div class="group-member-name">${member.nickname}</div>
                    <div class="group-member-email">${member.eposta}</div>
                </div>
            </div>
            <div class="group-member-actions">
                <span class="group-role-badge role-${member.role}">${roleLabel(member.role)}</span>
                ${roleButtons.join('')}
            </div>
        `;

        groupMemberList.appendChild(item);
    });
}

async function grupAyarlariniYukle() {
    if (!secilenGrupId) return;

    try {
        const response = await fetch(`/api/grup-ayarlari/${aktifKullanici}/${secilenGrupId}`);
        const data = await response.json();

        if (!data.success) {
            alert(data.mesaj || 'Grup ayarları alınamadı.');
            return;
        }

        secilenGrup = { ...(secilenGrup || {}), ...data.grup };

        if (groupSettingsTitle) {
            groupSettingsTitle.textContent = `${data.grup.name} Ayarları`;
        }

        if (groupSettingsSummary) {
            groupSettingsSummary.textContent = `Rolünüz: ${roleLabel(data.grup.currentUserRole)} | Üye sayısı: ${data.grup.memberCount}`;
        }

        renderGroupMemberOptions(data.members || []);
        renderGroupMemberList(data.members || []);

        if (groupRoleForm) groupRoleForm.style.display = data.grup.canManageRoles ? 'grid' : 'none';
        if (groupMuteForm) groupMuteForm.style.display = data.grup.canManageMute ? 'grid' : 'none';
        if (groupRemoveForm) groupRemoveForm.style.display = data.grup.canManageRoles ? 'grid' : 'none';

        grupAyarlariniAc();
    } catch (error) {
        console.error('Grup ayarları yüklenemedi:', error);
    }
}

function kapatGrupAyarPaneli() {
    if (groupSettingsMainArea) groupSettingsMainArea.style.display = 'none';
    if (sohbetTipi === 'group' && secilenGrupId) {
        sohbetEkraniniAc();
        grupIslemleriniGuncelle();
    } else {
        listeEkraniniAc();
    }
}

function aktifSohbetKartlariniKaldir() {
    document.querySelectorAll('.chat-item.active, .group-item.active').forEach((item) => {
        item.classList.remove('active');
    });
}

function grubuSec(grup, eleman) {
    aktifSohbetToken += 1;
    secilenAliciNickname = null;
    secilenAliciEposta = null;
    secilenGrupId = grup._id;
    secilenGrup = grup;
    secilenGrupAdi = grup.name;
    sohbetTipi = 'group';

    aktifSohbetKartlariniKaldir();
    if (eleman) {
        eleman.classList.add('active');
    }

    activeChatTitle.textContent = grup.name;
    activeChatStatus.textContent = `${grup.memberCount || 0} üye`;
    activeAvatarImg.style.display = 'none';
    activeAvatar.style.display = 'grid';
    activeAvatar.textContent = (grup.name || 'G').trim().charAt(0).toUpperCase();
    messagesBox.innerHTML = '<div class="empty-state">Grup yükleniyor...</div>';
    grupIslemleriniGuncelle();
    sohbetSusturmaButonunuGuncelle();
}

function ozelSohbetiSec(arkadasNickname, arkadasEposta, avatar, status, eleman) {
    aktifSohbetToken += 1;
    secilenAliciNickname = arkadasNickname;
    secilenAliciEposta = arkadasEposta || null;
    secilenGrupId = null;
    secilenGrup = null;
    secilenGrupAdi = '';
    sohbetTipi = 'private';

    aktifSohbetKartlariniKaldir();
    if (eleman) {
        eleman.classList.add('active');
    }

    messagesBox.innerHTML = '<div class="empty-state">Sohbet yükleniyor...</div>';

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

    grupIslemleriniGuncelle();
    sohbetSusturmaButonunuGuncelle();
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

if (notificationPermissionBtn) {
    notificationPermissionBtn.addEventListener('click', async () => {
        if (notificationPanel) {
            notificationPanel.hidden = !notificationPanel.hidden;
        }

        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
            bildirimButonunuGuncelle();
        }

        await bildirimleriYokla();
    });
}

if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/bildirim-okundu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici })
            });
            bildirimleriCiz([], 0);
        } catch (error) {
            console.error('Bildirimler okundu yapılamadı:', error);
        }
    });
}

if (notificationList) {
    notificationList.addEventListener('click', async (e) => {
        const item = e.target.closest('.notification-item');
        if (!item) return;

        const notificationId = item.dataset.notificationId;
        try {
            await fetch('/api/bildirim-okundu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, notificationId })
            });
            item.remove();
            await bildirimleriYokla();
        } catch (error) {
            console.error('Bildirim okundu yapılamadı:', error);
        }
    });
}

if (chatMuteBtn) {
    chatMuteBtn.addEventListener('click', seciliSohbetBildirimSusturmaGuncelle);
}

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

if (groupSettingsBtn) {
    groupSettingsBtn.addEventListener('click', () => {
        grupAyarlariniYukle();
    });
}

if (closeGroupSettingsBtn) {
    closeGroupSettingsBtn.addEventListener('click', () => {
        kapatGrupAyarPaneli();
    });
}

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

        const groupResponse = await fetch(`/api/gruplar/${aktifKullanici}`);
        const groupData = await groupResponse.json();

        dynamicGroupList.innerHTML = '';
        if (groupData.gruplar && groupData.gruplar.length > 0) {
            groupData.gruplar.forEach((grup) => {
                const groupItem = document.createElement('div');
                groupItem.className = 'group-item';
                if (secilenGrupId === grup._id) groupItem.classList.add('active');
                if (secilenGrupId === grup._id) secilenGrup = grup;

                groupItem.innerHTML = `
                    <div class="group-badge">${(grup.name || 'G').trim().charAt(0).toUpperCase()}</div>
                    <div class="group-info">
                        <div class="chat-info-top">
                            <span class="chat-name">${grup.name}</span>
                        </div>
                        <div class="group-meta">${grup.memberCount || 0} üye</div>
                    </div>
                `;

                groupItem.addEventListener('click', () => {
                    if (secilenGrupId !== grup._id) {
                        grubuSec(grup, groupItem);
                        mesajlariCanliGetir();
                    } else {
                        sohbetEkraniniAc();
                        messagesBox.scrollTop = messagesBox.scrollHeight;
                    }
                });

                dynamicGroupList.appendChild(groupItem);
            });
        } else {
            dynamicGroupList.innerHTML = '<div class="empty-state">Henüz grup yok. İlk grubunu kur!</div>';
        }

        grupIslemleriniGuncelle();

        if (sohbetTipi === 'group' && secilenGrupId && !(groupData.gruplar || []).some((grup) => String(grup._id) === String(secilenGrupId))) {
            sohbetPenceresiniSifirla();
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

groupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const grupAdi = groupNameInput.value.trim();
    const uyeler = groupMembersInput.value.trim();

    if (!grupAdi) {
        alert('Grup adı boş bırakılamaz!');
        return;
    }

    try {
        const response = await fetch('/api/grup-kur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eposta: aktifKullanici, grupAdi, uyeler })
        });
        const data = await response.json();
        alert(data.mesaj);

        if (data.success) {
            groupNameInput.value = '';
            groupMembersInput.value = '';
            if (data.grup) {
                grubuSec({ _id: data.grup._id, name: data.grup.name, memberCount: data.grup.memberCount || 0, creatorEposta: data.grup.creatorEposta || aktifKullanici });
            }
            await paneliGuncelle();
            await mesajlariCanliGetir();
        }
    } catch (error) {
        console.error('Grup kurma isteği başarısız:', error);
    }
});

if (groupRoleForm) {
    groupRoleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!secilenGrupId) return;

        const hedef = groupRoleMember.value;
        const rol = groupRoleSelect.value;

        try {
            const response = await fetch('/api/grup-rol-guncelle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef, rol })
            });
            const data = await response.json();
            alert(data.mesaj);
            if (data.success) {
                await grupAyarlariniYukle();
                await paneliGuncelle();
            }
        } catch (error) {
            console.error('Rol güncelleme başarısız:', error);
        }
    });
}

if (groupMuteForm) {
    groupMuteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!secilenGrupId) return;

        const hedef = groupMuteMember.value;
        const mute = groupMuteAction.value === 'mute';

        try {
            const response = await fetch('/api/grup-mute-toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef, mute })
            });
            const data = await response.json();
            alert(data.mesaj);
            if (data.success) {
                await grupAyarlariniYukle();
                await paneliGuncelle();
            }
        } catch (error) {
            console.error('Mute işlemi başarısız:', error);
        }
    });
}

if (groupRemoveForm) {
    groupRemoveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!secilenGrupId) return;

        const hedef = groupRemoveMember.value;
        const onay = window.confirm('Seçili üyeyi gruptan çıkarmak istiyor musunuz?');
        if (!onay) return;

        try {
            const response = await fetch('/api/gruptan-cikar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef })
            });
            const data = await response.json();
            alert(data.mesaj);
            if (data.success) {
                if (data.grupSilindi) {
                    sohbetPenceresiniSifirla();
                } else {
                    await grupAyarlariniYukle();
                    await paneliGuncelle();
                }
            }
        } catch (error) {
            console.error('Üye çıkarma başarısız:', error);
        }
    });
}

if (groupMemberList) {
    groupMemberList.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button || !secilenGrupId) return;

        const hedef = button.getAttribute('data-target');
        const action = button.getAttribute('data-action');
        const role = button.getAttribute('data-role');

        if (action === 'remove') {
            const onay = window.confirm('Bu üyeyi gruptan çıkarmak istiyor musunuz?');
            if (!onay) return;

            try {
                const response = await fetch('/api/gruptan-cikar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef })
                });
                const data = await response.json();
                alert(data.mesaj);
                if (data.success) {
                    if (data.grupSilindi) {
                        sohbetPenceresiniSifirla();
                    } else {
                        await grupAyarlariniYukle();
                        await paneliGuncelle();
                    }
                }
            } catch (error) {
                console.error('Hızlı çıkarma başarısız:', error);
            }
            return;
        }

        if (action === 'mute' || action === 'unmute') {
            try {
                const response = await fetch('/api/grup-mute-toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef, mute: action === 'mute' })
                });
                const data = await response.json();
                alert(data.mesaj);
                if (data.success) {
                    await grupAyarlariniYukle();
                }
            } catch (error) {
                console.error('Mute toggle başarısız:', error);
            }
            return;
        }

        if (action === 'set-role' && role) {
            try {
                const response = await fetch('/api/grup-rol-guncelle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef, rol: role })
                });
                const data = await response.json();
                alert(data.mesaj);
                if (data.success) {
                    await grupAyarlariniYukle();
                    await paneliGuncelle();
                }
            } catch (error) {
                console.error('Rol kısayolu başarısız:', error);
            }
        }
    });
}

if (groupInviteBtn) {
    groupInviteBtn.addEventListener('click', async () => {
        if (!secilenGrupId) return;

        const uyeler = window.prompt('Davet etmek istediğiniz kullanıcı adı veya e-posta adreslerini virgülle ayırarak yazın:');
        if (!uyeler || !uyeler.trim()) return;

        try {
            const response = await fetch('/api/grup-davet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, uyeler })
            });
            const data = await response.json();
            alert(data.mesaj);

            if (data.success) {
                if (data.grup) {
                    secilenGrup = { ...secilenGrup, ...data.grup };
                    activeChatStatus.textContent = `${data.grup.memberCount || 0} üye`;
                }
                await paneliGuncelle();
            }
        } catch (error) {
            console.error('Grup daveti başarısız:', error);
        }
    });
}

if (groupLeaveBtn) {
    groupLeaveBtn.addEventListener('click', async () => {
        if (!secilenGrupId) return;

        const onay = window.confirm('Bu gruptan ayrılmak istiyor musunuz?');
        if (!onay) return;

        try {
            const response = await fetch('/api/gruptan-ayril', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId })
            });
            const data = await response.json();
            alert(data.mesaj);

            if (data.success) {
                if (data.grupSilindi) {
                    sohbetPenceresiniSifirla();
                } else if (data.grup) {
                    secilenGrup = { ...secilenGrup, ...data.grup };
                    sohbetPenceresiniSifirla();
                }
                await paneliGuncelle();
            }
        } catch (error) {
            console.error('Gruptan ayrılma başarısız:', error);
        }
    });
}

if (groupKickBtn) {
    groupKickBtn.addEventListener('click', async () => {
        if (!secilenGrupId) return;

        const hedef = window.prompt('Çıkarmak istediğiniz kullanıcı adı veya e-posta adresini yazın:');
        if (!hedef || !hedef.trim()) return;

        try {
            const response = await fetch('/api/gruptan-cikar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eposta: aktifKullanici, groupId: secilenGrupId, hedef })
            });
            const data = await response.json();
            alert(data.mesaj);

            if (data.success) {
                if (data.grup) {
                    secilenGrup = { ...secilenGrup, ...data.grup };
                    activeChatStatus.textContent = `${data.grup.memberCount || 0} üye`;
                } else if (data.grupSilindi) {
                    sohbetPenceresiniSifirla();
                }
                await paneliGuncelle();
            }
        } catch (error) {
            console.error('Üye çıkarma başarısız:', error);
        }
    });
}

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
    ozelSohbetiSec(arkadasNickname, arkadasEposta, avatar, status, eleman);
    const buSohbetToken = aktifSohbetToken;
    await mesajlariCanliGetir(buSohbetToken);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    sohbetEkraniniAc();
}

// --- 5. MESAJLARI CANLI GÖSTEREN ARKA PLAN MOTORU ---
async function mesajlariCanliGetir(sohbetToken = aktifSohbetToken) {
    if (sohbetTipi === 'group') {
        if (!secilenGrupId) return;

        try {
            const response = await fetch(`/api/grup-mesajlari/${aktifKullanici}/${secilenGrupId}?limit=${ilkSohbetMesajLimiti}`);
            const mesajlar = await response.json();

            if (sohbetToken !== aktifSohbetToken) {
                return;
            }

            const kullaniciAsagidaMi = messagesBox.scrollHeight - messagesBox.scrollTop <= messagesBox.clientHeight + 100;
            const mevcutMesajSayisi = messagesBox.querySelectorAll('.message').length;

            if (mesajlar.length !== mevcutMesajSayisi) {
                messagesBox.innerHTML = '';
                if (mesajlar.length === 0) {
                    messagesBox.innerHTML = '<div class="empty-state">Henüz grup mesajı yok. İlk mesajı sen gönder.</div>';
                } else {
                    mesajlar.forEach(m => {
                        messagesBox.appendChild(mesajBalonuOlustur(m));
                    });

                    if (kullaniciAsagidaMi) {
                        messagesBox.scrollTop = messagesBox.scrollHeight;
                    }
                }
            }
        } catch (error) {
            console.error('Grup mesajları çekilirken hata:', error);
        }

        return;
    }

    if (!secilenAliciEposta) return;

    try {
        const response = await fetch(`/api/mesajlar-v2/${aktifKullanici}/${secilenAliciEposta}?limit=${ilkSohbetMesajLimiti}`);
        const mesajlar = await response.json();

        if (sohbetToken !== aktifSohbetToken) {
            return;
        }

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
    const outgoing = mesaj.from === aktifKullanici;
    mesajBalonu.className = `message ${outgoing ? 'outgoing' : 'incoming'}`;

    if (sohbetTipi === 'group' && !outgoing) {
        const senderEl = document.createElement('div');
        senderEl.className = 'message-sender';
        senderEl.textContent = mesaj.fromNickname || mesaj.from || 'Üye';
        mesajBalonu.appendChild(senderEl);
    }

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

    if (sohbetTipi === 'group') {
        if (!secilenGrupId) {
            alert('Lütfen bir grup seçin!');
            return;
        }
    } else {
        if (!secilenAliciNickname) {
            alert("Lütfen bir arkadaşınızı seçin!");
            return;
        }

        if (!secilenAliciEposta) {
            alert("Seçili sohbet için alıcı bilgisi bulunamadı.");
            return;
        }
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
        formData.append('text', mesajMetni);

        if (kucultulmusDosya) {
            formData.append('messageImage', kucultulmusDosya);
        }

        const endpoint = sohbetTipi === 'group' ? '/api/grup-mesaj-gonder' : '/api/mesaj-gonder-v2';

        if (sohbetTipi === 'group') {
            formData.append('groupId', secilenGrupId);
        } else {
            formData.append('toNickname', secilenAliciNickname);
            formData.append('toEposta', secilenAliciEposta);
        }

        const response = await fetch(endpoint, {
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
            messagesBox.scrollTop = messagesBox.scrollHeight;
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
let panelYenilemeDongusuAktif = false;

async function yenilemeDongusu() {
    if (yenilemeDongusuAktif) return;

    yenilemeDongusuAktif = true;

    try {
        await paneliGuncelle();
        await mesajlariCanliGetir();
    } finally {
        yenilemeDongusuAktif = false;
        setTimeout(yenilemeDongusu, sohbetYenilemeAraligiMs);
    }
}

async function panelYenilemeDongusu() {
    if (panelYenilemeDongusuAktif) return;

    panelYenilemeDongusuAktif = true;

    try {
        await paneliGuncelle();
    } finally {
        panelYenilemeDongusuAktif = false;
        setTimeout(panelYenilemeDongusu, panelYenilemeAraligiMs);
    }
}

panelYenilemeDongusu();
yenilemeDongusu();
