#!/bin/sh
set -e

# Initialize Homebrew (works for both Intel /usr/local and Apple Silicon /opt/homebrew)
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"

# Install Node.js
brew install node

# Symlink into /usr/local/bin so xcodebuild phase scripts can find node/npm
# (xcodebuild uses a restricted PATH; sudo required to write /usr/local/bin)
sudo ln -sf "$(brew --prefix)/bin/node" /usr/local/bin/node
sudo ln -sf "$(brew --prefix)/bin/npm" /usr/local/bin/npm

# Install JS dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
