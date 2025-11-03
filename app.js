// Catatan: Variabel WARGA_COLLECTION dan TRANSAKSI_COLLECTION 
// diinisialisasi di index.html dan dapat diakses di sini.

// Status Aplikasi
let currentTab = 'beranda';
let loggedInUser = null;
let allWargaData = [];
let allTransaksiData = [];

// =================================================================
// FIREBASE / CLOUD FIRESTORE FUNCTIONS
// =================================================================

/**
 * Menyimpan atau memperbarui data warga ke Firestore.
 * @param {object} warga - Objek data warga.
 */
async function saveWarga(warga) {
    try {
        if (warga.id) {
            // UPDATE: Hapus id lokal sebelum mengirim ke Firestore
            const docId = warga.id;
            delete warga.id;
            await WARGA_COLLECTION.doc(docId).set(warga, { merge: true });
            warga.id = docId; // Tambahkan kembali ID untuk konsistensi lokal
            showNotification('Data warga berhasil diperbarui.', 'success');
        } else {
            // CREATE: Tambahkan dokumen baru, Firestore memberikan ID unik
            const newDoc = await WARGA_COLLECTION.add(warga);
            warga.id = newDoc.id;
            showNotification('Warga baru berhasil ditambahkan.', 'success');
        }
    } catch (error) {
        console.error("Gagal menyimpan warga:", error);
        showNotification('Gagal menyimpan data warga.', 'error');
    }
}

/**
 * Menghapus warga dan semua transaksinya.
 * @param {string} id - ID Firestore warga yang akan dihapus.
 */
async function deleteWarga(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus warga ini? Tindakan ini permanen dan akan menghapus semua data transaksi terkait!')) return;
    
    try {
        // Hapus transaksi terkait
        const transaksiSnapshot = await TRANSAKSI_COLLECTION.where('id_warga', '==', id).get();
        const batch = db.batch(); // Menggunakan batch untuk menghapus banyak dokumen sekaligus
        transaksiSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Hapus dokumen warga
        batch.delete(WARGA_COLLECTION.doc(id));
        
        await batch.commit();

        showNotification('Warga dan transaksi terkait berhasil dihapus.', 'success');
        document.getElementById('profil-detail-modal').classList.add('hidden');
    } catch (error) {
        console.error("Gagal menghapus warga:", error);
        showNotification('Gagal menghapus warga dan transaksinya.', 'error');
    }
}

/**
 * Menyimpan transaksi baru ke Firestore.
 * @param {object} transaksi - Objek transaksi.
 */
async function addTransaksi(transaksi) {
    try {
        await TRANSAKSI_COLLECTION.add({
            ...transaksi,
            // Tambahkan timestamp dari server
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Transaksi berhasil disimpan secara online!', 'success');
    } catch (error) {
        console.error("Error menyimpan transaksi:", error);
        showNotification('Gagal menyimpan transaksi ke server.', 'error');
    }
}


// =================================================================
// CORE APP LOGIC & RENDERING
// =================================================================

function formatRupiah(number) {
    if (isNaN(number) || number === null) return 'Rp 0';
    return 'Rp ' + Math.abs(number).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function calculateSaldo(transaksi) {
    const total = transaksi.reduce((sum, t) => sum + t.jumlah, 0);
    return total;
}

function calculateWargaSaldo(wargaId, transaksi) {
    const total = transaksi
        .filter(t => t.id_warga === wargaId)
        .reduce((sum, t) => sum + t.jumlah, 0);
    return total;
}

function getSaldoPerKategori(transaksi, kategori) {
    return transaksi
        .filter(t => t.kategori === kategori)
        .reduce((sum, t) => sum + t.jumlah, 0);
}

function getSaldoPerJenis(transaksi, jenis) {
    return transaksi
        .filter(t => t.jenis === jenis)
        .reduce((sum, t) => sum + t.jumlah, 0);
}

function updateAllViews(wargaData, transaksiData) {
    allWargaData = wargaData;
    allTransaksiData = transaksiData;

    // Hitung Saldo Total
    const totalSaldo = calculateSaldo(transaksiData);
    const saldoIuran = getSaldoPerKategori(transaksiData, 'Iuran Wajib');
    const saldoTabungan = getSaldoPerKategori(transaksiData, 'Tabungan Warga');
    
    // Panggil fungsi render yang sesuai dengan tab saat ini
    switch (currentTab) {
        case 'beranda':
            renderBeranda();
            break;
        case 'iuran':
            renderIuranSection(wargaData, transaksiData);
            break;
        case 'tabungan':
            renderTabunganSection(wargaData, transaksiData);
            break;
        case 'warga':
            renderWargaSection(wargaData);
            break;
    }
}


function renderBeranda() {
    document.getElementById('app-title').textContent = 'Beranda';
    document.getElementById('fab-pemasukan').classList.remove('hidden');
    document.getElementById('fab-pengeluaran').classList.remove('hidden');

    const totalSaldo = calculateSaldo(allTransaksiData);
    const saldoIuran = getSaldoPerKategori(allTransaksiData, 'Iuran Wajib');
    const saldoTabungan = getSaldoPerKategori(allTransaksiData, 'Tabungan Warga');
    const saldoKasUmum = totalSaldo - saldoIuran - saldoTabungan; // Kas umum = Total - Iuran - Tabungan

    const latestTransaksi = allTransaksiData.slice(0, 10);
    
    // Hitung Statistik
    const totalPemasukan = getSaldoPerJenis(allTransaksiData, 'Pemasukan');
    const totalPengeluaran = getSaldoPerJenis(allTransaksiData, 'Pengeluaran') * -1; 
    
    const riwayatHTML = latestTransaksi.map(t => {
        const warga = allWargaData.find(w => w.id === t.id_warga);
        const namaWarga = warga ? warga.nama : 'Kas Umum';
        const color = t.jenis === 'Pemasukan' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        const sign = t.jenis === 'Pemasukan' ? '+' : '-';
        
        return `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                    <p class="font-semibold dark:text-gray-100">${t.kategori} <span class="text-xs text-gray-500">(${namaWarga})</span></p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${t.keterangan || 'Tanpa Keterangan'}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold ${color}">${sign} ${formatRupiah(t.jumlah)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${t.tanggal}</p>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('main-content').innerHTML = `
        <div id="saldo-card-container" class="mb-6 h-40 relative flip-card cursor-pointer">
            <div class="card-saldo-front bg-blue-600 text-white p-5 rounded-xl shadow-lg h-full flex flex-col justify-between absolute w-full">
                <p class="text-sm font-light">SALDO KAS TOTAL</p>
                <h2 id="total-saldo" class="text-4xl font-extrabold">${formatRupiah(totalSaldo)}</h2>
                <div class="flex justify-between text-sm font-light">
                    <span>Kas Warga RT 01</span>
                    <span>FLIP</span>
                </div>
            </div>
            <div class="card-saldo-back bg-gray-700 text-white p-5 rounded-xl shadow-lg h-full flex flex-col justify-between absolute w-full">
                <p class="text-sm font-light">RINCIAN SALDO</p>
                <div class="text-sm space-y-1">
                    <p>Iuran Wajib: <span id="saldo-iuran" class="font-bold">${formatRupiah(saldoIuran)}</span></p>
                    <p>Tabungan Warga: <span id="saldo-tabungan" class="font-bold">${formatRupiah(saldoTabungan)}</span></p>
                    <p>Kas Umum: <span id="saldo-kas-umum" class="font-bold">${formatRupiah(saldoKasUmum)}</span></p>
                </div>
                <p class="text-xs text-right font-light">Klik untuk kembali</p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <p class="text-sm text-gray-500 dark:text-gray-400">Total Pemasukan</p>
                <p class="text-xl font-bold text-green-600 dark:text-green-400">${formatRupiah(totalPemasukan)}</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <p class="text-sm text-gray-500 dark:text-gray-400">Total Pengeluaran</p>
                <p class="text-xl font-bold text-red-600 dark:text-red-400">${formatRupiah(totalPengeluaran)}</p>
            </div>
        </div>
        
        <h3 class="text-lg font-bold mb-3 dark:text-gray-100">10 Riwayat Terakhir</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            ${riwayatHTML.length > 0 ? riwayatHTML : '<p class="text-gray-500 dark:text-gray-400">Belum ada riwayat transaksi.</p>'}
        </div>
    `;

    document.getElementById('saldo-card-container').addEventListener('click', () => {
        document.getElementById('saldo-card-container').classList.toggle('flipped');
    });
}

function renderIuranSection(wargaData, transaksiData) {
    document.getElementById('app-title').textContent = 'Iuran Wajib';
    document.getElementById('fab-pemasukan').classList.remove('hidden');
    document.getElementById('fab-pengeluaran').classList.remove('hidden');

    const totalIuran = getSaldoPerKategori(transaksiData, 'Iuran Wajib');
    const bulanSekarang = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    // Cek warga yang sudah bayar iuran bulan ini
    const transaksiIuranBulanIni = transaksiData
        .filter(t => t.kategori === 'Iuran Wajib' && t.tanggal.startsWith(new Date().toISOString().substring(0, 7)));

    const sudahBayarIds = new Set(transaksiIuranBulanIni.map(t => t.id_warga));

    const belumBayar = wargaData.filter(w => w.status === 'Aktif' && !sudahBayarIds.has(w.id));
    const sudahBayar = wargaData.filter(w => w.status === 'Aktif' && sudahBayarIds.has(w.id));

    const belumBayarHTML = belumBayar.map(w => `
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <p class="dark:text-gray-100">${w.nama} <span class="text-sm text-gray-500">(${w.alamat})</span></p>
            <button data-id="${w.id}" data-nama="${w.nama}" class="bayar-iuran-btn px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition">Bayar</button>
        </div>
    `).join('');

    const sudahBayarHTML = sudahBayar.map(w => `
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <p class="dark:text-gray-100">${w.nama} <span class="text-sm text-gray-500">(${w.alamat})</span></p>
            <span class="text-green-600 dark:text-green-400 text-sm font-semibold">Lunas</span>
        </div>
    `).join('');


    document.getElementById('main-content').innerHTML = `
        <div class="mb-6 bg-green-100 dark:bg-green-800 p-4 rounded-xl shadow-md">
            <p class="text-sm text-green-700 dark:text-green-300">Saldo Iuran Wajib</p>
            <h2 class="text-3xl font-bold text-green-800 dark:text-green-200">${formatRupiah(totalIuran)}</h2>
        </div>
        
        <h3 class="text-lg font-bold mb-3 dark:text-gray-100">Warga Belum Bayar (${bulanSekarang})</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-6">
            ${belumBayarHTML.length > 0 ? belumBayarHTML : '<p class="text-gray-500 dark:text-gray-400">Semua warga aktif sudah membayar iuran bulan ini. Hebat!</p>'}
        </div>

        <h3 class="text-lg font-bold mb-3 dark:text-gray-100">Warga Sudah Bayar (${bulanSekarang})</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            ${sudahBayarHTML.length > 0 ? sudahBayarHTML : '<p class="text-gray-500 dark:text-gray-400">Belum ada warga yang membayar iuran bulan ini.</p>'}
        </div>
    `;

    document.querySelectorAll('.bayar-iuran-btn').forEach(button => {
        button.addEventListener('click', () => {
            const idWarga = button.dataset.id;
            const namaWarga = button.dataset.nama;
            openPemasukanModal(idWarga, 'Iuran Wajib', `Pembayaran Iuran Wajib ${bulanSekarang} oleh ${namaWarga}`, 50000); // Asumsi iuran 50k
        });
    });
}

function renderTabunganSection(wargaData, transaksiData) {
    document.getElementById('app-title').textContent = 'Tabungan Warga';
    document.getElementById('fab-pemasukan').classList.remove('hidden');
    document.getElementById('fab-pengeluaran').classList.add('hidden'); // Tabungan tidak bisa pengeluaran umum

    const totalTabungan = getSaldoPerKategori(transaksiData, 'Tabungan Warga');
    
    const tabunganWarga = wargaData.map(w => {
        const saldo = calculateWargaSaldo(w.id, transaksiData.filter(t => t.kategori === 'Tabungan Warga'));
        return { ...w, saldo };
    }).filter(w => w.saldo > 0).sort((a, b) => b.saldo - a.saldo);

    const tabunganHTML = tabunganWarga.map(w => `
        <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <p class="dark:text-gray-100 font-semibold">${w.nama} <span class="text-sm text-gray-500">(${w.alamat})</span></p>
            <div class="text-right flex items-center space-x-2">
                <p class="font-bold text-blue-600 dark:text-blue-400">${formatRupiah(w.saldo)}</p>
                <button data-id="${w.id}" data-nama="${w.nama}" data-saldo="${w.saldo}" class="tarik-tabungan-btn px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition" title="Tarik Tabungan">Tarik</button>
            </div>
        </div>
    `).join('');


    document.getElementById('main-content').innerHTML = `
        <div class="mb-6 bg-blue-100 dark:bg-blue-800 p-4 rounded-xl shadow-md">
            <p class="text-sm text-blue-700 dark:text-blue-300">Total Dana Tabungan Warga</p>
            <h2 class="text-3xl font-bold text-blue-800 dark:text-blue-200">${formatRupiah(totalTabungan)}</h2>
        </div>
        
        <h3 class="text-lg font-bold mb-3 dark:text-gray-100">Daftar Saldo Tabungan Warga</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            ${tabunganHTML.length > 0 ? tabunganHTML : '<p class="text-gray-500 dark:text-gray-400">Belum ada saldo tabungan yang tercatat.</p>'}
        </div>
    `;

    document.querySelectorAll('.tarik-tabungan-btn').forEach(button => {
        button.addEventListener('click', () => {
            const idWarga = button.dataset.id;
            const namaWarga = button.dataset.nama;
            const saldoWarga = parseInt(button.dataset.saldo);
            openPengeluaranTabunganModal(idWarga, namaWarga, saldoWarga);
        });
    });
}

function renderWargaSection(wargaData) {
    document.getElementById('app-title').textContent = 'Data Warga';
    document.getElementById('fab-pemasukan').classList.add('hidden');
    document.getElementById('fab-pengeluaran').classList.add('hidden');

    const listWargaHTML = wargaData.map(w => `
        <div data-id="${w.id}" class="warga-item flex justify-between items-center py-3 px-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
            <div>
                <p class="font-semibold dark:text-gray-100">${w.nama}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${w.alamat} | ${w.pekerjaan || '-'}</p>
            </div>
            <span class="text-xs font-semibold ${w.status === 'Aktif' ? 'text-green-600' : 'text-red-600'}">${w.status}</span>
        </div>
    `).join('');

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold dark:text-gray-100">Total Warga Aktif: ${wargaData.filter(w => w.status === 'Aktif').length}</h3>
            <button id="tambah-warga-btn" class="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">Tambah Baru</button>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-2">
            ${listWargaHTML.length > 0 ? listWargaHTML : '<p class="text-gray-500 dark:text-gray-400 p-2">Belum ada data warga.</p>'}
        </div>
    `;

    document.getElementById('tambah-warga-btn').addEventListener('click', () => openWargaModal());
    document.querySelectorAll('.warga-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const id = item.dataset.id;
            const warga = allWargaData.find(w => w.id === id);
            if (warga) {
                openProfilDetailModal(warga, allTransaksiData);
            }
        });
    });
}

// =================================================================
// MODAL HANDLERS (SAMA SEPERTI SEBELUMNYA)
// =================================================================

function openPemasukanModal(idWarga = null, kategori = null, keterangan = '', jumlah = null) {
    const modal = document.getElementById('pemasukan-modal');
    const form = document.getElementById('form-pemasukan');
    const selectWarga = document.getElementById('id-warga-pemasukan');
    const selectKategori = document.getElementById('kategori-pemasukan');
    
    // Reset form
    form.reset();
    document.getElementById('jumlah-pemasukan').value = '';
    document.getElementById('keterangan-pemasukan').value = keterangan;
    
    // Isi dropdown warga
    selectWarga.innerHTML = '<option value="" selected>Kas Umum (Tidak terkait Warga)</option>';
    allWargaData.forEach(w => {
        const option = document.createElement('option');
        option.value = w.id;
        option.textContent = `${w.nama} (${w.alamat})`;
        selectWarga.appendChild(option);
    });

    if (idWarga) {
        document.getElementById('warga-select-container').classList.remove('hidden');
        selectWarga.value = idWarga;
    } else {
        if (currentTab === 'beranda') {
             document.getElementById('warga-select-container').classList.remove('hidden');
        } else {
            document.getElementById('warga-select-container').classList.add('hidden');
        }
    }

    if (kategori) {
        selectKategori.value = kategori;
        selectKategori.disabled = true;
    } else {
        selectKategori.value = '';
        selectKategori.disabled = false;
    }
    
    if (jumlah !== null) {
        document.getElementById('jumlah-pemasukan').value = jumlah;
    }

    modal.classList.remove('hidden');
}


function openPengeluaranModal() {
    const modal = document.getElementById('pengeluaran-modal');
    const form = document.getElementById('form-pengeluaran');
    form.reset();
    modal.classList.remove('hidden');
}

// Modal khusus untuk Pengeluaran Tarik Tabungan
function openPengeluaranTabunganModal(idWarga, namaWarga, saldoWarga) {
    const modal = document.getElementById('pengeluaran-modal');
    const form = document.getElementById('form-pengeluaran');
    
    // Reset form dan modifikasi tampilan/fungsi
    form.reset();
    document.querySelector('#pengeluaran-modal h2').textContent = `Tarik Tabungan: ${namaWarga}`;
    document.getElementById('kategori-pengeluaran').value = 'Tabungan Warga';
    document.getElementById('kategori-pengeluaran').disabled = true;
    
    document.getElementById('keterangan-pengeluaran').value = `Penarikan Tabungan oleh ${namaWarga}. Saldo Tersedia: ${formatRupiah(saldoWarga)}`;
    
    const submitBtn = document.getElementById('submit-pengeluaran-btn');
    submitBtn.textContent = 'Tarik Tabungan';
    submitBtn.onclick = async (e) => {
        e.preventDefault();
        
        const jumlah = parseInt(form.querySelector('#jumlah-pengeluaran').value);
        const keterangan = form.querySelector('#keterangan-pengeluaran').value;

        if (isNaN(jumlah) || jumlah <= 0) {
            showNotification('Jumlah penarikan harus valid.', 'error');
            return;
        }
        if (jumlah > saldoWarga) {
            showNotification(`Jumlah melebihi saldo. Saldo tersedia: ${formatRupiah(saldoWarga)}`, 'error');
            return;
        }

        const newTransaksi = {
            id_warga: idWarga, 
            jenis: 'Pengeluaran',
            kategori: 'Tabungan Warga',
            jumlah: jumlah * -1, // Simpan sebagai negatif
            keterangan: keterangan,
            tanggal: new Date().toISOString().split('T')[0],
        };

        await addTransaksi(newTransaksi);
        
        // Kembalikan form ke mode default
        submitBtn.onclick = handleSubmitPengeluaran;
        document.getElementById('kategori-pengeluaran').disabled = false;
        document.querySelector('#pengeluaran-modal h2').textContent = `Tambah Pengeluaran`;
        
        modal.classList.add('hidden');
        form.reset();
    };

    modal.classList.remove('hidden');
}

function openWargaModal(warga = null) {
    const modal = document.getElementById('warga-modal');
    const form = document.getElementById('form-warga');
    form.reset();

    if (warga) {
        document.getElementById('warga-modal-title').textContent = 'Edit Data Warga';
        document.getElementById('warga-id-input').value = warga.id;
        document.getElementById('warga-nama').value = warga.nama;
        document.getElementById('warga-alamat').value = warga.alamat;
        document.getElementById('warga-pekerjaan').value = warga.pekerjaan || '';
        document.getElementById('warga-status').value = warga.status;
        document.getElementById('warga-whatsapp').value = warga.whatsapp || '';
        document.getElementById('warga-email').value = warga.email;
        document.getElementById('warga-password').value = warga.password;
        document.getElementById('warga-referral').value = warga.referral || '';
    } else {
        document.getElementById('warga-modal-title').textContent = 'Tambah Warga Baru';
        document.getElementById('warga-id-input').value = '';
    }

    modal.classList.remove('hidden');
}

function openProfilDetailModal(warga, transaksiData) {
    const modal = document.getElementById('profil-detail-modal');
    const content = document.getElementById('profil-detail-content');
    
    const saldoIuran = calculateWargaSaldo(warga.id, transaksiData.filter(t => t.kategori === 'Iuran Wajib'));
    const saldoTabungan = calculateWargaSaldo(warga.id, transaksiData.filter(t => t.kategori === 'Tabungan Warga'));
    
    content.innerHTML = `
        <p><span class="font-semibold">Nama:</span> ${warga.nama}</p>
        <p><span class="font-semibold">Alamat:</span> ${warga.alamat}</p>
        <p><span class="font-semibold">Status:</span> ${warga.status}</p>
        <p><span class="font-semibold">Pekerjaan:</span> ${warga.pekerjaan || '-'}</p>
        <hr class="my-2 border-gray-200 dark:border-gray-700">
        <p><span class="font-semibold">Email:</span> ${warga.email}</p>
        <p><span class="font-semibold">WhatsApp:</span> <a href="https://wa.me/${warga.whatsapp}" target="_blank" class="text-blue-500">${warga.whatsapp || '-'}</a></p>
        <p><span class="font-semibold">Kode Referral:</span> ${warga.referral || '-'}</p>
        <hr class="my-2 border-gray-200 dark:border-gray-700">
        <p class="text-lg"><span class="font-bold text-green-600">Total Iuran Masuk:</span> ${formatRupiah(saldoIuran)}</p>
        <p class="text-lg"><span class="font-bold text-blue-600">Saldo Tabungan:</span> ${formatRupiah(saldoTabungan)}</p>
    `;

    document.getElementById('edit-profil-btn').onclick = () => {
        document.getElementById('profil-detail-modal').classList.add('hidden');
        openWargaModal(warga);
    };

    document.getElementById('delete-profil-btn').onclick = () => {
        deleteWarga(warga.id);
    };

    modal.classList.remove('hidden');
}

// =================================================================
// EVENT SUBMIT HANDLERS (SAMA SEPERTI SEBELUMNYA)
// =================================================================

async function handleSubmitPemasukan(e) {
    e.preventDefault();

    const form = document.getElementById('form-pemasukan');
    const idWarga = form.querySelector('#id-warga-pemasukan').value || null; 
    const kategori = form.querySelector('#kategori-pemasukan').value;
    const jumlah = parseInt(form.querySelector('#jumlah-pemasukan').value);
    const keterangan = form.querySelector('#keterangan-pemasukan').value.trim();

    if (!kategori || isNaN(jumlah) || jumlah <= 0) {
        showNotification('Harap lengkapi Kategori dan Jumlah dengan benar.', 'error');
        return;
    }
    
    if ((kategori === 'Iuran Wajib' || kategori === 'Tabungan Warga') && !idWarga) {
        showNotification('Untuk Iuran atau Tabungan, harus memilih Warga.', 'error');
        return;
    }

    const newTransaksi = {
        id_warga: idWarga, 
        jenis: 'Pemasukan',
        kategori: kategori,
        jumlah: jumlah,
        keterangan: keterangan || `Pemasukan ${kategori}`,
        tanggal: new Date().toISOString().split('T')[0],
    };

    await addTransaksi(newTransaksi); 
    
    document.getElementById('pemasukan-modal').classList.add('hidden');
    form.reset();
}

async function handleSubmitPengeluaran(e) {
    e.preventDefault();
    
    const form = document.getElementById('form-pengeluaran');
    const kategori = form.querySelector('#kategori-pengeluaran').value;
    const jumlah = parseInt(form.querySelector('#jumlah-pengeluaran').value);
    const keterangan = form.querySelector('#keterangan-pengeluaran').value.trim();

    if (!kategori || isNaN(jumlah) || jumlah <= 0 || !keterangan) {
        showNotification('Harap lengkapi semua field Pengeluaran.', 'error');
        return;
    }
    
    const newTransaksi = {
        id_warga: null, 
        jenis: 'Pengeluaran',
        kategori: kategori,
        jumlah: jumlah * -1, 
        keterangan: keterangan,
        tanggal: new Date().toISOString().split('T')[0],
    };

    await addTransaksi(newTransaksi);
    
    document.getElementById('pengeluaran-modal').classList.add('hidden');
    form.reset();
}

async function handleSubmitWarga(e) {
    e.preventDefault();
    
    const id = document.getElementById('warga-id-input').value;
    const nama = document.getElementById('warga-nama').value;
    const alamat = document.getElementById('warga-alamat').value;
    const pekerjaan = document.getElementById('warga-pekerjaan').value;
    const status = document.getElementById('warga-status').value;
    const whatsapp = document.getElementById('warga-whatsapp').value;
    const email = document.getElementById('warga-email').value;
    const password = document.getElementById('warga-password').value;
    const referral = document.getElementById('warga-referral').value.toUpperCase();

    if (!nama || !alamat || !email || !password) {
        showNotification('Nama, Alamat, Email, dan Password wajib diisi.', 'error');
        return;
    }

    const wargaData = {
        nama, alamat, pekerjaan, status, whatsapp, email, referral, password
    };
    if (id) {
        wargaData.id = id;
    }

    await saveWarga(wargaData);
    document.getElementById('warga-modal').classList.add('hidden');
}


// =================================================================
// LOGIN & UTILITIES (Dengan Log Debug)
// =================================================================

function checkLogin() {
    if (loggedInUser) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-info').textContent = `Logged in: ${loggedInUser.nama}`;
        updateTheme(localStorage.getItem('theme') === 'dark');
        return true;
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        return false;
    }
}

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // 🟢 DEBUG LOG: Mencoba login
    console.log("[DEBUG] Mencoba login dengan email:", email);
    
    const user = allWargaData.find(w => w.email === email && w.password === password);

    if (user) {
        loggedInUser = user;
        checkLogin();
        showNotification(`Selamat datang, ${user.nama}!`, 'success');
        switchTab('beranda');
    } else {
        // 🔴 DEBUG LOG: Gagal login
        console.log("[DEBUG] Login Gagal. User tidak ditemukan."); 
        console.log("[DEBUG] Data Warga yang tersedia (allWargaData):", allWargaData);
        showNotification('Email atau Password salah.', 'error');
    }
}

function handleLogout() {
    loggedInUser = null;
    checkLogin();
    showNotification('Anda telah logout.', 'info');
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.nav-tab').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('dark:text-blue-400', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
        btn.classList.toggle('dark:text-gray-400', !isActive);
    });

    updateAllViews(allWargaData, allTransaksiData);
}

function updateTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.getElementById('sun-icon').classList.remove('hidden');
        document.getElementById('moon-icon').classList.add('hidden');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('sun-icon').classList.add('hidden');
        document.getElementById('moon-icon').classList.remove('hidden');
        localStorage.setItem('theme', 'light');
    }
}


function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    
    let bgColor, textColor, icon;
    if (type === 'success') {
        bgColor = 'bg-green-500';
        textColor = 'text-white';
        icon = '✅';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        textColor = 'text-white';
        icon = '❌';
    } else {
        bgColor = 'bg-blue-500';
        textColor = 'text-white';
        icon = 'ℹ️';
    }

    notification.className = `p-3 mb-2 rounded-lg shadow-lg flex items-center space-x-2 ${bgColor} ${textColor} transform transition-all duration-300 translate-x-full`;
    notification.innerHTML = `<span class="font-bold">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 10);

    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}


// =================================================================
// INITIALIZATION AND EVENT LISTENERS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------
    // FIREBASE: SETUP REAL-TIME LISTENERS
    // ----------------------------------------------------

    // 1. Listener untuk Data Warga 
    WARGA_COLLECTION.onSnapshot((snapshot) => {
        const warga = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        
        allWargaData = warga;
        // 🟢 DEBUG LOG: Status Data Warga
        console.log(`[DEBUG] Warga berhasil dimuat. Total: ${warga.length}`);
        console.log("[DEBUG] Data Warga:", allWargaData);
        
        checkLogin();

    }, (error) => {
        console.error("Error mendengarkan warga:", error);
        showNotification('Gagal memuat data warga dari server.', 'error');
    });

    // 2. Listener untuk Data Transaksi
    TRANSAKSI_COLLECTION
        .orderBy('timestamp', 'desc') 
        .onSnapshot((snapshot) => {
        
        const transaksi = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            tanggal: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString().split('T')[0] : 'N/A'
        }));
        
        allTransaksiData = transaksi;
        console.log(`[DEBUG] Transaksi berhasil dimuat. Total: ${transaksi.length}`);
        
        if (loggedInUser) {
            updateAllViews(allWargaData, allTransaksiData);
        }

    }, (error) => {
        console.error("Error mendengarkan transaksi:", error);
        showNotification('Gagal memuat data transaksi dari server.', 'error');
    });


    // ----------------------------------------------------
    // UI EVENT LISTENERS
    // ----------------------------------------------------
    
    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Navigasi
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        updateTheme(!document.documentElement.classList.contains('dark'));
    });
    
    // FAB Buttons
    document.getElementById('fab-pemasukan').addEventListener('click', () => {
        let kategoriDefault = null;
        if (currentTab === 'iuran') kategoriDefault = 'Iuran Wajib';
        if (currentTab === 'tabungan') kategoriDefault = 'Tabungan Warga';
        if (currentTab === 'beranda') kategoriDefault = 'Kas Umum';
        
        openPemasukanModal(null, kategoriDefault);
    });
    document.getElementById('fab-pengeluaran').addEventListener('click', () => openPengeluaranModal());

    // Modal Submit Handlers
    document.getElementById('form-pemasukan').addEventListener('submit', handleSubmitPemasukan);
    document.getElementById('form-pengeluaran').addEventListener('submit', handleSubmitPengeluaran);
    document.getElementById('form-warga').addEventListener('submit', handleSubmitWarga);

    // Modal Close Buttons
    document.getElementById('close-pemasukan-btn').addEventListener('click', () => document.getElementById('pemasukan-modal').classList.add('hidden'));
    document.getElementById('close-pengeluaran-btn').addEventListener('click', () => {
        document.getElementById('submit-pengeluaran-btn').onclick = handleSubmitPengeluaran;
        document.getElementById('kategori-pengeluaran').disabled = false;
        document.querySelector('#pengeluaran-modal h2').textContent = `Tambah Pengeluaran`;
        document.getElementById('pengeluaran-modal').classList.add('hidden');
    });
    document.getElementById('close-warga-btn').addEventListener('click', () => document.getElementById('warga-modal').classList.add('hidden'));
    document.getElementById('close-profil-detail-btn').addEventListener('click', () => document.getElementById('profil-detail-modal').classList.add('hidden'));
    document.getElementById('close-info-modal-btn').addEventListener('click', () => document.getElementById('info-modal').classList.add('hidden'));
    
    // Menu Samping
    const menuModal = document.getElementById('menu-modal');
    const menuPanel = document.getElementById('menu-panel');
    document.getElementById('menu-btn').addEventListener('click', () => {
        menuModal.classList.remove('hidden');
        setTimeout(() => menuPanel.classList.remove('translate-x-full'), 10);
    });
    menuModal.addEventListener('click', (e) => {
        if (!menuPanel.contains(e.target) || e.target.id === 'menu-modal') {
            menuPanel.classList.add('translate-x-full');
            setTimeout(() => menuModal.classList.add('hidden'), 300);
        }
    });

    // Modal Navigasi Khusus
    document.querySelectorAll('.modal-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const title = e.target.dataset.title;
            const infoModal = document.getElementById('info-modal');
            const titleElement = document.getElementById('info-modal-title');
            const contentElement = document.getElementById('info-modal-content');
            
            titleElement.textContent = title;
            menuPanel.classList.add('translate-x-full');
            setTimeout(() => menuModal.classList.add('hidden'), 300);
            
            if (title === 'Manajemen Data') {
                contentElement.innerHTML = `
                    <p>Fungsi Import/Export Data kini tidak lagi diperlukan. Semua data **Warga** dan **Transaksi** Anda otomatis tersimpan di **Firebase Cloud Firestore** secara online.</p>
                    <p>Untuk mencadangkan atau memulihkan data, Anda dapat mengakses langsung **Firebase Console** pada proyek **${firebaseConfig.projectId}**.</p>
                    <p class="mt-4 text-sm italic">Opsi Export ke JSON dihilangkan karena data kini tersentralisasi di Cloud.</p>
                `;
            } else if (title === 'Cara Penggunaan') {
                 contentElement.innerHTML = `
                    <p>Aplikasi ini didesain untuk mencatat 3 jenis kas utama:</p>
                    <ul class="list-disc ml-5 space-y-1">
                        <li>**Beranda:** Mencatat pemasukan/pengeluaran kas umum (Kas Umum).</li>
                        <li>**Iuran:** Mencatat pemasukan Iuran wajib. Gunakan tombol **Bayar** interaktif untuk pencatatan cepat.</li>
                        <li>**Tabungan:** Mencatat Tabungan Warga (bisa ditarik kapan saja).</li>
                    </ul>
                    <p class="mt-3 text-sm italic">Data ini tersimpan secara online dan real-time di Cloud Firestore.</p>
                `;
            } else if (title === 'Tentang Aplikasi') {
                contentElement.innerHTML = `
                    <p><strong>Nama Aplikasi:</strong> Kas Warga RT 01</p>
                    <p><strong>Versi:</strong> 2.0.0 (Migrasi Cloud Firestore & PWA)</p>
                    <p><strong>Teknologi:</strong> HTML5, Tailwind CSS, Vanilla JavaScript, **Firebase Cloud Firestore**.</p>
                    <p class="mt-3 text-sm italic">Aplikasi ini sekarang berfungsi sebagai **Progressive Web App (PWA)** dan dapat diakses online serta disimpan offline, dengan data tersentralisasi di Cloud.</p>
                `;
            }
            
            infoModal.classList.remove('hidden');
        });
    });

});