#!/bin/sh
set -e

# Everything the player creates belongs to its user alone (default UMASK 077),
# nobody else can read the settings, the Last.fm session or the cache
umask "${UMASK:-077}"

# Runs the player as PUID:PGID (like SUB/WAVE), so files in the mounted
# cache folder belong to the NAS user. Without them the node user is used.
if [ "$(id -u)" = "0" ]; then
  USER_ID="${PUID:-1000}"
  GROUP_ID="${PGID:-1000}"

  case "$USER_ID$GROUP_ID" in
    *[!0-9]*)
      echo "PUID/PGID must be numbers, got PUID='$USER_ID' PGID='$GROUP_ID'" >&2
      exit 1
      ;;
  esac

  CACHE_PATH="${CACHE_DIR:-/cache}"
  CONFIG_PATH="${CONFIG_DIR:-/config}"
  LOGS_PATH="${LOGS_DIR:-/logs}"

  mkdir -p "$CACHE_PATH" "$CONFIG_PATH" "$LOGS_PATH"
  chown -R "$USER_ID:$GROUP_ID" "$CACHE_PATH" "$CONFIG_PATH" "$LOGS_PATH" 2>/dev/null || true

  # files from earlier versions were readable for the group
  su-exec "$USER_ID:$GROUP_ID" chmod -R go-rwx "$CACHE_PATH" "$CONFIG_PATH" "$LOGS_PATH" 2>/dev/null || true

  exec su-exec "$USER_ID:$GROUP_ID" "$@"
fi

# Started with the user of the compose file (user: UID:GID)
chmod -R go-rwx "${CACHE_DIR:-/cache}" "${CONFIG_DIR:-/config}" "${LOGS_DIR:-/logs}" 2>/dev/null || true

exec "$@"
