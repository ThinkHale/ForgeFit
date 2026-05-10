#!/usr/bin/env bash
# One-command setup after cloning ForgeFit
# Run: ./setup.sh
# Then open ios/Forge.xcworkspace in Xcode

set -euo pipefail

echo ""
echo "=== ForgeFit iOS Setup ==="
echo ""

# 1. Node dependencies
echo "▶ Installing Node dependencies..."
npm install --legacy-peer-deps
echo "✓ Node dependencies installed"
echo ""

# 2. Locate pod — check PATH first, then common Homebrew gem bin locations
POD_CMD=""
if command -v pod &>/dev/null; then
  POD_CMD="pod"
else
  for ruby_bin in \
    "$HOME/.gem/ruby/*/bin" \
    "/opt/homebrew/lib/ruby/gems/*/bin" \
    "/usr/local/lib/ruby/gems/*/bin" \
    "$(gem environment gemdir 2>/dev/null)/bin"
  do
    # expand globs
    for candidate in $ruby_bin/pod; do
      if [ -x "$candidate" ]; then
        POD_CMD="$candidate"
        break 2
      fi
    done
  done
fi

if [ -z "$POD_CMD" ]; then
  echo "⚠  CocoaPods not found. Run:"
  echo "   gem install cocoapods"
  echo "Then re-run ./setup.sh"
  exit 1
fi

echo "▶ Installing CocoaPods dependencies (using $POD_CMD)..."
cd ios && "$POD_CMD" install && cd ..
echo "✓ CocoaPods installed"
echo ""

# 3. Environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠  Created .env from .env.example"
  echo "   Edit .env with your Supabase + Anthropic keys before running the app."
  echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in .env with your API keys (if you haven't already)"
echo "  2. open ios/Forge.xcworkspace"
echo "  3. Select your device/simulator and hit ▶ in Xcode"
echo ""
