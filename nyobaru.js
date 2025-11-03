// =======================================================
// app.js: KODE UTAMA APLIKASI KAS WARGA (FINAL)
// =======================================================

// ----------------------------------------------------
// VARIABEL GLOBAL & INISIALISASI
// ----------------------------------------------------
// Pastikan variabel ini ada di file global/window scope
let loggedInUser = null; 
let allWargaData = [];
let allTransaksiData = [];
// ... (variabel global lainnya seperti untuk filter, dll.) ...


// ----------------------------------------------------
// FUNGSI HELPER & RBAC
// ----------------------------------------------------

function showNotification(message, type = 'info') {
    // Implementasi Notifikasi
    const container = document.getElementById('notification-container') || document.body;
    // ... (Logika notifikasi) ...
}

function handleLogout() {
    // Melakukan logout dari Firebase Authentication
    auth.signOut().then(() => {
        // Hapus data sesi setelah logout berhasil
        sessionStorage.removeItem('loggedInUser');
        loggedInUser = null;
        showNotification('Anda telah logout.', 'info');
        // Redirect ke halaman login
        window.location.href = 'auth.html'; 
    }).catch(error => {
        console.error("Logout error:", error);
        showNotification('Gagal logout. Cek koneksi.', 'error');
    });
}

// 🟥 FUNGSI ROLE-BASED ACCESS CONTROL (RBAC) 🟥
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
// FUNGSI DATA & RENDER (HARAP DIIMPLEMENTASIKAN)
// ----------------------------------------------------

function setupFirestoreListeners() {
    // Listener Data Warga
    WARGA_COLLECTION.onSnapshot(snapshot => {
        allWargaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Perbarui loggedInUser dengan data terbaru (jika role diubah)
        const user = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
        loggedInUser = allWargaData.find(w => w.id === user.id) || null;

        renderWargaList(); 
        updateAdminAccessUI(); // Perbarui tampilan jika data role baru terload
    });

    // Listener Data Transaksi
    TRANSAKSI_COLLECTION.orderBy('tanggal', 'desc').onSnapshot(snapshot => {
        allTransaksiData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(), 
            timestamp: doc.data().tanggal 
        }));
        
        renderRingkasanData(); 
        renderTransaksiList();
    });
}

// *** Placeholder untuk Fungsi Rendering Anda ***
function renderWargaList() { /* ... Logika rendering list warga ... */ }
function renderRingkasanData() { /* ... Logika rendering saldo kas ... */ }
function renderTransaksiList() { /* ... Logika rendering list transaksi ... */ }


// ----------------------------------------------------
// FUNGSI WRITE DENGAN PERLINDUNGAN ADMIN
// ----------------------------------------------------

// Contoh: Menyimpan Pengeluaran
function handleSimpanPengeluaran(e) {
    e.preventDefault();
    
    // 🟥 PERLINDUNGAN AKSES ADMIN (Tulis) 🟥
    if (!isAdmin()) {
        showNotification('Akses Ditolak: Hanya Admin yang dapat mencatat transaksi.', 'error');
        // Tutup modal jika ada
        return; 
    }
    // 🟥 LANJUTKAN LOGIKA HANYA JIKA ADMIN 🟥

    const jenis = document.getElementById('pengeluaran-jenis').value;
    const nominal = parseInt(document.getElementById('pengeluaran-nominal').value);
    const keterangan = document.getElementById('pengeluaran-keterangan').value.trim();

    const newTransaction = {
        jenis: 'Pengeluaran',
        kategori: jenis, 
        nominal: -nominal, 
        keterangan: keterangan,
        tanggal: firebase.firestore.Timestamp.fromDate(new Date()),
        dicatatOleh: loggedInUser.nama
    };

    TRANSAKSI_COLLECTION.add(newTransaction)
        .then(() => showNotification('Pengeluaran berhasil dicatat!', 'success'))
        .catch(error => showNotification('Gagal mencatat. Cek Firestore Rules atau koneksi.', 'error'));
}

// Contoh: Mencatat Pembayaran Iuran
function handleBayarIuran(wargaId, bulan, tahun) {
    
    // 🟥 PERLINDUNGAN AKSES ADMIN (Tulis) 🟥
    if (!isAdmin()) {
        showNotification('Akses Ditolak: Hanya Admin yang dapat mencatat pembayaran iuran.', 'error');
        return;
    }
    // 🟥 LANJUTKAN LOGIKA HANYA JIKA ADMIN 🟥
    
    // ... Logika menyimpan data pembayaran iuran ke Firestore ...
}

// ----------------------------------------------------
// INITIALISASI UTAMA (PERBAIKAN KRUSIAL)
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // PENTING: Menggunakan Firebase Auth State Observer
    auth.onAuthStateChanged(async (userAuth) => {
        if (userAuth) {
            // User Auth ada, ambil data profil (role) dari Firestore
            const doc = await WARGA_COLLECTION.doc(userAuth.uid).get();
            
            if (doc.exists) {
                // Berhasil login dan profil ditemukan

                // Set status login
                loggedInUser = { id: userAuth.uid, ...doc.data() };

                // 1. Tampilkan Dasbor (Perbaikan Masalah Tampilan)
                document.getElementById('login-screen').classList.add('hidden'); 
                document.getElementById('main-app').classList.remove('hidden'); 
                document.getElementById('user-info').textContent = `Logged in: ${loggedInUser.nama} (${loggedInUser.role.toUpperCase()})`;
                
                // 2. Mulai Listener Data Firestore
                setupFirestoreListeners(); 
                
                // 3. Terapkan Batasan Role
                updateAdminAccessUI(); 
                
            } else {
                // User Auth ada, tapi profil di Firestore hilang/error
                auth.signOut();
                window.location.href = 'auth.html';
            }

        } else {
            // Pengguna sedang logout
            loggedInUser = null;
            sessionStorage.removeItem('loggedInUser');
            
            // Redirect ke halaman login jika tidak sedang di halaman login
            if (!window.location.href.includes('auth.html')) {
                 window.location.href = 'auth.html'; 
            }
        }
    });

    // ----------------------------------------------------
    // INISIALISASI EVENT LISTENERS LAINNYA
    // ----------------------------------------------------
    
    // Wajib: Event listener untuk Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Wajib: Event listener untuk form write (dengan guard handleSimpanPengeluaran)
    // document.getElementById('form-pengeluaran').addEventListener('submit', handleSimpanPengeluaran);
    
    // ... Tambahkan inisialisasi semua modal, tab navigation, dan form submit lainnya ...
});
