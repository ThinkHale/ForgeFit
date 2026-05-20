#!/bin/sh
set -e

# Xcode Cloud runs on Apple Silicon — ensure Homebrew is on PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Install Node.js
brew install node

# Symlink node/npm into /usr/local/bin so xcodebuild phase scripts can find them
# (xcodebuild runs with a restricted PATH that doesn't include /opt/homebrew/bin)
ln -sf "$(which node)" /usr/local/bin/node || true
ln -sf "$(which npm)" /usr/local/bin/npm || true

# Install JS dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
