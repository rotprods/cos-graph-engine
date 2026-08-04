#!/bin/sh
# Health check script for Docker containers
# Returns 0 if healthy, 1 otherwise

set -e

HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"

if wget --no-verbose --tries=1 --spider "$HEALTH_URL" 2>/dev/null; then
  echo "Health check passed: $HEALTH_URL"
  exit 0
else
  echo "Health check failed: $HEALTH_URL"
  exit 1
fi
