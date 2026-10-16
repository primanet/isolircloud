# 🚀 Panduan Deploy Halaman Isolir ke Vercel

Folder ini (`isolir-web`) dirancang khusus untuk di-deploy ke **Vercel** dan dihubungkan ke subdomain **`isolir.onebilling.cloud`**.

---

## 1. Deploy ke Vercel

### Cara Cepat via Terminal (VS Code):
Buka terminal di folder `isolir-web`, lalu jalankan:
```bash
npx vercel
```
- Ikuti langkah di layar:
  - `Set up and deploy?` Ketik **Y**
  - `Which scope do you want to deploy to?` Pilih akun Vercel Anda
  - `Link to existing project?` Ketik **N**
  - `What's your project's name?` Ketik **isolir-onebilling** (atau nama lain)
  - `In which directory is your code located?` Tekan **Enter** (`./`)
- Setelah selesai, proyek sudah live!

---

## 2. Hubungkan Custom Domain `isolir.onebilling.cloud`

1. Buka dashboard Vercel Anda di [vercel.com](https://vercel.com).
2. Klik proyek isolir yang baru saja di-deploy.
3. Masuk ke **Settings** > **Domains**.
4. Masukkan nama domain: **`isolir.onebilling.cloud`**, lalu klik **Add**.
5. Vercel akan memberikan petunjuk DNS Record (biasanya berupa CNAME):
   - **Type:** `CNAME`
   - **Name:** `isolir`
   - **Target / Value:** `cname.vercel-dns.com`

---

## 3. Tambahkan DNS di Cloudflare / Registrar Domain Anda

1. Masuk ke dashboard **Cloudflare** (atau tempat domain `onebilling.cloud` dikelola).
2. Masuk ke menu **DNS** > **Records**.
3. Tambah record baru:
   - **Type:** `CNAME`
   - **Name:** `isolir`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** **DNS Only** (Disarankan abu-abu / DNS Only agar port 80 langsung diterima Vercel tanpa intervensi SSL error di MikroTik).
4. Klik **Save**. Tunggu 1–5 menit hingga status di Vercel menjadi centang hijau (*Valid Configuration*).

---

## 4. Konfigurasi di MikroTik RouterOS

Jalankan perintah ini di **Terminal MikroTik**:

### Untuk RouterOS v6:
```routeros
# 1. IP Pool & Profile Isolir
/ip pool add name=OB-ISOLIR ranges=10.12.19.2-10.12.19.254
/ppp profile add name=OBISOLIR local-address=10.12.19.1 remote-address=OB-ISOLIR address-list=OB-ISOLIR

# 2. Web Proxy
/ip proxy set cache-administrator=ONEBILLING enabled=yes max-cache-size=none port=4111

# 3. Proxy Redirect ke isolir.onebilling.cloud
/ip proxy access
add comment="Isolir" dst-port=4111 src-address=10.12.19.0/24
add action=deny comment="Isolir" dst-host=!isolir.onebilling.cloud dst-port=80 redirect-to=isolir.onebilling.cloud src-address=10.12.19.0/24

# 4. Firewall NAT & Filter
/ip firewall nat
add action=redirect chain=dstnat comment="Isolir-NAT" protocol=tcp src-address-list="OB-ISOLIR" dst-port=80 to-ports=4111

/ip firewall filter
add action=drop chain=forward comment="Isolir-DropNonWeb" dst-port=!80,4111 protocol=tcp src-address-list="OB-ISOLIR"
add action=drop chain=forward comment="Isolir-DropNonDNS" dst-port=!53 protocol=udp src-address-list="OB-ISOLIR"
```

### Untuk RouterOS v7:
```routeros
# 1. IP Pool & Profile Isolir
/ip pool add name=OB-ISOLIR ranges=10.12.19.2-10.12.19.254
/ppp profile add name=OBISOLIR local-address=10.12.19.1 remote-address=OB-ISOLIR

# 2. Web Proxy
/ip proxy set cache-administrator=ONEBILLING enabled=yes max-cache-size=none port=4111

# 3. Proxy Redirect ke isolir.onebilling.cloud
/ip proxy access
add comment="Isolir" dst-port=4111 src-address=10.12.19.0/24
add action=redirect comment="Isolir" dst-host=!isolir.onebilling.cloud dst-port=80 action-data=isolir.onebilling.cloud src-address=10.12.19.0/24

# 4. Firewall NAT & Filter
/ip firewall nat
add action=redirect chain=dstnat comment="Isolir-NAT" protocol=tcp src-address-list="OB-ISOLIR" dst-port=80 to-ports=4111

/ip firewall filter
add action=drop chain=forward comment="Isolir-DropNonWeb" dst-port=!80,4111 protocol=tcp src-address-list="OB-ISOLIR"
add action=drop chain=forward comment="Isolir-DropNonDNS" dst-port=!53 protocol=udp src-address-list="OB-ISOLIR"
```

---

## 5. Cara Mengubah Teks & Data Halaman Isolir

Anda tidak perlu mengubah kodingan file HTML lagi!
Cukup masuk ke **Dashboard Admin Billing Cerdas** > **Pengaturan** > **Halaman Isolir**:
- Ganti Judul & Pesan.
- Ganti Nama Bank, No. Rekening, dan Atas Nama.
- Ganti Nomor WhatsApp CS.
- Klik **Simpan Pengaturan**.

Website di `isolir.onebilling.cloud` akan langsung menampilkan data terbaru secara otomatis.
