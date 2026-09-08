#!/bin/zsh
# Запуск wrangler без настройки путей: сам находит node от Homebrew.
# Пример:  ./wrangler.sh login
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
exec ./node_modules/.bin/wrangler "$@"
