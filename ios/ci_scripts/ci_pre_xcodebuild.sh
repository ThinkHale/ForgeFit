#!/bin/sh
set -ex

# Tell Xcode Cloud to use automatic signing with the paid team.
# Without this, CI defaults to ad-hoc signing (CODE_SIGN_IDENTITY=-)
# which is incompatible with HealthKit, push, and Sign in with Apple entitlements.
export CODE_SIGN_STYLE=Automatic
export DEVELOPMENT_TEAM=MZ3635323W
export CODE_SIGNING_REQUIRED=YES
export CODE_SIGNING_ALLOWED=YES
