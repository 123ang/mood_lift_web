# Deploy MoodLift to VPS (Nginx + PM2 + PostgreSQL)

This guide walks you through deploying the MoodLift app to a VPS on the subdomain **moodlift.suntzutechnologies.com**, using **Nginx** as reverse proxy, **PM2** for the Node.js process, and **PostgreSQL** as the database.

---

## Prerequisites

- A VPS with a Linux OS (Ubuntu 22.04 LTS recommended)
- SSH access to the server
- Domain **suntzutechnologies.com** pointing to your VPS (with a DNS A record for `moodlift.suntzutechnologies.com` or a CNAME to the main domain)

---

## 1. Connect to Your VPS

```bash
ssh your_user@your_vps_ip
```

---

## 2. Install Node.js (LTS)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v   # v20.x.x
npm -v
```

---

## 3. Install PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create database and user

```bash
sudo -u postgres psql
```

In the PostgreSQL prompt:

```sql
CREATE USER moodlift_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE moodlift OWNER moodlift_user;
GRANT ALL PRIVILEGES ON DATABASE moodlift TO moodlift_user;
\q
```

*(Use a strong password and store it securely.)*

---

## 4. Install Nginx and PM2

```bash
sudo apt install -y nginx
sudo npm install -g pm2
```

---

## 5. Deploy the Application

### 5.1 Clone the repository (or upload files)

**Option A – Git:**

```bash
mkdir -p /root/projects
cd /root/projects
git clone https://github.com/YOUR_USERNAME/mood_lift_web.git moodlift
cd moodlift
```

**Option B – Upload via SCP/SFTP:**  
Upload the project folder to `/root/projects/moodlift` (ensure `node_modules` and `.env` are not overwritten by a fresh `.env` on the server).

### 5.2 Install dependencies

```bash
cd /root/projects/moodlift
npm ci --omit=dev
```

*(Use `npm install --production` if you don’t have a lockfile.)*

### 5.3 Environment variables

```bash
cp .env.example .env
nano .env
```

Set **production** values, for example:

```env
# Server
PORT=3013
NODE_ENV=production

# PostgreSQL (same as created above)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=moodlift
DB_USER=moodlift_user
DB_PASSWORD=your_secure_password_here

# JWT – generate a strong random secret
JWT_SECRET=your_long_random_jwt_secret_min_32_chars
JWT_EXPIRES_IN=30d

# Admin account (change after first login)
ADMIN_EMAIL=admin@moodlift.com
ADMIN_PASSWORD=your_secure_admin_password
```

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.4 Initialize the database schema

```bash
npm run db:setup
```

### 5.5 Start the app with PM2

```bash
pm2 start server.js --name moodlift
pm2 save
pm2 startup
```

Follow the command `pm2 startup` prints (run the suggested `sudo env PATH=...` line) so the app starts on reboot.

**Optional – PM2 ecosystem file** (`ecosystem.config.cjs` in project root):

```javascript
module.exports = {
  apps: [{
    name: 'moodlift',
    script: 'server.js',
    cwd: '/root/projects/moodlift',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '300M',
  }],
};
```

Then:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs moodlift
pm2 restart moodlift
```

---

## 6. Configure Nginx for moodlift.suntzutechnologies.com

Create a site config for the subdomain:

```bash
sudo nano /etc/nginx/sites-available/moodlift.suntzutechnologies.com
```

Paste (replace subdomain if needed):

```nginx
server {
    listen 80;
    server_name moodlift.suntzutechnologies.com;

    location / {
        proxy_pass http://127.0.0.1:3013;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and test Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/moodlift.suntzutechnologies.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL with Let’s Encrypt (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d moodlift.suntzutechnologies.com
```

Follow prompts (email, agree to terms). Certbot will adjust the Nginx config for HTTPS. Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## 8. Firewall (optional but recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Ensure SSH (22) is allowed before enabling UFW so you don’t lock yourself out.

---

## 9. Post-deploy checks

1. **App and DB**
   - `pm2 status` – app “online”
   - `pm2 logs moodlift` – no DB or env errors
   - From server: `curl -I http://127.0.0.1:3013` – HTTP 200 or 304

2. **Public site**
   - Open **https://moodlift.suntzutechnologies.com** in a browser
   - Test login/signup and one API call (e.g. content or check-in)

3. **Admin**
   - Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` and change the password.

---

## 10. Updating the app later

```bash
cd /root/projects/moodlift
git pull
npm ci --omit=dev
npm run db:setup   # only if there are schema changes
pm2 restart moodlift
```

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| 502 Bad Gateway | App not running: `pm2 status`, `pm2 logs moodlift`. Port 3013 in use: `ss -tlnp \| grep 3013`. |
| DB connection errors | `.env` `DB_*` correct, PostgreSQL running: `sudo systemctl status postgresql`, user/password/DB name. |
| Nginx not loading subdomain | `server_name moodlift.suntzutechnologies.com` in the right file, site enabled, `sudo nginx -t`. |
| API/CORS issues | In production, ensure front-end uses `https://moodlift.suntzutechnologies.com`; adjust CORS in `server.js` if you add other origins. |

---

## Summary

- **App:** `/root/projects/moodlift`, run with PM2 as `moodlift` on port 3013.
- **Database:** PostgreSQL DB `moodlift`, user `moodlift_user`, schema via `npm run db:setup`.
- **Web:** Nginx reverse proxy for **moodlift.suntzutechnologies.com** → `http://127.0.0.1:3013`, with SSL via Certbot.

After DNS has propagated and the steps above are done, the site should be live at **https://moodlift.suntzutechnologies.com**.
