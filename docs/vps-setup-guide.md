# VPS Kurulum Rehberi — Hetzner + CapRover + Docker

> Ubuntu 22.04 üzerine CapRover kurulumu, GEO Audit uygulamasını deploy etme rehberi.

---

## 1. Hetzner'den VPS Alma

1. https://www.hetzner.com/cloud adresine git, hesap oluştur
2. **New Project** → proje adı: `worgoo` (veya istediğin)
3. **Add Server** tıkla:
   - **Location:** Falkenstein (DE) veya Helsinki (FI) — Türkiye'ye yakın
   - **Image:** `Ubuntu 22.04`  ⚠️ **24 değil, 22 kur!**
   - **Type:** `CX22` (2 vCPU, 4GB RAM, 40GB SSD) — **aylık ~€4.35**
     - Minimum `CX11` (2GB RAM) olur ama 4GB rahat eder
   - **Networking:** IPv4 + IPv6
   - **SSH Keys:** Varsa ekle (yoksa aşağıda anlatıyorum)
   - **Name:** `caprover-main`
4. **Create & Buy Now** tıkla
5. IP adresini not al (örn: `65.108.xxx.xxx`)

### SSH Key Oluşturma (yoksa)

```bash
# Mac terminalinde:
ssh-keygen -t ed25519 -C "efehan@worgoo"
# Enter'a bas (varsayılan konum)
# Şifre opsiyonel

# Public key'i kopyala:
cat ~/.ssh/id_ed25519.pub
# Çıktıyı Hetzner'deki SSH Keys kısmına yapıştır
```

---

## 2. SSH ile Sunucuya Bağlanma

```bash
ssh root@SUNUCU_IP
# İlk bağlantıda "yes" yaz
```

### İlk Güvenlik Ayarları

```bash
# Sistemi güncelle
apt update && apt upgrade -y

# Firewall aç
ufw allow 22        # SSH
ufw allow 80        # HTTP
ufw allow 443       # HTTPS
ufw allow 3000      # CapRover başlangıç portu
ufw enable
# "y" yaz

# Swap ekle (4GB RAM varsa opsiyonel, 2GB ise şart)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 3. Docker Kurulumu

```bash
# Docker'ın resmi kurulum scripti
curl -fsSL https://get.docker.com | sh

# Docker'ı kontrol et
docker --version
# Docker version 24.x+ olmalı

# Docker'ı başlangıçta çalıştır
systemctl enable docker
systemctl start docker
```

---

## 4. CapRover Kurulumu

### 4a. Domain Ayarı (ÖNEMLİ — CapRover'dan ÖNCE yap)

Bir domain veya subdomain'i sunucuya yönlendir:

```
Örnek: DNS ayarlarında şunu ekle:
  *.caprover.worgoo.com  →  A Record  →  SUNUCU_IP
  caprover.worgoo.com    →  A Record  →  SUNUCU_IP
```

> ⚠️ Wildcard DNS (`*.caprover.worgoo.com`) şart — CapRover her uygulama için
> `appname.caprover.worgoo.com` şeklinde subdomain oluşturur.

Eğer henüz domain yoksa, IP ile de başlayabilirsin (SSL olmadan).

### 4b. CapRover'ı Kur

```bash
docker run -p 80:80 -p 443:443 -p 3000:3000 \
  -e ACCEPTED_TERMS=true \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /captain:/captain \
  caprover/caprover
```

Kurulum 1-2 dakika sürer. Tamamlanınca:

```
CapRover is ready! Visit: http://SUNUCU_IP:3000
```

### 4c. CapRover İlk Kurulum (Web Panel)

1. Tarayıcıda `http://SUNUCU_IP:3000` aç
2. Varsayılan şifre: `captain42`
3. **Hemen şifreyi değiştir!**
4. Domain'i gir: `caprover.worgoo.com` (veya senin domain'in)
5. **Enable HTTPS** tıkla — Let's Encrypt otomatik SSL verir
6. **Force HTTPS** aktif et

Artık panel: `https://captain.caprover.worgoo.com`

---

## 5. CapRover CLI Kurulumu (Mac'inde)

```bash
npm install -g caprover

# Sunucuya bağlan
caprover serversetup
# Domain, şifre vs. sor — gir

# Login ol
caprover login
# URL: https://captain.caprover.worgoo.com
# Şifre: belirlediğin şifre
```

---

## 6. GEO Audit Uygulamasını Deploy Etme

### 6a. CapRover'da Uygulama Oluştur

1. CapRover paneline git → **Apps** → **Create A New App**
2. App Name: `geo-audit`
3. **Has Persistent Data:** Hayır
4. Oluştur

### 6b. Environment Variables Ekle

App sayfasında **App Configs** sekmesi:
```
GEMINI_API_KEY=AIzaSyB-FwIvalAqTGL3YY0Hxcm0KbSWmC2laig
NEXT_PUBLIC_HAS_AI=true
```
**Save & Update** tıkla.

### 6c. captain-definition Dosyası Oluştur

Proje kök dizininde `captain-definition` dosyası oluştur:

```json
{
  "schemaVersion": 2,
  "dockerfilePath": "./Dockerfile"
}
```

### 6d. Dockerfile Oluştur

Proje kök dizininde `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# 1. Bağımlılıkları kur
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# 2. Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 6e. next.config.ts Güncelle

`next.config.ts`'e `output: "standalone"` ekle:

```typescript
const nextConfig = {
  output: "standalone",
  // ... mevcut ayarlar
};
```

### 6f. Deploy Et

```bash
cd /Users/efehanyildiz/CascadeProjects/geo-audit

# CapRover'a deploy
caprover deploy -a geo-audit
# "Deploy via upload" seç
# Otomatik tar.gz oluşturur ve yükler
```

Veya **Git Push ile otomatik deploy:**

```bash
# CapRover panelinde App → Deployment → "Method 3: Deploy from Github"
# Repo URL: https://github.com/efehanyildizworgoo/geo-audit
# Branch: main
# "Enable Automatic Deploy" aktif et
```

---

## 7. SSL + Custom Domain

### CapRover Panelinde:

1. App sayfası → **HTTP Settings**
2. **Enable HTTPS** tıkla (Let's Encrypt otomatik)
3. **Force HTTPS** aktif et
4. Custom domain eklemek için:
   - DNS'te `geo.worgoo.com → A Record → SUNUCU_IP`
   - CapRover'da **Connect New Domain** → `geo.worgoo.com`
   - SSL'i aktif et

---

## 8. CI/CD Pipeline (Otomatik Deploy)

### Yöntem 1: CapRover Webhook (Basit)

CapRover panelinde → App → Deployment:
- **Method 3** altında webhook URL'i al
- GitHub repo → Settings → Webhooks → URL'i yapıştır
- Her push'ta otomatik deploy

### Yöntem 2: GitHub Actions (Gelişmiş)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to CapRover

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to CapRover
        uses: caprover/deploy-from-github@v1.1.2
        with:
          server: https://captain.caprover.worgoo.com
          app: geo-audit
          token: ${{ secrets.CAPROVER_APP_TOKEN }}
```

GitHub repo → Settings → Secrets → `CAPROVER_APP_TOKEN` ekle
(CapRover panelinden App Token'ı al)

---

## Özet Mimari

```
                    ┌─────────────────────────────┐
                    │         Hetzner VPS          │
                    │       Ubuntu 22.04           │
                    │                              │
  İnternet ──────── │  Nginx (CapRover otomatik)   │
                    │    ├── :443 SSL (Let's Enc)  │
                    │    └── Reverse Proxy          │
                    │         │                    │
                    │    Docker Container           │
                    │    ├── geo-audit (Next.js)   │
                    │    ├── app-2 (gelecekte)     │
                    │    └── app-3 (gelecekte)     │
                    │                              │
                    │    CapRover Panel             │
                    │    captain.domain.com        │
                    └─────────────────────────────┘
```

---

## Faydalı Komutlar

```bash
# Sunucuya bağlan
ssh root@SUNUCU_IP

# Docker containerları listele
docker ps

# CapRover logları
docker logs captain-captain --tail 100

# Uygulama logları
docker logs $(docker ps -q --filter name=srv-captain--geo-audit) --tail 100

# Disk kullanımı
df -h

# RAM kullanımı
free -h

# Docker temizlik (eski image'ları sil)
docker system prune -af
```

---

## Maliyet

| Kalem | Aylık |
|-------|-------|
| Hetzner CX22 (4GB) | ~€4.35 |
| Domain (.com) | ~€1/ay (yıllık ~€12) |
| SSL | Ücretsiz (Let's Encrypt) |
| **Toplam** | **~€5.35/ay** |
