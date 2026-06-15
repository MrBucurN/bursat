if (window.location.protocol === 'file:') {
    alert('Sayfayı dosyadan değil, sunucu üzerinden açın: http://localhost:3000');
    window.location.href = 'http://localhost:3000';
}

const form = document.querySelector('.login-form');
const themeToggle = document.getElementById('theme-toggle');

function temaMetniniGuncelle(theme) {
    if (!themeToggle) return;
    const textEl = themeToggle.querySelector('.theme-toggle__text');
    if (textEl) {
        textEl.textContent = theme === 'light' ? 'Karanlık tema' : 'Aydınlık tema';
    }
}

if (themeToggle) {
    temaMetniniGuncelle(document.documentElement.getAttribute('data-theme') || 'dark');

    themeToggle.addEventListener('click', () => {
        const yeniTema = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', yeniTema);
        localStorage.setItem('login-theme', yeniTema);
        temaMetniniGuncelle(yeniTema);
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Lütfen e-posta ve şifrenizi girin! ⚠️');
        return;
    }

    try {
        const response = await fetch('/giris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        alert(data.mesaj);

        if (data.success) {
            sessionStorage.setItem('aktifKullanici', data.username || username);
            window.location.href = 'Dashboard.html';
        }
    } catch (error) {
        console.error('Giriş hatası:', error);
        alert('Giriş sırasında bir hata oluştu! Sunucunun çalıştığından emin olun.');
    }
});
