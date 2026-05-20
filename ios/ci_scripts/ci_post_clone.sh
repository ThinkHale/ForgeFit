#!/bin/sh
set -ex  # -x prints each command before running so failures are visible in logs

# Initialize Homebrew (Intel: /usr/local, Apple Silicon: /opt/homebrew)
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"

# Install Node.js (no-op if already installed)
brew install node || brew upgrade node || true

# Symlink into /usr/local/bin so xcodebuild phase scripts can find node/npm
sudo ln -sf "$(brew --prefix)/bin/node" /usr/local/bin/node
sudo ln -sf "$(brew --prefix)/bin/npm" /usr/local/bin/npm

node --version
npm --version

# Install JS dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
