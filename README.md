# Maqro, ruang kerja MTQ Kutai Barat

Next.js App Router, React, TypeScript, dan PostgreSQL di Supabase. Tampilan mengikuti MOCKUP.html. Data awal kategori berasal dari KATEGORI.md, akun dari AKUN.md. Seed akun tidak memasukkan peserta atau paket maqro contoh; seed paket dijalankan terpisah.

## Menjalankan

1. Pasang Node.js 22 atau lebih baru, lalu jalankan `npm install` (Windows: `npm.cmd install`).
2. Buat proyek Supabase. Jalankan migrasi dalam `supabase/migrations/` menurut urutan nama: `202610270001_maqro.sql`, `202610280001_simplify_district_access.sql`, `202610300001_automatic_package_codes.sql`, `202610300002_fixed_unique_packages.sql`, `202610300003_district_accounts.sql`, lalu `202610300004_single_session_per_category.sql`. Untuk proyek yang sudah berjalan, jalankan hanya migrasi yang belum diterapkan.
3. Salin `.env.example` ke `.env.local`. Isi URL proyek, publishable key, dan service role key dari proyek Supabase. Service role key hanya untuk provisioning lokal dan pengelolaan akun pada server. Jangan gunakan awalan NEXT_PUBLIC pada secret tersebut.
4. Jalankan `npm run seed`. Skrip membaca AKUN.md, membuat 15 akun Supabase Auth dan profil, serta melewati akun yang sudah memiliki profil. Menjalankannya ulang tidak mengganti kata sandi. Jangan hapus profil akun yang sudah dipakai.
5. Jalankan `npm run dev`, lalu buka http://localhost:3000. Masuk dengan username dan kata sandi dari AKUN.md.
6. Sebelum publikasi, jalankan `npm run typecheck` dan `npm run build`, lalu uji akses panitia dan kecamatan pada proyek Supabase yang digunakan.

Nama pengguna dipetakan secara internal ke `<username>@accounts.maqro.invalid` untuk Supabase Auth. Alamat ini bukan kotak surat dan bukan saluran pemulihan. Pengguna tetap masuk menggunakan username. Nonaktifkan pendaftaran publik melalui Authentication > Providers > Email > Allow new users to sign up. Akun hanya disiapkan panitia. Reset akses dilayani panitia, tanpa tautan email.

## Alur operasional

Semua akun masuk melalui satu formulir nama pengguna dan kata sandi. Akses ditentukan oleh profil akun, tanpa memilih peran pada halaman login.

Panitia menambah dan mengedit peserta, menentukan kecamatan serta cabang yang diikuti, memasukkan paket resmi, kemudian membuka satu sesi per cabang. Akun kecamatan langsung membuka Daftar peserta dan hanya memiliki dua menu: Daftar peserta serta Undian maqro. Daftar peserta hanya dapat dibaca oleh kecamatan pemiliknya. Pada menu Undian maqro, kecamatan memilih cabang dan peserta lalu menetapkan maqro ketika sesi dibuka. Hasil dan bukti juga dapat dilihat dari daftar peserta. Tidak ada pengajuan atau verifikasi peserta.

Hasil disimpan dalam transaksi database sebelum bukti ditampilkan. Hasil tiap cabang digabungkan pada Daftar peserta, bersama bukti, riwayat pembatalan, dan tindakan pembatalan khusus panitia. Ekspor hasil CSV tersedia di daftar peserta; tidak ada menu atau register hasil terpisah. Bukti dapat dicetak atau disimpan sebagai PDF melalui dialog cetak browser. Pengaturan akun, tema, dan keluar tetap tersedia sebagai utilitas akun.

Pada Undian maqro, kecamatan memilih cabang terlebih dahulu, kemudian mencari peserta dan menyaring status Siap diundi, Sudah diundi, atau Sesi ditutup. Sesi yang dibuka ditampilkan lebih dahulu. Peserta yang sudah diundi membuka bukti; peserta yang belum diundi hanya dapat melanjutkan jika sesi dibuka. Pilihan cabang, pencarian, dan status tetap dipertahankan saat kembali dari pemeriksaan data atau bukti. Hasil yang dibatalkan tidak menghalangi undian pengganti pada sesi terbuka.

Setiap cabang memiliki tepat satu sesi tanpa pembagian babak. Setiap peserta hanya memiliki satu hasil aktif per cabang. Paket yang telah diambil tidak tersedia bagi peserta lain pada cabang yang sama, melintasi seluruh kecamatan dan kategori Putra/Putri. Tidak ada pilihan untuk mengizinkan pengulangan paket. Untuk kelompok Syarhil, satu pendaftaran mewakili identitas peserta/kelompok yang dimasukkan; aplikasi belum mencatat anggota kelompok secara terpisah atau memvalidasi batas usia per cabang karena aturan tersebut tidak disediakan.

Hanya panitia dapat membatalkan hasil dengan alasan wajib. Hasil lama dan jejak aktivitas tetap tersimpan. Setelah dibatalkan, peserta dapat mengundi kembali pada sesi yang masih dibuka. Paket hasil yang dibatalkan kembali tersedia, mengikuti alur pembatalan yang sudah ada.

Pada Cabang & sesi, tombol Buka semua sesi meminta konfirmasi untuk membuka sesi cabang yang tertutup dan memiliki paket. Sesi yang sudah terbuka dilewati dan sesi tanpa paket tetap ditutup. Semua sesi memakai paket unik. Jika sebagian permintaan gagal, aplikasi menampilkan sesi yang belum berhasil; percobaan ulang hanya menyertakan sesi yang masih tertutup. Pembaruan tampilan terbatas pada record sesi terkait.

Daftar Cabang & sesi memakai tabel dengan kolom cabang, jumlah paket, status, dan tindakan. Tidak ada kolom/dropdown ketentuan paket atau tombol Simpan. Pada ponsel, kolom ditata vertikal per baris agar kontrol tetap dapat digunakan. Migrasi `202610300002_fixed_unique_packages.sql` menetapkan paket unik dan menolak pengaktifan pengulangan dari klien lama.

## Penggabungan sesi per cabang

Jalankan `202610300004_single_session_per_category.sql` melalui SQL Editor Supabase. Migrasi menggabungkan sesi lama per cabang, mengarahkan seluruh hasil ke ID sesi yang dipertahankan, menghapus kolom babak, dan membatasi satu sesi per cabang. ID bukti, paket, identitas peserta, waktu, status, alasan pembatalan, serta log tetap dipertahankan. Sesi gabungan dibuka jika salah satu sesi lama dibuka. Unique index membatasi satu peserta dan satu paket per hasil aktif dalam cabang tersebut.

Jika satu peserta memiliki beberapa hasil aktif pada cabang sama, atau satu paket dipakai beberapa hasil aktif lintas sesi lama, seluruh migrasi dibatalkan sebelum perubahan. Tinjau dan batalkan hasil yang perlu diganti melalui UI lama terlebih dahulu, lalu jalankan ulang migrasi; tidak ada hasil yang otomatis dibatalkan/dihapus. Terapkan migrasi sebelum memakai UI baru. UI memberi pesan migrasi jika schema sesi lama masih terdeteksi. Akses SQL Supabase tidak tersedia pada sesi implementasi; migrasi telah diuji lokal, belum dijalankan pada Supabase live.

## Akses dan penyimpanan

Maqro tidak menggunakan kode. Panitia mengisi cabang, surah/materi, dan ayat/rentang materi. Relasi paket dan hasil undian menggunakan ID internal. Terapkan seluruh migrasi, termasuk penghapusan kode maqro, sebelum menjalankan versi ini.

- Semua tabel memakai RLS. Kecamatan hanya membaca peserta dan hasil kecamatannya. Bank paket hanya dibaca panitia.
- Penulisan operasional melewati `maqro_action`, yang memeriksa akun aktif, peran, kepemilikan, cabang, sesi, dan ketersediaan paket pada server database. Status verifikasi lama tidak menentukan kelayakan undian. Tambah/edit peserta hanya diizinkan untuk panitia; permintaan submit/verify/revise tidak lagi didukung.
- Kolom status dan catatan lama dipertahankan untuk kompatibilitas data, tetapi tidak ditampilkan atau digunakan dalam alur baru. Bukti lama tetap tersimpan. Kecamatan peserta yang sudah memiliki riwayat undian tidak dapat dipindahkan agar cakupan akses hasil tetap konsisten.
- Pengundian mengunci sesi selama transaksi, memilih paket dengan byte acak pgcrypto, lalu menyimpan hasil dan aktivitas dalam transaksi yang sama. Unique index mencegah dua hasil aktif untuk satu peserta dan sesi. Permintaan ulang mengembalikan hasil aktif yang sudah ada.
- Hasil menyimpan salinan identitas peserta, kategori, dan isi paket untuk riwayat bukti.
- Tidak ada kata sandi di bundle frontend atau data tabel aplikasi. AKUN.md dan .env.local diabaikan Git. Simpan AKUN.md secara terbatas dan jangan letakkan di folder public.
- Perubahan data dari perangkat lain dimuat saat navigasi atau tombol Muat ulang, tanpa mengklaim pembaruan realtime.
- Setelah perubahan lokal berhasil, aplikasi hanya memperbarui koleksi/record yang terkait. Edit peserta, sesi, status akun, dan pembatalan mengambil ulang record berdasarkan ID. Paket baru serta hasil undian langsung menggunakan respons RPC. Penambahan peserta pada API lama yang belum mengembalikan ID hanya menyegarkan daftar peserta. Filter, tabel, dan state komponen lain tetap terpasang; tidak ada skeleton satu halaman setelah simpan.
- Reset kata sandi tidak memuat ulang data ruang kerja. Jika perubahan sudah tersimpan tetapi pembacaan record terbaru gagal, aplikasi menyampaikan kondisi tersebut agar pengguna tidak mengulang penulisan tanpa perlu. Skeleton halaman tetap dipakai saat muat awal, navigasi, atau tombol Muat ulang yang dipilih pengguna.

## Tambah dan edit akun kecamatan

Jalankan `supabase/migrations/202610300003_district_accounts.sql` melalui SQL Editor Supabase setelah migrasi sebelumnya. Migrasi diperlukan sebelum menggunakan tombol **Tambah akun kecamatan** dan ikon **Edit akun** pada menu Akun kecamatan. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan oleh endpoint server.

Panitia mengisi kecamatan, nama pengguna (huruf kecil, angka, atau tanda hubung), dan kata sandi awal minimal 12 karakter. Edit mengubah kecamatan/nama pengguna tanpa mengganti kata sandi. Gunakan Reset kata sandi untuk menggantinya. Nama pengguna disinkronkan dengan email internal Supabase Auth; perubahan kecamatan ikut memperbarui referensi peserta dan hasil undian agar akses kecamatan tetap sesuai. Akun baru selalu berperan kecamatan dan aktif. Akun admin tidak dapat diedit melalui endpoint ini.

Profil, referensi kecamatan, dan catatan aktivitas disimpan dalam satu transaksi. Jika transaksi ditolak, endpoint menghapus Auth baru atau mengembalikan email Auth ke nama pengguna profil terkini. UI menggunakan profil hasil penyimpanan untuk memperbarui state terkait tanpa memuat ulang halaman. Uji database: `supabase/tests/district_accounts.sql`; seluruh fixture di-rollback.

## Verifikasi database

`supabase/tests/district_access.sql` memeriksa akses lintas kecamatan, larangan edit oleh kecamatan, undian langsung tanpa verifikasi, idempotensi, pembatalan, dan akun nonaktif. Jalankan menggunakan `psql -v ON_ERROR_STOP=1 -f supabase/tests/district_access.sql` setelah seluruh migrasi dan provisioning pada database pengujian. `supabase/tests/packages_without_codes.sql` memeriksa pembuatan paket tanpa kode, akses kecamatan, serta idempotensi seed. Jalankan dengan psql setelah seluruh migrasi diterapkan; data fixture di-rollback.

`supabase/tests/fixed_unique_packages.sql` memeriksa aturan paket unik, penolakan pengulangan melalui database dan RPC, satu sesi per cabang, satu hasil aktif per peserta, serta penolakan pemakaian paket oleh kecamatan lain pada cabang yang sama. `supabase/tests/single_session.sql` memeriksa penghapusan kolom babak, satu sesi pada setiap cabang, serta keunikan hasil aktif peserta dan paket setelah migrasi.

## Seed paket maqro

Jalankan seluruh migrasi Supabase sebelum mengisi paket. Konfigurasi `.env.local` yang digunakan sama dengan seed akun. Skrip paket terpisah dari seed akun agar menjalankan provisioning akun tidak otomatis memasukkan materi contoh.

Periksa sumber contoh tanpa menulis data:

```powershell
npm.cmd run seed:packages -- --dry-run
```

Untuk pengujian, masukkan 33 paket contoh, masing-masing tiga paket pada 11 kategori:

```powershell
npm.cmd run seed:packages -- --allow-examples
```

Sumber `supabase/seed-packages.example.json` memakai referensi surah dan ayat contoh dari MOCKUP.html, dengan awalan `[CONTOH]` yang terlihat dalam bank dan bukti hasil. Materi ini bukan ketetapan resmi cabang perlombaan, termasuk hafalan dan Syarhil. Gunakan pada proyek pengujian. Seed tidak membuka sesi secara otomatis. Tanpa flag `--allow-examples`, penulisan data contoh ditolak.

Untuk paket resmi, siapkan JSON dengan format berikut, isi menggunakan materi yang benar-benar ditetapkan panitia, lalu jalankan `npm.cmd run seed:packages -- --file path/ke/paket-resmi.json`:

```json
{
  "example": false,
  "packages": [
    {
      "category": "[NAMA KATEGORI DARI KATEGORI.md]",
      "surah": "[SURAH ATAU MATERI RESMI]",
      "verses": "[AYAT ATAU RENTANG MATERI RESMI]"
    }
  ]
}
```

Jangan mengisi kode pada JSON. Skrip memvalidasi seluruh kategori dan data sebelum menulis satu batch. Kunci seed dihitung dari kategori, materi, dan rentang ayat sehingga menjalankan file yang sama lagi tidak menggandakan paket. Mengubah materi dianggap paket baru dan tidak menimpa paket atau bukti lama. Materi contoh maupun resmi tidak diklaim telah masuk ke Supabase live sampai seed berhasil dijalankan pada proyek tersebut.

Dokumentasi stack: [Next.js](https://nextjs.org/docs/app/getting-started/installation) dan [Supabase](https://supabase.com/docs/guides/auth).
