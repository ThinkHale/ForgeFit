#!/bin/sh
set -e

# Xcode Cloud runs on Apple Silicon — ensure Homebrew binaries are on PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Install Node.js
brew install node

# Install npm dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

# Install CocoaPods (pre-installed on Xcode Cloud but pin the gem just in case)
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
