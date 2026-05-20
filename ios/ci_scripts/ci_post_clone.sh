#!/bin/sh
set -ex

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ENV_HINTS=1

# Initialize Homebrew (Intel: /usr/local, Apple Silicon: /opt/homebrew)
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"

# Install Node.js if not already available
if ! command -v node >/dev/null 2>&1; then
  brew install node
fi

node --version
npm --version

# Install JS dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install --no-repo-update
