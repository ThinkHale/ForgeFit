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
npm install
echo "✓ Node dependencies installed"
echo ""

# 2. CocoaPods
if ! command -v pod &>/dev/null; then
  echo "⚠  CocoaPods not found. Install with:"
  echo "   sudo gem install cocoapods"
  echo "   then re-run ./setup.sh"
  exit 1
fi

echo "▶ Installing CocoaPods dependencies..."
cd ios && pod install && cd ..
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
