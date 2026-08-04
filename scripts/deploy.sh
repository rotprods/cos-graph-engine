#!/bin/bash
# Deploy script: build, start, and verify services

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_NAME="${PROJECT_NAME:-higgsfield-hardness}"
MAX_RETRIES="${MAX_RETRIES:-10}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"

echo "=== Building images ==="
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build

echo "=== Starting services ==="
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d

echo "=== Waiting for API health check ==="
for i in $(seq 1 "$MAX_RETRIES"); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "API is healthy (attempt $i)"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "API failed to become healthy after $MAX_RETRIES attempts"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs api
    exit 1
  fi
  echo "Waiting for API... (attempt $i/$MAX_RETRIES)"
  sleep "$RETRY_INTERVAL"
done

echo "=== Waiting for Dashboard health check ==="
for i in $(seq 1 "$MAX_RETRIES"); do
  if curl -sf http://localhost:8080/ > /dev/null 2>&1; then
    echo "Dashboard is healthy (attempt $i)"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "Dashboard failed to become healthy after $MAX_RETRIES attempts"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs dashboard
    exit 1
  fi
  echo "Waiting for Dashboard... (attempt $i/$MAX_RETRIES)"
  sleep "$RETRY_INTERVAL"
done

echo "=== Deployment complete ==="
echo "API:       http://localhost:3000"
echo "Dashboard: http://localhost:8080"
docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
