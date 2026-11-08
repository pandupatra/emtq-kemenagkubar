# Sinkronisasi ruang kerja

Terapkan `supabase/migrations/20261108050558_workspace_realtime.sql` pada
database Supabase sebelum merilis frontend ini. Migrasi menambahkan trigger
statement dan kebijakan SELECT untuk channel Broadcast privat. Tidak perlu
menambahkan tabel peserta ke publication Postgres Changes.

Channel `workspace:admin` hanya boleh dibaca admin aktif. Channel
`workspace:district:<nama>` hanya boleh dibaca akun aktif kecamatan terkait.
Notifikasi hanya membawa nama tabel; pengambilan data tetap tunduk pada RLS
tabel sumber. INSERT, UPDATE dan DELETE ditangani, termasuk kecamatan lama
dan baru ketika peserta dipindahkan. Perubahan kategori/sesi diberitahukan
ke seluruh kecamatan aktif. Bank maqro hanya diberitahukan kepada admin.

Frontend menggabungkan notifikasi selama 1,5 detik dan mengambil ulang hanya
tabel yang berubah (serta profil sendiri untuk validasi akses). Refresh tidak
memicu skeleton atau mereset filter. Modal, konfirmasi undian dan animasi
menunda sinkronisasi sampai interaksi selesai. Respons sebelum mutasi lokal
atau refresh manual tidak boleh menimpa data setelahnya.

Ketika channel terputus, polling cadangan berjalan setiap 45–60 detik dengan
jitter. Polling berhenti membaca data saat tab tersembunyi atau offline.
Kembali ke tab, online, atau tersambung kembali memicu rekonsiliasi data.
Kegagalan pembacaan dicoba ulang dengan jeda bertahap hingga 60 detik.

Verifikasi lokal: `npm run test:unit`, `npm run test:workflows`, dan
`npm run build`. Suite workflow memakai database sementara pada PostgreSQL
lokal port 54329; antarmuka SQL Realtime diemulasi untuk menguji trigger dan
RLS. Pengujian scheduler memakai waktu dan channel terkendali.

Sebelum dipakai pada acara, lakukan uji hosted dengan dua kecamatan dan admin:
ubah/hapus peserta, buka/tutup sesi, lakukan undian, lalu putus/sambungkan
koneksi. Pastikan hanya pihak berhak menerima pembaruan, formulir tetap utuh,
dan periksa laporan Realtime saat simulasi 50 pengguna. Pengiriman WebSocket
hosted dan batas paket belum dibuktikan oleh pengujian lokal.
