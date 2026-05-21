#!/bin/sh
# Archive Forge, patch in the Hermes dSYM, and upload to App Store Connect.
set -e

WORKSPACE="$(dirname "$0")/Forge.xcworkspace"
ARCHIVE=/tmp/ForgeFit.xcarchive
EXPORT_PATH=/tmp/ForgeFitExport
EXPORT_PLIST=/tmp/ExportOptions.plist

cat > "$EXPORT_PLIST" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>MZ3635323W</string>
  <key>uploadBitcode</key><false/>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>upload</string>
</dict>
</plist>
EOF

echo "==> Archiving..."
rm -rf "$ARCHIVE"
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme Forge \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=MZ3635323W

echo "==> Patching Hermes dSYM..."
HERMES_BIN="$ARCHIVE/Products/Applications/Forge.app/Frameworks/hermes.framework/hermes"
xcrun dsymutil "$HERMES_BIN" -o "$ARCHIVE/dSYMs/hermes.framework.dSYM" 2>/dev/null || true

echo "==> Exporting and uploading..."
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST"

echo "==> Done. Build is processing in App Store Connect / TestFlight."
