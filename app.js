// app.js (Ganti/Modifikasi bagian DOMContentLoaded)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Dapatkan status Auth dari Firebase
    auth.onAuthStateChanged(async (userAuth) => {
        if (userAuth) {
            // Pengguna sedang login

            // 2. Ambil Profil Warga dari Firestore (untuk mendapatkan 'role')
            const doc = await WARGA_COLLECTION.doc(userAuth.uid).get();
            
            if (doc.exists) {
                // Berhasil login dan profil ditemukan

                // Set status login
                loggedInUser = { id: userAuth.uid, ...doc.data() };
                sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

                // 3. Tampilkan Dasbor
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                document.getElementById('user-info').textContent = `Logged in: ${loggedInUser.nama} (${loggedInUser.role.toUpperCase()})`;
                
                // 4. Lanjutkan inisialisasi aplikasi (listener Firestore)
                setupFirestoreListeners(); // Panggil fungsi yang menginisialisasi listener data
                
                // 5. Terapkan Batasan Role
                updateAdminAccessUI(); 
                
            } else {
                // User Auth ada, tapi profil di Firestore hilang
                auth.signOut();
                window.location.href = 'auth.html';
            }

        } else {
            // Pengguna sedang logout
            loggedInUser = null;
            sessionStorage.removeItem('loggedInUser');
            
            // Redirect ke halaman login jika bukan halaman auth.html
            // Karena kita ada di index.html, kita harus redirect.
            window.location.href = 'auth.html'; 
        }
    });

    // ... (Logika event listener untuk tombol-tombol modal/navigation, dll.) ...
    
    // PENTING: Panggil fungsi untuk menginisialisasi navigasi/tab/modal di sini
    // Misalnya: initNavigation(); initModalListeners();

});


// 🟥 FUNGSI BARU/MODIFIKASI: Menyiapkan Listener Data 🟥
function setupFirestoreListeners() {
    // Listener untuk data Warga
    WARGA_COLLECTION.onSnapshot(snapshot => {
        allWargaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // ... panggil fungsi yang me-render list warga ...
    });

    // Listener untuk data Transaksi
    TRANSAKSI_COLLECTION.orderBy('tanggal', 'desc').onSnapshot(snapshot => {
        allTransaksiData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().tanggal }));
        // ... panggil fungsi yang me-render ringkasan/list transaksi ...
    });
}
