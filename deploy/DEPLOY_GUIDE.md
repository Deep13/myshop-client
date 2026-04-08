# Deploying MyShop to Hostinger

## Prerequisites
- Hostinger Premium or Business hosting plan (PHP + MySQL)
- Domain pointed to Hostinger nameservers
- Access to hPanel

---

## Step 1: Create MySQL Database on Hostinger

1. Login to **hPanel** → **Databases** → **MySQL Databases**
2. Create a new database:
   - Database name: `myshop` (will become `u12345678_myshop`)
   - Username: create a new user (e.g., `myshop_admin`)
   - Password: set a strong password
3. Note down:
   - **DB Host**: `localhost` (default on Hostinger)
   - **DB Name**: `u12345678_myshop`
   - **DB User**: `u12345678_myshop_admin`
   - **DB Password**: your password

## Step 2: Import Database

1. Go to **hPanel** → **Databases** → **phpMyAdmin**
2. Select your database
3. Click **Import** tab
4. Upload `deploy/full_dump.sql` (contains schema + data)
5. Click **Go**

OR via SSH (if available):
```bash
mysql -u u12345678_myshop_admin -p u12345678_myshop < full_dump.sql
```

---

## Step 3: Upload Backend (PHP API)

### Option A: File Manager
1. Go to **hPanel** → **File Manager**
2. Navigate to `public_html/`
3. Create folder `api/`
4. Upload ALL files from `C:\xampp\htdocs\myshop-backend\` into `public_html/api/`
5. Also upload the `uploads/` folder (create it empty if no bills uploaded yet)

### Option B: FTP
1. Use FileZilla or any FTP client
2. Connect with your Hostinger FTP credentials (from hPanel → FTP Accounts)
3. Upload `myshop-backend/*` → `public_html/api/`

### Update Backend Config
Edit `public_html/api/config.php` on Hostinger:
```php
// Comment out local dev settings and uncomment production:
define('DB_HOST', 'localhost');
define('DB_USER', 'u12345678_myshop_admin');  // your actual username
define('DB_PASS', 'YourSecurePassword');       // your actual password
define('DB_NAME', 'u12345678_myshop');         // your actual db name
define('ALLOWED_ORIGIN', 'https://yourdomain.com');
```

### Create uploads directory
Make sure `public_html/api/uploads/bills/` exists and is writable:
```
public_html/api/uploads/bills/   (chmod 755)
```

---

## Step 4: Build & Upload Frontend

### Update API URL
Edit `.env.production` before building:
```
VITE_API_URL=https://yourdomain.com/api
```

### Build
```bash
npm run build
```

### Upload
1. Upload ALL contents of `dist/` folder to `public_html/`
   - `index.html`
   - `assets/` folder
2. Upload `deploy/.htaccess` to `public_html/.htaccess`
   - This is CRITICAL for SPA routing to work

### Final structure on Hostinger:
```
public_html/
├── index.html            ← React app entry
├── .htaccess             ← SPA routing rules
├── assets/
│   ├── index-xxxxx.js
│   ├── index-xxxxx.css
│   ├── store-xxxxx.png
│   └── jszip.min-xxxxx.js
└── api/                  ← PHP backend
    ├── .htaccess
    ├── config.php
    ├── db.php
    ├── login.php
    ├── save_invoice.php
    ├── ... (all other .php files)
    └── uploads/
        └── bills/
```

---

## Step 5: Test

1. Visit `https://yourdomain.com` — should see login page
2. Login with your admin credentials
3. Test:
   - Dashboard loads data
   - Creating a sale works
   - Mobile view at `https://yourdomain.com/m/sale`
   - Purchase upload works

---

## Step 6: SSL (HTTPS)

1. Go to **hPanel** → **SSL**
2. Enable free SSL (Let's Encrypt)
3. Force HTTPS redirect in `.htaccess` (add at the top):
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

---

## Troubleshooting

### API calls return 404
- Check that `api/` folder exists in `public_html/`
- Verify PHP files are uploaded correctly
- Test: `https://yourdomain.com/api/login.php` should return JSON

### CORS errors
- Edit `api/.htaccess` — change `*` to your actual domain
- Or edit each PHP file's `Access-Control-Allow-Origin` header

### SPA routes show 404 (e.g., /sales, /m/sale)
- Make sure `.htaccess` is in `public_html/` root
- Check that `mod_rewrite` is enabled (Hostinger has it by default)

### Database connection fails
- Double-check credentials in `api/config.php`
- Hostinger DB host is usually `localhost`
- DB name includes your account prefix (e.g., `u12345678_myshop`)

### Large file uploads fail
- Hostinger default PHP limits may be low
- Edit `.htaccess` in api/ folder or use `php.ini`:
  ```
  upload_max_filesize = 10M
  post_max_size = 12M
  ```

### pdftotext not available (PDF bill parsing)
- Hostinger shared hosting may not have `pdftotext`
- PDF upload will still work for Excel/CSV
- For PDF parsing, consider Hostinger VPS instead
