#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="${1:-${AAP_DEMO_PODMAN_EXTENSION_IMAGE:-localhost/aap-demo-podman-extension:dev}}"
CONTAINERFILE="${SCRIPT_DIR}/Containerfile"

if ! command -v podman &>/dev/null; then
  printf 'ERROR: podman is required to build the Podman Desktop extension image\n' >&2
  printf 'Install Podman, then rerun: %s [image-name]\n' "$0" >&2
  exit 1
fi

if [ ! -f "$CONTAINERFILE" ]; then
  printf 'ERROR: Containerfile not found: %s\n' "$CONTAINERFILE" >&2
  exit 1
fi

echo "Building Podman Desktop extension image: ${IMAGE}"
podman build --file "$CONTAINERFILE" --tag "$IMAGE" "$SCRIPT_DIR"

echo "✓ Podman Desktop extension image built"
echo "  OCI image: ${IMAGE}"
echo ""
echo "For local source testing, use the supported local-folder workflow:"
echo "  1. Run: npm run dev:local"
echo "  2. Open Extensions → Local Extensions"
echo "  3. Select Add a local folder extension..."
echo "  4. Select: ${SCRIPT_DIR}"
echo ""
echo "Use Extensions → Install custom... only with an image pushed to a"
echo "reachable registry. A localhost image may be unavailable to Podman"
echo "Desktop's active engine and then be treated as a registry reference."
