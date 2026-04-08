#!/bin/bash
# Deploy myshop to Hostinger (gangashop.in)
# Usage: bash deploy/deploy.sh

set -e

SSH_KEY="$HOME/.ssh/hostinger_key"
HOST="u506999529@89.117.27.25"
PORT=65002
SSH="ssh -o StrictHostKeyChecking=no -i $SSH_KEY -p $PORT $HOST"
WEBROOT="$HOST:~/domains/gangashop.in/public_html/"
API="$HOST:~/domains/gangashop.in/public_html/api/"
SCP="scp -o StrictHostKeyChecking=no -i $SSH_KEY -P $PORT"

echo "=== Building frontend ==="
npx vite build --mode production

echo "=== Uploading frontend ==="
$SCP dist/index.html "$WEBROOT"
scp -o StrictHostKeyChecking=no -i $SSH_KEY -P $PORT -r dist/assets "$WEBROOT"
$SCP deploy/.htaccess "$WEBROOT"

echo "=== Uploading backend (excluding config.php) ==="
for f in /c/xampp/htdocs/myshop-backend/*.php; do
  fname=$(basename "$f")
  if [ "$fname" != "config.php" ]; then
    $SCP "$f" "$API"
  fi
done
$SCP /c/xampp/htdocs/myshop-backend/.htaccess "$API"

echo "=== Restoring production config ==="
$SSH "cat > ~/domains/gangashop.in/public_html/api/config.php << 'PHPEOF'
<?php
define('DB_HOST', '127.0.0.1');
define('DB_USER', 'u506999529_deepkr');
define('DB_PASS', 'Rockon_deep45');
define('DB_NAME', 'u506999529_myshop');
define('ALLOWED_ORIGIN', '*');
PHPEOF"

echo "=== Done! ==="
echo "Live at: https://gangashop.in"
