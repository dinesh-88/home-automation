#!/bin/sh
set -e

echo "Waiting for database and applying migrations..."
npx prisma migrate deploy

echo "Seeding admin user (idempotent upsert)..."
npx prisma db seed

echo "Starting Next.js..."
exec npm run start
