# Arah desain Maqro

Sumber: MOCKUP.html milik pengguna. Tampilan aplikasi kerja panitia dan kafilah MTQ Kabupaten Kutai Barat, bukan halaman promosi.

Pembaruan identitas sesuai permintaan pengguna: kiri atas dashboard dan login memakai nama e-MTQ LPTQ Kubar bersama aset logo LPTQ Kabupaten Kutai Barat yang diberikan pengguna. Logo ditampilkan utuh dengan rasio asli; nama dua baris menjaga keterbacaan di sidebar dan layar sempit.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1.

Saat pertama dibuka atau di-refresh, aplikasi menampilkan loading layar penuh dengan logo LPTQ, warna tema, dan indikator berputar. Loading menunggu dokumen, pemeriksaan sesi, dan pemuatan data awal selesai sebelum memudar selama 220 ms, sehingga halaman login tidak terlihat sesaat sebelum dashboard. Status selesai disimpan selama halaman terpasang agar loading tidak berulang saat berpindah menu atau memuat ulang data. Gerakan indikator dan transisi dinonaktifkan ketika pengguna memilih pengurangan gerakan; pemuatan konten berikutnya tetap memakai skeleton yang sudah ada.

Halaman login menampilkan logo Kemenag, LPTQ, dan Pemkab Kutai Barat dalam satu baris dengan proporsi asli, berukuran lebih besar daripada logo navigasi. Logo Pemkab menggunakan gambar transparan yang diberikan pengguna; logo Kemenag menggunakan aset proyek Kemenag Kutai Barat yang sudah tersedia.

- Hijau tua dan kertas krem mengikuti mockup, menjaga identitas ruang kerja MTQ dan hierarki tindakan utama.
- Georgia pada judul dan nama Maqro memberi karakter cetakan resmi; Segoe UI pada formulir dan tabel menjaga keterbacaan.
- Sidebar desktop dan menu berlabel pada layar sempit mempertahankan struktur navigasi mockup tanpa memadatkan kolom.
- Daftar dan tabel mengutamakan identitas peserta, cabang, kesiapan sesi, serta hasil undian, tanpa grafik atau metrik rekaan. Akun kecamatan hanya membuka daftar peserta dan undian beserta hasilnya; panitia mengelola data peserta. Login memakai satu form tanpa pilihan peran.
- Hasil undian berada pada baris peserta, dengan riwayat pembatalan yang dapat dibuka ketika diperlukan. Pemilih undian mengutamakan cabang lalu peserta. Setiap cabang hanya memiliki satu sesi tanpa pembagian babak. Pencarian dan status memisahkan pekerjaan yang siap dilakukan dari bukti yang sudah tersimpan.
- Cabang & sesi memakai tabel untuk membandingkan cabang, jumlah paket, status, dan tindakan dalam satu baris. Ketentuan paket menjadi aturan tetap di database, sehingga tidak ada dropdown atau tombol Simpan untuk kebijakan tersebut. Kolom beralih ke susunan vertikal pada ponsel.
- Jarak rapat di formulir menghubungkan kolom terkait; jarak lebih lebar antarbagian memisahkan pekerjaan.
- Panel memisahkan kelompok data yang dapat ditindaklanjuti; radius kecil membedakan panel, input, dan status.
- Aksi sekunder Muat ulang, tema, keluar, dan tutup memakai tombol ikon 44 piksel dengan bingkai terlihat. Panah melingkar menunjukkan muat ulang, matahari/bulan menunjukkan tema tujuan, pintu dengan panah menunjukkan keluar, dan silang menutup dialog. Title memberi keterangan saat diarahkan dan aria-label mempertahankan nama aksesibel. Aksi utama tetap berwarna hijau dengan label tulisan.
- Warna peringatan dan pembatalan hanya menunjukkan status nyata; tidak ada ikon atau ilustrasi dekoratif.
- Gerakan terbatas pada respons tombol; loading memakai skeleton statis yang mengikuti bentuk konten tanpa efek acak atau animasi berulang. Status proses tetap tersedia untuk pembaca layar.
- Setelah perubahan data, hanya record atau daftar terkait yang diperbarui agar filter, isian komponen lain, navigasi, dan konteks pengguna tetap bertahan. Skeleton satu halaman dipakai untuk pemuatan halaman, bukan setelah setiap penyimpanan.
- Tema terang dan gelap menggunakan token yang sama; konteks login tetap hijau tua dan krem sesuai mockup pada keduanya.
- Motif identitas ialah judul serif, tata letak seperti register, dan bukti undian dengan garis kepala dokumen.

Peserta dan paket contoh dari mockup tidak diimpor. Kategori bersumber dari KATEGORI.md. Identitas akun dibaca dari AKUN.md hanya oleh skrip provisioning lokal.
