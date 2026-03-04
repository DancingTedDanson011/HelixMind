#!/bin/sh
set -e

echo "=== HelixMind Production Startup ==="

# 1. Run database migrations
echo "[1/3] Running database migrations..."
npx prisma migrate deploy
echo "      Migrations complete."

# 2. Validate required env vars
echo "[2/3] Validating environment..."
REQUIRED_VARS="DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL"
for var in $REQUIRED_VARS; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: Required environment variable $var is not set!"
    exit 1
  fi
done

# Warn about optional but important vars
if [ -z "$LLM_KEY_SECRET" ]; then
  echo "WARNING: LLM_KEY_SECRET not set — LLM key encryption will fail!"
fi
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "WARNING: STRIPE_SECRET_KEY not set — billing features disabled."
fi

echo "      Environment OK."

# 3. Start the server
echo "[3/3] Starting server..."
exec node --import tsx server.ts
