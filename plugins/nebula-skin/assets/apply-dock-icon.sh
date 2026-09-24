#!/bin/sh
# Reapply the Nebula mascot as the Hermes.app dock icon (custom icons reset on app update).
ICON="$HOME/.hermes/desktop-plugins/nebula-skin/assets/dock-icon.icns"
APP="${1:-/Applications/Hermes.app}"
osascript -l JavaScript -e "ObjC.import(\"AppKit\"); const img=\$.NSImage.alloc.initWithContentsOfFile(\"$ICON\"); const ok=\$.NSWorkspace.sharedWorkspace.setIconForFileOptions(img,\"$APP\",0); ok ? \"applied\" : \"failed\""
touch "$APP"; killall Finder 2>/dev/null; killall Dock 2>/dev/null
