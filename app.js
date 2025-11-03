// app.js

function checkLogin() {
    // Coba ambil data dari SessionStorage (yang diisi oleh auth.html)
    const storedUser = sessionStorage.getItem('loggedInUser');

    if (storedUser) {
        // Konversi string ke objek
        const user = JSON.parse(storedUser); 
        
        // Cek apakah user yang tersimpan masih ada di data Firestore yang sudah di-load
        loggedInUser = allWargaData.find(w => w.id === user.id);
        
        if (loggedInUser) {
            // Login sukses
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('user-info').textContent = `Logged in: ${loggedInUser.nama}`;
            updateTheme(localStorage.getItem('theme') === 'dark');
            return true;
        }
    } 
    
    // Jika tidak ada di SessionStorage atau data tidak valid, tampilkan layar login
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    return false;
}

// Ubah fungsi handleLogin dan handleLogout

function handleLogin() {
    // Fungsi ini kini tidak lagi diperlukan karena login dilakukan di auth.html
    // Jika Anda ingin mempertahankan fungsi ini sebagai fallback:
    // Pindahkan pengguna ke halaman login
    window.location.href = 'auth.html';
}

function handleLogout() {
    sessionStorage.removeItem('loggedInUser'); // Hapus dari Session Storage
    loggedInUser = null;
    checkLogin();
    showNotification('Anda telah logout.', 'info');
}

// Panggil handleLogin saat tombol login ditekan di index.html
document.getElementById('login-btn').addEventListener('click', handleLogin);
