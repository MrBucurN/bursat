const form = document.querySelector('.register-form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Input alanlarındaki tüm değerleri alıyoruz
    const nickname = document.getElementById('reg-nickname').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Boş alan kontrolü
    if (!nickname || !username || !password || !confirmPassword) {
        alert("Lütfen tüm alanları doldurun! ⚠️");
        return;
    }

    // Şifre eşleşme kontrolü
    if (password !== confirmPassword) {
        alert("Girdiğiniz şifreler birbiriyle uyuşmuyor! ❌");
        return;
    }

    try {
        // Backend'e nickname bilgisini de gönderiyoruz
        const response = await fetch('/kayit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, username, password })
        });

        const data = await response.json();
        alert(data.mesaj);

        if (data.success) {
            window.location.href = 'login.html'; // Başarılıysa giriş sayfasına yolla
        }
    } catch (error) {
        console.error("Hata:", error);
        alert("Kayıt sırasında bir hata oluştu!");
    }
});