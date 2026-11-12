# Babak Final

Data peserta tetap memakai
`people`; keikutsertaan, jadwal, sesi, paket, dan hasil Final memakai empat tabel
`final_*` serta RPC `maqro_final_action`. RPC dan tabel penyisihan tidak diubah.

## Urutan rilis

1. Pastikan backup database production tersedia. Periksa daftar migrasi pending.
   Instalasi Final memakai `20261112014552_final_round.sql`; penghapusan histori
   Final memerlukan `20261112104456_final_draw_history_deletion.sql` setelahnya.
2. Uji migrasi dan build pada staging terlebih dahulu. Terapkan migrasi baru
   sebagai satu transaksi. `lock_timeout = '5s'` membatalkan migrasi jika lock
   tidak segera tersedia; jangan menaikkan timeout saat undian sedang ramai.
3. Deploy aplikasi setelah migrasi berhasil. Aplikasi lama tetap membaca tabel
   penyisihan yang sama; seluruh sesi Final baru berstatus tertutup. Jika aplikasi
   lebih dahulu terdeploy, tab Final menjelaskan bahwa fitur belum diaktifkan,
   sementara Penyisihan tetap tersedia.
4. Periksa login panitia/kecamatan, daftar peserta dan bukti Penyisihan tanpa
   membuat undian percobaan di production. Periksa tab Final kosong dan sesi
   tertutup. Siapkan finalis/paket resmi hanya setelah pemeriksaan selesai.
5. Pantau error aplikasi/RPC dan kegagalan pemuatan. Notifikasi Final hanya
   membawa nama tabel, dengan pembacaan tetap dibatasi RLS. Penyisihan tetap
   memakai kanal Realtime lama; Final memakai notifikasi yang sama dan fallback
   polling tanpa membuka kanal ganda.

## Pemakaian

- Daftar peserta → Final → Pilih finalis → pilih cabang dan peserta → periksa →
  Tetapkan finalis. Identitas dan nomor peserta tetap mengikuti data terdaftar.
- Atur sesi finalis (manual/jadwal WITA), terpisah dari sesi Penyisihan.
- Bank maqro → Final → Tambah maqro final. Paket lama tidak disalin otomatis.
- Cabang & sesi → Final → Buka undian final. Konfirmasi menampilkan finalis dan
  paket tersedia. Paket yang belum cukup diberi peringatan; paket tidak dipakai
  dua kali dalam hasil aktif. Aturan ini mengikuti perilaku penyisihan saat ini.
- Akun kecamatan → Undian maqro → Final. Hanya finalis kecamatan terkait yang
  tampil. Admin dapat melakukan undian melalui impersonasi dengan audit pelaksana.
- Bukti dan ekspor Final mencantumkan babak. Pembatalan memerlukan alasan;
  hasil lama tetap tercatat. Finalis yang memiliki riwayat undian tidak dapat
  dikeluarkan. Penghapusan peserta dari fitur lama tetap menghapus seluruh
  riwayat peserta, termasuk Final, melalui FK cascade.
- Penghapusan histori tersedia per hasil dan melalui Hapus seluruh histori Final
  di Daftar peserta → Final. Panitia harus menyetujui checkbox konfirmasi.
  Penghapusan seluruh histori mencakup hasil aktif/dibatalkan di semua cabang,
  terlepas dari filter daftar, sesuai jumlah dan ID yang dikonfirmasi. Peserta,
  finalis, paket, serta hasil Penyisihan tetap tersimpan. Catatan audit mencatat
  admin pelaksana dan hasil yang dihapus. ID kedaluwarsa membatalkan seluruh
  batch, sehingga panitia perlu memuat ulang dan memeriksa kembali.

## Pemulihan

Tutup sesi Final jika ada masalah pada fitur baru. Rollback deployment aplikasi
ke versi sebelumnya bila diperlukan. Biarkan tabel Final dan data yang sudah
tersimpan; tidak perlu rollback schema, reset peserta, atau menghapus hasil.
Jangan mengulangi migrasi yang sudah tercatat berhasil.

## Verifikasi lokal

- `npm run typecheck`, `npm run test:unit`, `npm run build`.
- `node scripts/workflows.test.mjs`: database fixture sementara di
  `127.0.0.1:54329` dengan role `maqro_test`; database otomatis dihapus setelah tes.
- `MAQRO_TEST_APP_URL` dapat diarahkan ke server aplikasi localhost, kemudian
  `node scripts/workflows.test.mjs --browser`. Auth dan semua REST/RPC dialihkan
  ke fixture lokal yang benar-benar menjalankan RLS dan transaksi PostgreSQL.
- Kasus mencakup otorisasi, seleksi atomik, jadwal, waktu setelah lock,
  undian bersamaan, retry setelah sesi ditutup, paket habis, pembatalan,
  impersonasi, isolasi data Penyisihan, dan penghapusan peserta.

Verifikasi lokal tidak membuktikan konfigurasi Realtime atau deployment hosted.
Tidak ada akun, paket, hasil, atau migrasi production yang diubah saat pengujian.

Hasil pemeriksaan 12 November 2026: 16 unit test lulus; 18 kelompok workflow
lulus termasuk browser → API fixture → PostgreSQL → bukti → reload. Migrasi
diuji pada tabel Penyisihan yang sudah berisi data, dengan snapshot tabel dan
definisi RPC lama tetap sama. Browser juga menguji fallback tanpa migrasi Final.
Tampilan daftar finalis, sesi, dialog jadwal, pemilih undian, dan bukti diperiksa
pada lebar 360 dan 1440 piksel; bukti juga diperiksa pada 768 piksel.
