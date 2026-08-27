#!/usr/bin/env bash
set -euo pipefail

STAGING_SUPABASE_PROJECT_REF="${STAGING_SUPABASE_PROJECT_REF:-}"
STAGING_SUPABASE_URL="${STAGING_SUPABASE_URL:-}"
STAGING_FRONTEND_URL="${STAGING_FRONTEND_URL:-}"
PRODUCTION_PROJECT_REF="vavfeataqwwbpjonknne"
PRODUCTION_FRONTEND_URL="https://vowza.co.in"

if [[ -z "$STAGING_SUPABASE_PROJECT_REF" || -z "$STAGING_SUPABASE_URL" || -z "$STAGING_FRONTEND_URL" ]]; then
  echo "Staging project ref, Supabase URL, and frontend URL are required." >&2
  exit 2
fi

if [[ "$STAGING_SUPABASE_PROJECT_REF" == "$PRODUCTION_PROJECT_REF" || "$STAGING_SUPABASE_URL" == *"$PRODUCTION_PROJECT_REF.supabase.co" || "$STAGING_FRONTEND_URL" == "$PRODUCTION_FRONTEND_URL" ]]; then
  echo "Refusing release-candidate operation against the production target." >&2
  exit 3
fi

if [[ "$STAGING_SUPABASE_URL" != https://*.supabase.co ]]; then
  echo "Staging Supabase URL must be an HTTPS Supabase project URL." >&2
  exit 4
fi

if [[ "$STAGING_FRONTEND_URL" != https://* && "$STAGING_FRONTEND_URL" != http://localhost:* ]]; then
  echo "Staging frontend URL must be HTTPS or an explicit localhost test URL." >&2
  exit 5
fi

echo "Staging target accepted: project ref $STAGING_SUPABASE_PROJECT_REF"
