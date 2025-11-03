// =======================================================
// app.js: KODE UTAMA APLIKASI KAS WARGA (FIREBASE VERSION)
// =======================================================

// ----------------------------------------------------
// VARIABEL GLOBAL (HARUS ADA)
// ----------------------------------------------------
let loggedInUser = null; 
let allWargaData = [];
let allTransaksiData = [];

// ----------------------------------------------------
// FUNGSI HELPER
// ----------------------------------------------------

function showNotification(message, type = 'info') {
    // Fungsi untuk menampilkan notifikasi di UI
    const container = document.getElementById('notification-container') || document.body;
    const notification = document.createElement('div');
    
    let bgColor, icon;
    if (type === 'success') {
        bgColor = 'bg-green-500'; icon = '✅';
    } else if (type === 'error') {
        bgColor = 'bg-red-500'; icon = '❌';
    } else {
        bgColor = 'bg-blue-500'; icon = 'ℹ️';
    }

    notification.className = `fixed bottom-4 left-1/2 -translate-x-1/2 max-w-xs w-full p-3 mb-2 rounded-lg shadow-lg flex items-center space-x-2 text-white ${bgColor} opacity-0 transform transition-all duration-300 z-50`;
    notification.innerHTML = `<span class="font-bold">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => notification.classList.remove('opacity-0'), 10);
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

function handleLogout() {
    // Menghapus data sesi dan me-redirect ke halaman login
    sessionStorage.removeItem('loggedInUser');
    loggedInUser = null;
    
    // Melakukan logout dari Firebase Authentication
    auth.signOut().then(() => {
        showNotification('Anda telah logout.', 'info');
        // Redirect setelah logout berhasil
        window.location.href = 'auth.html'; 
    }).catch(error => {
        console.error("Logout error:", error);
        showNotification('Gagal logout. Cek koneksi.', 'error');
    });
}


// ----------------------------------------------------
// FUNGSI ROLE-BASED ACCESS CONTROL (RBAC)
// ----------------------------------------------------

function isAdmin() {
    // Cek apakah user sedang login dan role-nya adalah 'admin'
    return loggedInUser && loggedInUser.role === 'admin';
}

function updateAdminAccessUI() {
    // Fungsi untuk menyembunyikan/menampilkan tombol dan elemen admin-only
    const adminFeatures = document.querySelectorAll('.admin-only-feature');
    
    if (isAdmin()) {
        adminFeatures.forEach(el => el.classList.remove('hidden'));
    } else {
        adminFeatures.forEach(el => el.classList.add('hidden'));
    }
}


// ----------------------------------------------------
// FUNGSI DATA & RENDER
// ----------------------------------------------------

function setupFirestoreListeners() {
    // 1. Listener Data Warga
    WARGA_COLLECTION.onSnapshot(snapshot => {
        allWargaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Cek kembali status login setelah data warga terload
        const storedUser = sessionStorage.getItem('loggedInUser');
        if (storedUser) {
             const user = JSON.parse(storedUser); 
             loggedInUser = allWargaData.find(w => w.id === user.id) || null;
        }

        renderWargaList(); // Panggil fungsi render warga
        updateAdminAccessUI(); // Perbarui tampilan jika data role baru terload
    }, error => {
        console.error("Error fetching warga data:", error);
        showNotification('Gagal memuat data warga.', 'error');
    });

    // 2. Listener Data Transaksi
    TRANSAKSI_COLLECTION.orderBy('tanggal', 'desc').onSnapshot(snapshot => {
        allTransaksiData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(), 
            // Pastikan timestamp diubah ke format Date jika diperlukan
            timestamp: doc.data().tanggal 
        }));
        
        renderRingkasanData(); // Panggil fungsi render ringkasan saldo
        renderTransaksiList(); // Panggil fungsi render list transaksi
    }, error => {
        console.error("Error fetching transaksi data:", error);
        showNotification('Gagal memuat data transaksi.', 'error');
    });
}

// *** Placeholder untuk Fungsi Rendering Anda ***
function renderWargaList() { 
    // ... Logika untuk menampilkan daftar warga ... 
}
function renderRingkasanData() { 
    // ... Logika untuk menghitung dan menampilkan saldo kas ...
}
function renderTransaksiList() { 
    // ... Logika untuk menampilkan daftar transaksi ...
}

// ----------------------------------------------------
// FUNGSI WRITE (MENGUBAH DATA) DENGAN PERLINDUNGAN ADMIN
// ----------------------------------------------------

// Contoh Fungsi Penulisan 1: Menyimpan Pengeluaran
function handleSimpanPengeluaran(e) {
    e.preventDefault();
    
    // 🟥 PERLINDUNGAN AKSES ADMIN (Tulis) 🟥
    if (!isAdmin()) {
        showNotification('Akses Ditolak: Hanya Admin yang dapat mencatat transaksi.', 'error');
        // Asumsi ada fungsi untuk menutup modal
        // closeModal('pengeluaran-modal');
        return; 
    }
    // 🟥 LANJUTKAN LOGIKA HANYA JIKA ADMIN 🟥

    const jenis = document.getElementById('pengeluaran-jenis').value;
    const nominal = parseInt(document.getElementById('pengeluaran-nominal').value);
    const keterangan = document.getElementById('pengeluaran-keterangan').value.trim();

    const newTransaction = {
        jenis: 'Pengeluaran',
        kategori: jenis, // (misal: Kas Iuran, Kas Umum)
        nominal: -nominal, // Nominal negatif untuk pengeluaran
        keterangan: keterangan,
        tanggal: firebase.firestore.Timestamp.fromDate(new Date()),
        dicatatOleh: loggedInUser.nama
    };

    TRANSAKSI_COLLECTION.add(newTransaction)
        .then(() => {
            showNotification('Pengeluaran berhasil dicatat!', 'success');
            // closeModal('pengeluaran-modal');
        })
        .catch(error => {
            console.error("Error adding document: ", error);
            showNotification('Gagal mencatat. Cek Firestore Rules atau koneksi.', 'error');
        });
}

// Contoh Fungsi Penulisan 2: Mencatat Pembayaran Iuran
function handleBayarIuran(wargaId, bulan, tahun) {
    
    // 🟥 PERLINDUNGAN AKSES ADMIN (Tulis) 🟥
    if (!isAdmin()) {
        showNotification('Akses Ditolak: Hanya Admin yang dapat mencatat pembayaran iuran.', 'error');
        return;
    }
    // 🟥 LANJUTKAN LOGIKA HANYA JIKA ADMIN 🟥
    
    // ... (Logika menyimpan data pembayaran iuran ke Firestore) ...
    // ... (misalnya: update status iuran bulanan warga di koleksi 'warga' atau mencatat di 'transaksi') ...
    
    showNotification(`Pembayaran Iuran berhasil dicatat untuk ${wargaId}.`, 'success');
}

// ----------------------------------------------------
// INITIALISASI UTAMA (MEMPERBAIKI MASALAH LOGIN/DASHBOARD)
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // PENTING: Gunakan Firebase Auth State Observer untuk menangani status login
    auth.onAuthStateChanged(async (userAuth) => {
        if (userAuth) {
            // Pengguna sedang login

            // Ambil Profil Warga dari Firestore (untuk mendapatkan 'role')
            const doc = await WARGA_COLLECTION.doc(userAuth.uid).get();
            
            if (doc.exists) {
                // Login berhasil dan profil ditemukan

                // Set status login
                loggedInUser = { id: userAuth.uid, ...doc.data() };
                sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

                // 1. Tampilkan Dasbor
                document.getElementById('login-screen').classList.add('hidden'); // Asumsi ada div dengan ID login-screen
                document.getElementById('main-app').classList.remove('hidden'); // Asumsi ada div dengan ID main-app
                document.getElementById('user-info').textContent = `Logged in: ${loggedInUser.nama} (${loggedInUser.role.toUpperCase()})`;
                
                // 2. Mulai Listener Data Firestore
                setupFirestoreListeners(); 
                
                // 3. Terapkan Batasan Role
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
            
            // Redirect ke halaman login
            window.location.href = 'auth.html'; 
        }
    });

    // ----------------------------------------------------
    // INISIALISASI EVENT LISTENERS LAINNYA
    // ----------------------------------------------------

    // Contoh Event Listener
    // document.getElementById('form-pengeluaran').addEventListener('submit', handleSimpanPengeluaran);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // ... inisialisasi semua modal, tab navigation, dan form submit lainnya ...
});
