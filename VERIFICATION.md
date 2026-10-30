# Verifikasi Maqro

## Filter Semua cabang, 30 Oktober 2026

- Pilihan awal filter undian menjadi Semua cabang. Baris mewakili pasangan peserta/cabang dan menampilkan kolom Cabang agar peserta yang mengikuti beberapa cabang tidak ambigu. Filter satu cabang tetap tersedia. Jumlah memakai istilah pilihan undian agar tidak mengklaim jumlah peserta unik.
- Hasil aktif diindeks menurut peserta dan sesi; status, bukti, dan tombol undian selalu memakai sesi pada baris yang dipilih. Filter/status/pencarian berjalan lokal tanpa mengambil ulang data. Pilihan tetap tersimpan saat kembali dari konfirmasi/bukti.
- PASS build produksi dan TypeScript. PASS Edge/Playwright dengan fixture: default semua, satu peserta pada dua cabang, hasil pada cabang pertama tidak dianggap hasil cabang kedua, sesi tertutup tidak bisa diundi, filter ready/done/closed, satu cabang, pencarian, bukti, pemilihan sesi yang benar, serta konteks saat kembali. Tidak ada fetch ketika filter berubah, pageerror, atau penulisan live.
- PASS layout 360/768/1440 piksel pada tema terang/gelap tanpa overflow. Screenshot `output/playwright/all-categories-360-light.png` diperiksa visual. Tidak ada perubahan database atau migrasi baru; pengujian browser memakai API fixture, bukan Supabase live.
- Delivery Gate: Hard Gate PASS (kontrol berlabel, status/tindakan benar, kondisi kosong dan layout terjaga); Purpose-Gate PASS (kolom cabang membedakan sesi pada peserta yang sama); Quality Locks PASS (token, tabel responsif, dan state lokal mengikuti aplikasi); Design Read PASS (arah DESIGN.md dan dials 1/1/1 dipertahankan).

## Satu sesi per cabang tanpa babak, 30 Oktober 2026

- Pembagian Penyisihan/Final dihapus dari model frontend, tabel sesi dan skeleton (empat kolom), pemilih cabang, konfirmasi undian, hasil peserta, bukti, CSV, dan konfirmasi Buka semua sesi. Setiap peserta memiliki satu hasil aktif per cabang; setiap paket hanya dipakai satu hasil aktif pada cabang sama.
- Migrasi `202610300004_single_session_per_category.sql` mengunci sesi/hasil selama transaksi; memeriksa konflik peserta dan paket lintas sesi lama sebelum menulis; memetakan semua hasil (aktif/dibatalkan) ke satu sesi per cabang; menghapus sesi duplikat dan kolom round; menambah constraint sesi unik per kategori serta unique index paket aktif. Sesi gabungan dibuka jika ada sesi lama yang dibuka. RPC diperbarui tanpa referensi babak. Akun, RLS, pembatalan beralasan, kode paket, dan audit dipertahankan.
- PASS migrasi pada salinan PostgreSQL 15 lokal: konflik dua hasil aktif untuk peserta yang sama menghentikan migrasi; setelah konflik peserta diselesaikan, konflik satu paket pada beberapa hasil juga menghentikan migrasi. Kedua kegagalan dibandingkan dengan snapshot sebelum/sesudah: hasil dan dua sesi lama tidak berubah. Penyelesaian konflik hanya dilakukan pada fixture dengan alasan `[TEST]`, bukan data live.
- PASS penggabungan: semua ID bukti, identitas, materi, waktu, status/alasan pembatalan dan kode paket identik setelah mengecualikan pemetaan session_id serta penghapusan round yang diminta. Hasil dari sesi Final berpindah ke sesi yang dipertahankan, sesi terbuka tergabung dengan benar, dan seluruh kategori memiliki satu sesi. Tidak ada hasil otomatis dihapus/dibatalkan.
- PASS dua request undian bersamaan untuk peserta sama mengembalikan ID bukti sama; paket yang sudah dipakai tidak tersedia bagi peserta lain. Respons RPC baru tidak memuat round. Uji `district_access.sql`, `fixed_unique_packages.sql`, `district_accounts.sql`, `package_codes.sql`, dan `single_session.sql` lulus pada schema baru; fixture SQL di-rollback.
- PASS Edge/Playwright dengan Auth/REST/RPC fixture: dua peran, empat kolom sesi, satu pilihan per cabang, tidak ada copy babak pada UI/bukti/CSV, Buka semua sesi melewati cabang tanpa paket, hanya record sesi terkait dibaca ulang, baris tetap terpasang, undian menampilkan hasil lalu Lihat bukti tanpa membaca ulang koleksi lain, dan pencarian tetap tersimpan setelah kembali. CSV benar-benar diunduh/diperiksa. Schema sesi lama menampilkan pesan migrasi tanpa membolehkan pengundian.
- PASS lebar 360/768/1440 piksel tanpa overflow; tabel pada tema terang/gelap. Screenshot `single-session-table-768-light.png` dan `single-session-picker-360.png` diperiksa. Artefak berada di `output/playwright/`. Tidak ada pageerror. Build produksi (termasuk TypeScript) dan format lulus.
- Batas verifikasi: pengujian migrasi/undian database memakai salinan PostgreSQL lokal; browser memakai fixture, bukan Supabase live. Akses SQL/management Supabase tidak tersedia; migrasi belum diterapkan live. Jalankan file migrasi di SQL Editor sebelum memakai UI baru. Konflik hasil aktif harus ditinjau panitia melalui UI lama sebelum migrasi bisa dilanjutkan. Perubahan ini menghapus kolom round dan menurunkan jumlah sesi menjadi satu per cabang.

### Delivery Gate

- Hard Gate PASS: alur aktif tidak mengekspos babak; status/aksi sesuai data, migrasi gagal sebelum perubahan ketika ada konflik, kondisi kosong/error dan label aksesibel dipertahankan, tanpa overflow atau aset baru.
- Purpose-Gate PASS: satu baris dan satu pilihan untuk setiap cabang mencerminkan satu sesi database; tidak sekadar menyembunyikan dua sesi lama. Keunikan peserta/paket diperiksa database.
- Quality Locks PASS: token warna, tipografi, tabel responsif, target sentuh, fokus native dan pemuatan state terkait mengikuti aplikasi; tidak menambah animasi atau reload halaman saat simpan.
- Design Read PASS: arah portal kerja pemerintahan dan dials ENERGY 1 / RHYTHM 1 / MOTION 1 dari DESIGN.md dipertahankan; hasil pemeriksaan screenshot direkam.

## Hasil pada daftar peserta dan pemilih undian, 30 Oktober 2026

- Hasil digabung ke kolom Hasil undian pada Daftar peserta untuk panitia maupun kecamatan. Hasil aktif menampilkan cabang/babak, paket, materi, dan bukti. Riwayat pembatalan dapat dibuka per peserta dengan alasan dan bukti lama. Pembatalan tetap hanya tersedia untuk panitia. Ekspor hasil CSV dipindah ke header daftar peserta, termasuk riwayat pembatalan.
- Menu Hasil undian dan panel Register hasil pada halaman undian dihapus. Tidak menghapus record hasil, mengubah RPC undian/pembatalan, atau menambah migrasi database.
- Pemilih undian menampilkan satu cabang/babak pada satu waktu, sesi terbuka diurutkan lebih dahulu, lalu pencarian peserta dan filter status dengan jumlah aktual. Hanya peserta yang mengikuti cabang terpilih ditampilkan. Tombol Undi maqro menuju pemeriksaan data; Lihat bukti tersedia bagi hasil aktif meskipun sesi ditutup. Hasil dibatalkan tidak dianggap hasil aktif.
- Komponen pemilih tetap terpasang ketika pemeriksaan, proses, atau bukti ditampilkan, sehingga sesi, pencarian, dan filter tidak hilang saat kembali. Hasil baru langsung masuk state hasil; pembatalan mengambil ulang satu record hasil. Sidebar, baris peserta, dan koleksi lain tetap terpasang.
- PASS: build produksi (termasuk TypeScript) dan format. Review React: state filter lokal, native select/input/button/details dengan label, key menggunakan ID, indeks hasil aktif per peserta, tanpa effect tambahan atau fetch pada perubahan filter.
- PASS Edge/Playwright, fixture Auth/REST/RPC: dua peran, hasil aktif dan dibatalkan, beberapa babak satu peserta, bukti modal, pembatalan dengan alasan, pembaruan record terkait tanpa reload, larangan tombol pembatalan bagi kecamatan, pemilihan sesi, pencarian/status/reset, konfirmasi identitas, kembali dengan filter tetap, sesi tertutup tidak bisa diundi, dan bukti sesi tertutup tetap terbuka.
- PASS: undian fixture berhasil menampilkan bukti, lalu baris peserta berubah menjadi Lihat bukti; hasil baru juga tampil pada daftar peserta. Tidak ada GET koleksi setelah penyimpanan undian. Ekspor CSV benar-benar diunduh dan diperiksa memuat paket serta pembatalan; tombol cetak dibuktikan memanggil window.print, tanpa mengklaim PDF atau dialog cetak OS telah diverifikasi.
- PASS: state tanpa peserta dan tanpa sesi; layout 360/768/1440 piksel tanpa overflow, pemilih pada tema terang/gelap. Screenshot `participant-results-360.png`, `participant-results-768.png`, dan `participant-picker-360-light.png` diperiksa visual. Artefak berada di `output/playwright/`. Tidak ada pageerror browser.
- Batas verifikasi: BrowserOS tidak tersedia; pengujian menggunakan Edge/Playwright dengan API fixture, bukan akun Supabase live. Tidak ada penulisan live atau verifikasi deployment. Perubahan ini tidak memerlukan migrasi baru.

### Delivery Gate

- Hard Gate PASS: label/status/tindakan nyata, kondisi kosong, sesi tertutup, bukti dan pembatalan tercatat; fokus native dan Escape dialog dipertahankan, tanpa overflow, aset baru, navigasi buntu, atau data rekaan yang disajikan sebagai data resmi.
- Purpose-Gate PASS: hasil dikelompokkan pada peserta untuk menghindari pencarian pada register kedua; filter cabang/babak mengurangi pengulangan tombol sesi pada tiap peserta. Warna hanya menunjukkan status/tindakan yang nyata.
- Quality Locks PASS: komponen memakai token, tabel, tombol, radius, dan tipografi aplikasi; hasil/picker tersusun vertikal pada ponsel, kontrol native dan target sentuh dipertahankan. Perubahan data tidak mengganti satu halaman dengan skeleton.
- Design Read PASS: arah portal kerja Kemenag dan dials ENERGY 1 / RHYTHM 1 / MOTION 1 dari DESIGN.md dipertahankan. Tidak menambah visual dekoratif atau animasi pemilihan.

## Tambah dan edit akun kecamatan, 30 Oktober 2026

- Tombol Tambah akun kecamatan dan ikon pensil Edit akun membuka modal. Tambah meminta kecamatan, nama pengguna, dan kata sandi awal 12–128 karakter; edit mempertahankan kata sandi. Simpan menampilkan skeleton tombol dan mencegah kiriman ganda.
- Endpoint server POST/PATCH `/api/accounts` memverifikasi sesi dan profil admin aktif, menolak target admin, serta menetapkan role district dan active=true untuk akun baru. Nama pengguna diperbarui pada Supabase Auth. Transaksi RPC menyimpan profil dan log; penamaan ulang kecamatan memperbarui peserta serta hasil terkait. Jika RPC gagal, perubahan Auth dikompensasi.
- PASS SQL lokal PostgreSQL 15: pembuatan akun, perubahan nama pengguna, cascade peserta/hasil, audit, duplikat kecamatan tanpa membedakan kapitalisasi, penolakan edit stale, target admin, actor kecamatan, dan hak execute client. Fixture transaksi di-rollback. Regresi `district_access.sql` dan `fixed_unique_packages.sql` juga lulus.
- PASS API Next.js produksi + Auth fixture + PostgreSQL nyata: 401 tanpa sesi, 403 kecamatan, validasi input, tambah/edit, email internal Auth mengikuti nama pengguna, duplikat, target admin, pemulihan email ketika RPC gagal, penghapusan Auth baru ketika RPC gagal, dan 503 sebelum perubahan Auth jika migrasi belum tersedia.
- PASS browser Edge/Playwright dengan respons API fixture: tambah/edit, tidak mengirim kata sandi saat edit, error mempertahankan isian, baris lama dan sidebar tetap terpasang, serta tidak ada pembacaan ulang koleksi setelah simpan. Lebar 360/768/1440 piksel pada tema terang/gelap tanpa overflow. Validasi HTML menerima tanda hubung dan menolak spasi. Tidak ada pageerror atau error regex; satu respons 409 sengaja dihasilkan untuk menguji error state.
- Screenshot `output/playwright/accounts-360.png` diperiksa: label, input, tombol simpan, ikon tutup, dan fokus terlihat serta muat dalam layar. Screenshot tema gelap tersedia dengan pola `accounts-dark-*.png`.
- PASS build produksi, TypeScript, dan format. BrowserOS tidak tersedia; Edge melalui Playwright digunakan sebagai pengganti. Tidak ada akun atau data Supabase live yang dibuat/diubah dalam pengujian.
- **Batas operasional:** migrasi `202610300003_district_accounts.sql` belum dijalankan di Supabase live. Akses SQL/management Supabase tidak tersedia dalam sesi; jalankan file tersebut di SQL Editor sebelum memakai fitur. Kunci service role bukan akses eksekusi SQL arbitrer.

### Delivery Gate

- Hard Gate PASS: modal berlabel, ikon edit memiliki accessible name, validasi dan state gagal/simpan tersedia, fokus/Escape memakai dialog yang sudah ada, tanpa overflow atau klaim/data contoh yang menyamar sebagai data resmi.
- Purpose-Gate PASS: ikon pensil menunjukkan tindakan edit satu akun; tombol tambah tetap berlabel agar tindakan utama mudah ditemukan. Tidak menambah navigasi, dekorasi, atau aset merek.
- Quality Locks PASS: palet, tipografi, batas, target sentuh, dan skeleton mengikuti komponen aplikasi; pembaruan state terbatas pada akun dan referensi kecamatan terkait.
- Design Read PASS: mempertahankan arah portal pemerintahan pada DESIGN.md dan dials ENERGY 1 / RHYTHM 1 / MOTION 1. Bukti mobile dan dua tema tersimpan di output pengujian.

## Paket unik sebagai aturan tetap, 30 Oktober 2026

- Kolom/dropdown Ketentuan paket, state autosave kebijakan, dan referensi pengaturannya dihapus dari UI. Tabel serta skeleton sesi menjadi lima kolom.
- Buka sesi, Tutup sesi, dan Buka semua sesi selalu mengirim repeat=false untuk kompatibilitas dengan RPC yang sudah ada. Model frontend tidak lagi mengekspos pengaturan repeat.
- Migrasi `202610300002_fixed_unique_packages.sql` menetapkan seluruh sesi lama menjadi unik, memakai default false untuk sesi baru, dan menambahkan CHECK agar mode pengulangan tidak dapat diaktifkan lagi. RPC undian yang sudah ada menggunakan nilai false ini untuk menolak paket yang sudah dipakai pada sesi sama. Data hasil lama tidak dihapus atau dibatalkan otomatis.
- PASS: hasil undian lokal dibandingkan sebelum/sesudah migrasi dan tetap identik; 19 sesi legacy yang berulang diubah menjadi unik pada database pengujian.
- PASS: `fixed_unique_packages.sql`, nilai default sesi baru, larangan repeat=true melalui SQL maupun RPC lama, satu hasil aktif per peserta, paket tidak dapat diambil kecamatan lain pada sesi sama, dan paket dapat dipakai di sesi berbeda.
- PASS: `district_access.sql`, akses lintas kecamatan, sesi tertutup, paket habis, pembatalan, dan akun nonaktif tetap bekerja. Perilaku pengembalian paket setelah pembatalan tetap mengikuti alur sebelumnya.
- PASS: dua request bersamaan untuk peserta sama menghasilkan ID bukti sama; dua peserta tidak dapat mengambil satu paket unik yang sama.
- PASS: browser Edge dengan fixture, lima kolom tanpa dropdown kebijakan, buka/tutup satu sesi dan pembukaan massal selalu memakai aturan unik, hanya record sesi terkait dimuat, dan node baris tetap dipertahankan.
- PASS: lebar 360, 768, dan 1440 piksel pada dua tema tanpa overflow; screenshot tablet diperiksa; console nol error. Build produksi, TypeScript, dan format lulus.
- Hard Gate PASS: kontrol yang dihapus tidak tersisa, aksi sesi diuji, aturan divalidasi di database, dan konten/status berasal dari data uji yang jelas.
- Purpose-Gate PASS: pengaturan dihapus karena kebijakan menjadi tetap; tabel disederhanakan tanpa aset atau animasi tambahan.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 dan identitas portal tetap berlaku.
- Craftsmanship PASS: data lama dipertahankan, aturan tidak dapat dilonggarkan lewat klien lama setelah migrasi, dan persaingan request diuji.
- Batas live: SQL migrasi disediakan untuk diterapkan melalui Supabase SQL Editor. Pengujian ini memakai PostgreSQL lokal serta browser fixture dan tidak membuka sesi atau membuat hasil undian live.

## Tabel sesi dan autosave, 30 Oktober 2026

- Cabang & sesi memakai tabel enam kolom: Cabang, Babak, Paket, Status, Ketentuan paket, dan Tindakan. Teks penjelasan yang diminta pengguna serta tombol Simpan pada daftar sesi dihapus.
- Dropdown menyimpan langsung lewat RPC sesi yang sudah ada. Nilai pilihan diperbarui saat pengguna memilih, lalu kembali ke nilai sebelumnya jika penulisan gagal. Pesan sukses lama dibersihkan saat tindakan baru dimulai.
- Baris memakai key ID tetap agar tidak dilepas saat nilai berubah. Fokus dropdown dikembalikan setelah penyimpanan jika hilang akibat penonaktifan sementara dan pengguna belum memindahkannya ke kontrol lain.
- PASS: build produksi, TypeScript, dan format.
- PASS: browser Edge dengan fixture Auth/REST/RPC, perubahan dropdown langsung menulis tanpa tombol Simpan, hanya satu record sessions dibaca ulang, node baris target/tetangga identik, tidak ada skeleton satu halaman, serta fokus dropdown tetap ada.
- PASS: kegagalan HTTP 400 yang disengaja mengembalikan pilihan tanpa membaca ulang data; pesan error tampil dan tidak ada pesan sukses basi. Percobaan ulang berhasil.
- PASS: Buka sesi, Tutup sesi, dan Buka semua sesi tetap bekerja, dengan ketentuan paket terjaga dan sesi tanpa paket tidak dibuka.
- PASS: tabel dan skeleton tabel diperiksa pada 360, 768, dan 1440 piksel dalam dua tema. Perapian akhir diperiksa pula pada 700 dan 1024 piksel, tanpa overflow; label status tidak terpecah. Screenshot tablet diperiksa secara visual.
- PASS: pemeriksaan akhir console nol error. Error 400 pada skenario kegagalan autosave merupakan respons fixture yang disengaja. Tidak ada perubahan sesi Supabase live.
- Hard Gate PASS: kontrol dropdown berlabel aksesibel, tombol simpan tidak tersisa, keyboard tetap berfungsi, dan keadaan loading/error disediakan.
- Purpose-Gate PASS: tabel memudahkan pembandingan antarsesi; autosave menghilangkan tindakan simpan yang berulang, tanpa aset atau animasi tambahan.
- Liveliness PASS: identitas visual dan ENERGY 1 / RHYTHM 1 / MOTION 1 tetap mengikuti DESIGN.md.
- Craftsmanship PASS: keberhasilan, rollback, percobaan ulang, pembaruan record, serta aksi pembukaan sesi diuji. Tidak ada migrasi baru.

## Koreksi aksi menjadi ikon, 30 Oktober 2026

- Muat ulang, tema, Keluar, Keluar dari akun, dan Tutup dialog kini memakai ikon tanpa tulisan terlihat, sesuai klarifikasi pengguna. Tooltip native title dan aria-label mempertahankan keterangan tindakan.
- Ikon SVG relevan: panah melingkar untuk refresh, matahari/bulan untuk tema tujuan, pintu/panah untuk keluar, dan silang untuk tutup. SVG disembunyikan dari pembaca layar karena nama ada pada tombol.
- PASS: browser Edge mengukur tombol 44x44 piksel, satu SVG per tombol, teks terlihat kosong, serta title dan aria-label identik. Tema terang/gelap dan layar ponsel diperiksa tanpa overflow.
- PASS: klik tema dan Enter mengubah tema; refresh mengambil data; ikon tutup serta Escape menutup modal; ikon keluar kembali ke login. Console nol error, tanpa perubahan data live.
- PASS: build produksi, TypeScript, dan format. Screenshot aktual diperiksa.
- Hard Gate PASS: aksi tetap berfungsi, nama aksesibel dan tooltip tersedia, fokus keyboard serta target sentuh dipertahankan.
- Purpose-Gate PASS: setiap ikon menunjukkan tindakan yang spesifik dan diminta pengguna; tidak ada ikon dekoratif.
- Liveliness PASS: warna, radius, dan ENERGY 1 / RHYTHM 1 / MOTION 1 tidak berubah.
- Craftsmanship PASS: gaya ikon konsisten, aksi utama tetap memiliki tulisan, dan semua kontrol yang diubah diuji.

## Penanda tombol aksi, 30 Oktober 2026

- Gaya teks tanpa bingkai dihapus dari Muat ulang, tombol tema, Keluar, dan Tutup dialog. Aksi sekunder memakai tombol berlatar solid dan border token muted; aksi utama tetap hijau.
- PASS: browser Edge mengukur border solid 1 piksel dan tinggi 44 piksel pada seluruh aksi terkait, termasuk login terang/gelap dan layar ponsel.
- PASS: Tema melalui klik dan Enter mengubah tema; Muat ulang mengambil data; Tutup dan Escape menutup dialog; Keluar kembali ke login. Mobile 360 piksel tanpa overflow, console nol error. Respons Auth/data memakai fixture, tanpa perubahan data live.
- PASS: pemeriksaan kontras dengan skrip antislop-human menunjukkan 5,26:1 pada pasangan muted/tint terang dan 6,03:1 pada tema gelap, melebihi kebutuhan batas komponen 3:1.
- PASS: build produksi, TypeScript, dan format. Hover tombol yang dinonaktifkan tidak mendapat efek aktif.
- Hard Gate PASS: kontrol tetap operabel dengan keyboard, target sentuh minimal 44 piksel, bingkai terlihat pada kedua tema, dan tidak ada aksi palsu atau konten rekaan.
- Purpose-Gate PASS: border memperjelas elemen yang dapat diklik; tidak ada ikon atau dekorasi baru.
- Liveliness PASS: warna, radius, dan ENERGY 1 / RHYTHM 1 / MOTION 1 tetap mengikuti arah desain.
- Craftsmanship PASS: hierarki aksi utama/sekunder dipertahankan dan perilaku semua kontrol yang diubah telah diuji.

## Tombol Buka semua sesi, 30 Oktober 2026

- Tombol tersedia pada halaman Cabang & sesi milik panitia. Konfirmasi menjelaskan jumlah sesi siap, cakupan Penyisihan/Final, serta jumlah sesi tanpa paket yang dilewati.
- RPC sesi yang sudah ada tetap memeriksa peran panitia dan ketersediaan paket. Sesi terbuka dilewati dan kebijakan paket yang tersimpan dipertahankan. Tidak ada migrasi baru.
- PASS: build produksi, TypeScript, dan format.
- PASS: browser Edge dengan Auth/REST/RPC fixture, Escape membatalkan konfirmasi tanpa request penulisan; dua sesi siap diproses, satu gagal disengaja; sesi tanpa paket dan sesi yang sudah terbuka tidak disentuh.
- PASS: pesan keberhasilan sebagian dan daftar kegagalan tampil; percobaan ulang hanya membuka sesi gagal, lalu tombol dinonaktifkan ketika tidak ada sesi siap yang tersisa.
- PASS: hanya record sessions terkait dibaca ulang; tidak muncul skeleton seluruh halaman dan node DOM sesi tanpa perubahan tetap identik.
- PASS: konfirmasi pada 360 piksel tidak overflow; screenshot diperiksa. Satu respons HTTP 400 sengaja dipicu untuk pengujian kegagalan sebagian, tanpa error aplikasi tak terduga.
- Hard Gate PASS: tombol, pembatalan keyboard, feedback, keadaan nonaktif, serta kegagalan sebagian diuji; semua angka berasal dari fixture/data sesi.
- Purpose-Gate PASS: aksi massal ditempatkan pada halaman pengelolaan sesi; tidak ada dekorasi atau aset baru.
- Liveliness PASS: motif dan ENERGY 1 / RHYTHM 1 / MOTION 1 tetap mengikuti DESIGN.md.
- Craftsmanship PASS: status sukses/gagal dipisahkan, kebijakan sesi tetap berlaku, dan state komponen lain dipertahankan. Tidak ada sesi Supabase live yang dibuka dalam pengujian ini.

## Identitas e-MTQ Kemenag Kubar, 30 Oktober 2026

- Kiri atas dashboard dan halaman login kini memakai e-MTQ Kemenag Kubar bersama logo Kementerian Agama. Judul tab ikut diperbarui.
- Aset disalin dari `kemenagkubar/public/logo-kemenag.png`; hash SHA-256 sumber dan salinan identik. Tidak ada pengubahan bentuk atau warna logo.
- PASS: build produksi, TypeScript, dan format.
- PASS: browser Edge, dua tampilan pada lebar 320, 768, dan 1440 piksel dalam dua tema, total 12 kombinasi. Gambar berhasil didekode, rasio asli terjaga, dan tidak ada horizontal overflow.
- PASS: login fixture membuka dashboard; menu ponsel membuka/menutup navigasi; dialog tema ditutup dengan Escape; console nol error. Tidak ada perubahan data live.
- Hard Gate PASS: aset sesuai permintaan pengguna, alt logo tersedia, layout responsif dan kontrol terkait tetap berfungsi.
- Purpose-Gate PASS: komponen identitas bersama menjaga konsistensi; dua baris nama menyesuaikan lebar sidebar tanpa mengecilkan teks berlebihan.
- Liveliness PASS: warna dan serif mengikuti mockup, ENERGY 1 / RHYTHM 1 / MOTION 1 tetap berlaku.
- Craftsmanship PASS: hasil visual diperiksa melalui screenshot dan image optimizer; perubahan terbatas pada identitas header/login dan judul tab.

## Pembaruan state per komponen, 30 Oktober 2026

- Penyimpanan tidak lagi memanggil pemuatan seluruh ruang kerja. Refresh sesudah perubahan hanya menggabungkan record atau koleksi yang terkait, dengan mempertahankan referensi record lain.
- Edit peserta mengambil satu record people berdasarkan ID. Penambahan peserta dengan respons RPC lama yang belum mengembalikan ID hanya mengambil daftar people, tanpa memuat kategori, akun, sesi, bank, hasil, atau log.
- Pengaturan sesi mengambil record sessions yang diubah; status akun mengambil record profiles yang diubah; pembatalan mengambil record results yang dibatalkan.
- Paket baru dan hasil undian memakai record dari respons RPC tanpa GET tambahan. Register hasil langsung diperbarui. Kembali dari bukti ke daftar peserta tidak mengambil ulang data halaman.
- Reset kata sandi tidak lagi memuat ulang state ruang kerja karena tidak mengubah kolom profil yang ditampilkan. Log terbaru dimuat ketika pengguna membuka halaman aktivitas.
- Area yang berubah memakai aria-busy lokal; skeleton halaman tetap khusus untuk muat awal, navigasi, dan pemuatan ulang eksplisit.
- PASS: browser Edge dengan respons Auth fixture dan PostgreSQL lokal, filter pencarian tetap berisi kata yang sama setelah edit, serta node DOM tabel, input pencarian, dan sidebar tetap identik.
- PASS: isian sesi tetangga dan panel kategori bank lain tidak dilepas dari DOM selama perubahan. Tidak muncul skeleton seluruh halaman selama penyimpanan.
- PASS: pencatatan request setelah perubahan menunjukkan hanya GET people, sessions, profiles, atau results sesuai tindakan; pembuatan paket, pengundian, reset sandi, dan kembali dari bukti tidak menghasilkan GET data tambahan.
- PASS: penambahan peserta baru juga hanya menghasilkan GET people dan mempertahankan node tabel.
- PASS: kegagalan refresh sesudah simpan ditampilkan sebagai perubahan sudah tersimpan, bukan kegagalan penulisan. State lama tetap terlihat dan Muat ulang eksplisit memulihkan data terbaru.
- PASS: tampilan ponsel 360 piksel tanpa overflow; build produksi, TypeScript, dan format lulus. Error HTTP 500 yang sengaja dipicu untuk pengujian refresh dipisahkan dari error aplikasi yang tidak diharapkan.
- Hard Gate PASS: seluruh kontrol perubahan terkait diuji, state loading/error tetap ada, filter dan navigasi tidak diganti setelah simpan, serta tidak ada data atau aset baru yang direkayasa.
- Purpose-Gate PASS: penyegaran record dibatasi sesuai tindakan, tanpa efek atau animasi tambahan.
- Liveliness PASS: motif visual dan ENERGY 1 / RHYTHM 1 / MOTION 1 tidak berubah.
- Craftsmanship PASS: pembaruan data tidak melepaskan komponen lain, data dari sesi pengguna lain tidak digabungkan, dan kegagalan refresh tidak mendorong pengulangan penulisan yang sudah berhasil.
- Batas uji: tidak ada perubahan data Supabase live. Reset password pada uji ini memakai respons API fixture untuk memeriksa perilaku state, bukan menguji ulang provider Auth hosted.

## Seed paket dan kode otomatis, 30 Oktober 2026

- Paket baru memperoleh kode `MQ-000001` dan seterusnya melalui sequence dan trigger PostgreSQL, baik dari UI, RPC, maupun seed. Kode lama tidak diganti dan kode yang telah dibuat tidak dapat diedit.
- Form tambah paket hanya meminta cabang, surah/materi, dan ayat/rentang materi. Informasi kode otomatis tampil sebelum pengguna menyimpan.
- Seed contoh yang dipilih pengguna menghasilkan 33 paket untuk 11 kategori, dengan label `[CONTOH]`. Referensi contoh berasal dari mockup, bukan ketetapan resmi tiap cabang. Penulisan contoh memerlukan flag eksplisit `--allow-examples`; `--dry-run` tidak menulis data.
- PASS: `supabase/tests/package_codes.sql`, kode otomatis tanpa payload code, pengabaian kode manual, audit sesuai kode hasil, larangan penulisan kecamatan, idempotensi seed, serta kode immutable.
- PASS: kode paket lama dibandingkan sebelum/sesudah migrasi lokal dan tidak berubah; seluruh assertion akses dalam `district_access.sql` tetap lulus.
- PASS: seed melalui skrip aktual dengan API lokal/PostgreSQL, dry-run 33 paket tanpa perubahan, seed pertama menambah 33, seed kedua menambah nol dan melewati 33.
- PASS: 12 pembuatan paket bersamaan pada PostgreSQL menghasilkan 12 kode berbeda.
- PASS: browser Edge, login admin fixture, buka form tambah paket, validasi kolom wajib, isi tiga kolom tanpa kode, simpan, lihat kode `MQ-000072` pada bank, serta cocokkan kode tersebut dalam Catatan aktivitas. Semua data pengujian bertanda TEST atau CONTOH dan berada di PostgreSQL lokal.
- PASS: form diperiksa pada lebar 360, 768, dan 1440 piksel tanpa overflow; console browser nol error. Selector audit awal diperbaiki agar memperhitungkan timestamp di dalam baris log.
- PASS: build produksi, TypeScript, dan format.
- Hard Gate PASS: field kode manual dihapus, kontrol simpan dan validasi diuji, label contoh terlihat, serta tidak ada angka paket sementara pada proses undian.
- Purpose-Gate PASS: kode dibuat di database untuk konsistensi dan permintaan bersamaan, tanpa perubahan motif visual atau aset baru.
- Liveliness PASS: arah mockup dan dials ENERGY 1 / RHYTHM 1 / MOTION 1 tetap berlaku.
- Craftsmanship PASS: seed memiliki validasi awal dan kunci stabil agar tidak menggandakan data; kode serta bukti lama dipertahankan; batas pengujian lokal dinyatakan.
- Batas live: pemeriksaan baca-saja menunjukkan kolom seed_key belum tersedia di Supabase live. Migrasi `202610300001_automatic_package_codes.sql` perlu diterapkan sebelum seed live dapat berjalan. Tidak ada paket live yang ditambahkan pada tahap pemeriksaan ini.

## Penyederhanaan akses kecamatan dan login, 28 Oktober 2026

- Login memakai satu form username dan kata sandi. Peran berasal dari profil akun setelah autentikasi.
- Kecamatan langsung masuk ke Daftar peserta. Navigasi utamanya tepat dua item: Daftar peserta dan Undian maqro. Tidak ada kontrol tambah/edit, status verifikasi, pengajuan, atau menu ringkasan terpisah.
- Panitia dapat menambah/edit peserta dan memilih kecamatan. Pada pengujian browser, peserta baru langsung dapat mengundi setelah paket ditambahkan dan sesi dibuka.
- Hasil dan register undian tampil pada menu Undian maqro; bukti dapat dibuka dalam modal dan ditutup dengan Escape. Reload membuka daftar peserta dan hasil lama tetap dapat ditemukan kembali.
- Migrasi baru `202610280001_simplify_district_access.sql` mempertahankan data lama dan mengganti aturan fungsi transaksi. Kolom status/note lama tetap ada untuk kompatibilitas, tanpa dipakai sebagai syarat undian. Pemindahan kecamatan peserta yang memiliki riwayat undian ditolak untuk menjaga cakupan akses hasil.
- PASS: migrasi baru diterapkan di PostgreSQL 15 pengujian; seluruh assertion dalam `supabase/tests/district_access.sql` lulus dan fixture di-rollback. Pemeriksaan meliputi larangan edit oleh kecamatan, undian dengan status legacy Draf, penolakan API verifikasi lama, RLS lintas kecamatan, sesi tertutup, paket habis, idempotensi, snapshot bukti, pembatalan, dan akun nonaktif.
- PASS: browser Edge menjalankan alur admin tambah/edit peserta, tambah paket, buka sesi, keluar, login kecamatan, cari peserta, lihat detail, undi tanpa pengajuan, buka bukti, serta reload. Respons Auth memakai fixture; permintaan REST/RPC diteruskan ke PostgreSQL lokal, tanpa perubahan data Supabase live.
- PASS: halaman undian beserta register diperiksa pada 360, 768, dan 1440 piksel dalam dua tema, tanpa overflow. Console browser mencatat nol error.
- Hard Gate PASS: semua kontrol baru memiliki perilaku teruji, dialog dapat ditutup dengan Escape, skeleton dan error handling tetap ada, serta tidak ada copy verifikasi yang tersisa di UI peserta.
- Purpose-Gate PASS: struktur dipersempit sesuai pekerjaan kecamatan; warna dan komponen mengikuti mockup, tanpa aset atau dekorasi baru.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 tetap mengikuti DESIGN.md.
- Craftsmanship PASS: build produksi dan pemeriksaan TypeScript lulus; dokumentasi alur serta prosedur migrasi diperbarui.
- Batas live: pemeriksaan nonmutatif terhadap RPC Supabase masih mengembalikan perilaku verifikasi lama. Migrasi kedua belum diterapkan saat pemeriksaan ini. Setelah SQL tersebut dijalankan di proyek live, uji login serta undian asli diperlukan; tidak ada hasil undian live yang dibuat selama pengembangan.

## Pembaruan skeleton loader, 28 Oktober 2026

- Hard Gate PASS: loading data diganti skeleton; status tetap tersedia untuk pembaca layar; header, navigasi, dan outline fokus tetap tersedia. Tidak ada aset, angka, atau copy faktual baru.
- Purpose-Gate PASS: bentuk skeleton mengikuti formulir, daftar, panel, atau bukti hasil; memakai token warna tema dan tidak menambahkan animasi berulang.
- Liveliness PASS: mengikuti DESIGN.md, ENERGY 1 / RHYTHM 1 / MOTION 1.
- Craftsmanship PASS: build produksi, TypeScript, format, serta browser Edge tanpa error console.
- Login: saat data profil ditahan, skeleton menggantikan formulir; formulir disembunyikan tanpa kehilangan struktur login.
- Navigasi dan Muat ulang: tujuh halaman admin diperiksa pada 360, 768, dan 1440 piksel, total 21 kombinasi; skeleton tampil saat respons ditahan dan hilang setelah respons selesai, tanpa overflow.
- Header tetap terlihat dan sidebar terbukti memakai node DOM yang sama selama loading.
- Tema gelap dan tombol Muat ulang melalui keyboard diperiksa.
- Undian: skeleton bukti tampil selama RPC ditahan, tidak menampilkan kode paket sementara, dan berganti ke bukti setelah respons selesai; layout bukti diperiksa pada 360 piksel.
- Pengujian ini memakai respons Auth/REST/RPC fixture yang dicegat browser dan tidak menulis ke Supabase live. Snapshot dan skrip berada di output/playwright/skeleton-*.

Bagian di bawah adalah catatan pengujian awal tanggal 27 Oktober 2026; batas konfigurasi Supabase pada catatan awal tersebut merupakan kondisi saat itu.

Tanggal: 27 Oktober 2026.

## Batas verifikasi

Build produksi Next.js dijalankan di localhost:3000. Kredensial Supabase hosted belum diberikan. Migrasi dan fungsi aplikasi diuji pada PostgreSQL 15 lokal terpisah, port 54329. Browser Edge memakai adapter API lokal pada port 54328 dan autentikasi fixture, dengan permintaan data serta RPC yang benar-benar menjalankan RLS dan fungsi PostgreSQL. Identitas dan materi uji ditandai `[TEST]`, terpisah dari akun AKUN.md.

Migrasi hosted, provisioning akun Supabase Auth dari AKUN.md, kebijakan Auth proyek, dan deployment belum diverifikasi. Konfigurasi yang belum diisi ditampilkan dengan jelas, tanpa login demo. Layanan fixture dan cluster database uji ditutup setelah pengujian.

## Pemeriksaan teknis

- PASS: `npm run build`, kompilasi produksi dan pemeriksaan tipe bawaan Next.js.
- PASS: `npm run typecheck`.
- PASS: `npm run format:check`.
- PASS: browser produksi localhost:3000 mencatat nol error dan nol warning console setelah perbaikan favicon.
- PASS: login produksi diperiksa pada 360, 768, dan 1440 piksel dalam dua tema; kondisi Supabase belum dikonfigurasi tampil jelas dan tombol login dinonaktifkan.
- PASS: permintaan web ke `/AKUN.md`, `/MOCKUP.html`, dan `/.env.local` mengembalikan 404.
- PASS: migrasi SQL dijalankan pada PostgreSQL 15 dengan pgcrypto.
- PASS: `supabase/tests/authorization.sql`, seluruh assertion selesai dengan ROLLBACK.
- PASS: dua transaksi bersamaan untuk peserta sama mengembalikan ID bukti yang sama.
- PASS: dua peserta yang bersaing untuk satu paket unik menghasilkan satu keberhasilan dan satu penolakan karena paket habis.
- PASS: parser AKUN.md menemukan 15 username unik, terdiri dari satu panitia dan 14 kecamatan, tanpa menampilkan kata sandi.

## Catatan klik browser

- Pilihan Admin utama dan Akun kecamatan mengubah konteks kolom username.
- Form login kosong memicu validasi wajib; password fixture salah memunculkan pesan gagal; login benar membuka ringkasan.
- Tambah paket menyimpan cabang, kode, materi, dan rentang ayat ke PostgreSQL.
- Simpan ketentuan paket unik mengubah sesi; Buka sesi mengubah status menjadi Dibuka.
- Tambah peserta tanpa cabang memunculkan validasi; setelah memilih cabang, data tersimpan.
- Lengkapi data membuka modal dan menyimpan perubahan; Ajukan verifikasi meminta konfirmasi dan mengubah status menjadi Diajukan.
- Periksa membuka detail; Kembalikan untuk perbaikan menyimpan catatan yang terlihat di akun kecamatan.
- Ajukan ulang mengirim pendaftaran; Verifikasi & kunci membuat peserta tersedia di ruang undian.
- Pilih undian membuka pemeriksaan identitas; Kembali mengembalikan daftar; Tetapkan maqro menampilkan bukti yang sudah tersimpan di database.
- Cetak / Simpan PDF memanggil `window.print`; tata letak media print diperiksa melalui screenshot, tanpa menyatakan bahwa dialog sistem diotomasi atau PDF hasil cetak telah diverifikasi.
- Kembali ke peserta dan Lihat bukti membuka hasil tersimpan; reload mempertahankan sesi fixture dan membaca ulang data database.
- Hasil undian membuka register; Ekspor CSV mengunduh file; Bukti hasil membuka modal; Escape menutup modal.
- Batalkan mewajibkan alasan, mempertahankan hasil lama, dan mencatat keputusan dalam Catatan aktivitas.
- Nonaktifkan dan Aktifkan akun meminta konfirmasi dan menyimpan status.
- Reset akses memanggil route server dengan akun panitia fixture dan mengganti kata sandi fixture; aktivitas reset tercatat.
- Ubah kata sandi memvalidasi konfirmasi, memeriksa sandi saat ini melalui adapter Auth, dan menyimpan perubahan fixture.
- Cari peserta dan filter status menampilkan hasil atau keadaan kosong yang sesuai.
- Menu membuka dan menutup navigasi pada 360 dan 768 piksel; navigasi desktop tetap terlihat pada 1440 piksel.
- Tema terang dan gelap bekerja melalui Pengaturan akun, tanpa mengganti identitas konteks login.
- Muat ulang saat jaringan data diputus menampilkan pesan error; setelah koneksi dipulihkan, tombol yang sama memuat ulang data.
- Escape menutup dialog dan mengembalikan fokus ke tombol pemicu dengan outline 3 piksel.
- Semua tujuh halaman admin diperiksa pada 360, 768, dan 1440 piksel, masing-masing dalam dua tema: 42 kombinasi halaman, lebar, dan tema tanpa horizontal overflow.

Error HTTP yang sengaja dipicu pada pengujian validasi, login salah, dan kegagalan jaringan dibedakan dari error aplikasi yang tidak diharapkan. Error favicon produksi yang ditemukan telah diperbaiki dengan menghapus handler ikon dan menonaktifkan permintaan ikon bawaan.

Screenshot pengujian lokal tersedia di `output/playwright/`, termasuk dashboard, register hasil, dan media print. Folder tersebut diabaikan Git.

## Delivery Gate antislop

Gate ini menilai implementasi dan bukti pengujian lokal, bukan kesiapan proyek Supabase hosted yang belum dikonfigurasi.

### Hard Gate

- R-02 PASS: pemindaian source dan copy yang ditulis tidak menemukan em dash atau en dash.
- R-03 PASS: 42 kombinasi layout diperiksa melalui browser tanpa horizontal overflow; kontrol memakai minimum 44 piksel.
- R-17 PASS: ringkasan dihitung dari tabel database, tanpa statistik promosi.
- R-18 PASS: tidak ada testimoni atau identitas orang rekaan dalam produk.
- R-23 PASS: nama teks, struktur navigasi, dan layout berasal dari mockup; tidak ada logo atau foto baru yang dibuat.
- R-24 PASS: setiap item navigasi membuka tampilan yang diimplementasikan dan diuji.
- R-25 PASS: pasangan token warna teks memiliki rasio terendah 5,26:1 pada tema terang dan 6,03:1 pada tema gelap, melebihi 4,5:1.
- R-26 PASS: perilaku tombol, formulir, modal, pengaturan, dan ekspor tercatat dalam daftar klik di atas.
- R-27 PASS: keadaan kosong diperiksa pada daftar tanpa data atau filter tanpa hasil; loading tampil selama fetch; kegagalan jaringan dan pemulihan diuji.
- R-28 PASS: tidak ada FAQ template.
- R-32 PASS: kontrol HTML native, label input, focus-visible, native modal, Escape, dan pemulihan fokus diperiksa.
- R-33 PASS: fitur ditulis langsung dalam source; tidak ada skrip penggantian string CSS/source.
- R-34 PASS: tujuh halaman diperiksa pada dua tema dan tiga lebar layar.
- R-35 PASS: build dijalankan dan klik kontrol dicatat; batas autentikasi fixture serta cetak browser dinyatakan secara eksplisit.
- R-36 PASS: tidak ada klaim keamanan, performa, atau kepatuhan yang direkayasa.
- R-37 PASS: arah visual dari MOCKUP.html diterapkan dan dicatat di DESIGN.md sebelum implementasi UI.
- R-38 PASS: kategori berasal dari MD; data uji bertanda TEST; produk tidak mengimpor peserta atau maqro contoh dari mockup.

### Purpose-Gate

- R-01 PASS: hijau tua dan krem mengikuti mockup; warna status hanya menandai status operasional.
- R-04 PASS: tidak memakai icon set atau glyph dekoratif.
- R-06 PASS: alasan Georgia untuk judul dan Segoe UI untuk data dicatat di DESIGN.md.
- R-07 PASS: tidak ada pola grid dekoratif.
- R-08 PASS: tombol memakai teks tindakan, tanpa panah dekoratif.
- R-09 PASS: label status berasal dari data pendaftaran, sesi, akun, dan hasil.
- R-10 PASS: tidak ada backdrop blur atau glassmorphism.
- R-12 PASS: panel rata mengikuti dokumen kerja; tidak memakai shadow massal.
- R-13 PASS: tidak ada glow.
- R-14 PASS: panel bank mengelompokkan paket per kategori resmi, bukan feature card promosi.
- R-19 PASS: gerakan terbatas pada respons tombol, sesuai MOTION 1; tidak ada animasi acak yang menyamar sebagai hasil undian.
- R-22 PASS: tidak ada ilustrasi generik.

### Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1, mengikuti mockup aplikasi kerja.
- Konsistensi PASS: tabel, formulir, dan daftar tugas mempertahankan ritme tenang.
- Focal point PASS: halaman memprioritaskan tugas, pilihan peserta, atau bukti undian sesuai konteks.
- Whitespace PASS: jarak membedakan formulir, kelompok data, dan tindakan.
- Accent PASS: warna hijau utama dipakai untuk tindakan operasional; warna lainnya menandai status.
- Identity PASS: judul serif, warna kertas dan hijau, serta bukti berbentuk register mempertahankan identitas mockup.
- Design Read PASS: dinyatakan sebelum membangun UI dan direkam di DESIGN.md.

### Craftsmanship dan Quality Locks

- C-1 / R-31 PASS: alasan keputusan warna, font, layout, panel, jarak, dan gerakan tertulis di DESIGN.md.
- C-2 PASS: catatan klik membuktikan kontrol berfungsi dalam lingkungan uji yang dijelaskan.
- C-3 / R-05 PASS: layar mengikuti pekerjaan panitia dan kafilah dari mockup, tanpa bagian promosi pengisi.
- C-4 PASS: keadaan data, tema, layout, keyboard, dan pemulihan error diuji lokal.
- C-5 PASS: angka berasal dari database dan fixture diberi label TEST.
- R-11 PASS: radius panel 6 piksel, input/tombol 4 piksel, status 3 piksel; tidak semuanya berbentuk pil.
- R-15 PASS: tindakan spesifik seperti Ajukan verifikasi, Tetapkan maqro, dan Simpan paket.
- R-16 PASS: copy menjelaskan pekerjaan operasional tanpa buzzword promosi.
- R-20 PASS: identitas mengikuti mockup Maqro yang diberikan.
- R-21 PASS: tema terang dan gelap berfungsi dan diuji.
- R-29 PASS: dasar hijau dan krem, dengan warna peringatan/pembatalan untuk status nyata.
- R-30 PASS: tidak meniru tampilan produk lain.

## Masih diperlukan untuk operasional live

Isi `.env.local`, jalankan migrasi pada proyek Supabase yang dituju, jalankan provisioning akun, lalu uji login asli, reset akses, dan undian lintas perangkat pada proyek tersebut. Masukkan paket resmi sebelum membuka sesi. Prosedur tersedia dalam README.md.

Tinjauan React: query independen berjalan paralel setelah profil diperiksa, pagination memiliki urutan tetap, subscription dan timer dibersihkan saat unmount, hasil request lama tidak menimpa request terbaru, dan penulisan tetap divalidasi pada database. Route reset akses memeriksa identitas dan peran di server sebelum menggunakan service role key.
