#!/bin/bash
pkill -f "metro" 2>/dev/null || true
mkdir -p "$HOME/.expo"
echo '{}' > "$HOME/.expo/state.json"
sleep 1
