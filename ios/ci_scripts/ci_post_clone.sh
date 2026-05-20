#!/bin/sh
set -ex

# Suppress Homebrew auto-update (saves ~60s and avoids update errors)
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ENV_HINTS=1

# Initialize Homebrew
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"

# Use pre-installed Node if available; only brew-install as a fallback
if ! command -v node >/dev/null 2>&1; then
  brew install node
fi

# Symlink so xcodebuild phase scripts (restricted PATH) can find node/npm
sudo ln -sf "$(command -v node)" /usr/local/bin/node
sudo ln -sf "$(command -v npm)" /usr/local/bin/npm

node --version
npm --version

# Install JS dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
