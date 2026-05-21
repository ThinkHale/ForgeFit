#!/bin/sh
set -ex

# Tell Xcode Cloud to use automatic signing with the paid team.
# Without this, CI defaults to ad-hoc signing (CODE_SIGN_IDENTITY=-)
# which is incompatible with HealthKit, push, and Sign in with Apple entitlements.
# Xcode Cloud sets CI=TRUE (uppercase) which breaks Expo CLI's getenv boolean parser.
# Override to lowercase so @expo/cli can read it correctly.
export CI=true

export CODE_SIGN_STYLE=Automatic
export DEVELOPMENT_TEAM=MZ3635323W
export CODE_SIGNING_REQUIRED=YES
export CODE_SIGNING_ALLOWED=YES
