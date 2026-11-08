#!/usr/bin/env bash
set -euo pipefail

readonly repo='Yianfri/routale'
readonly source_ref='refs/heads/main'
readonly workflow="https://github.com/$repo/.github/workflows/ci.yml@$source_ref"
readonly web='ghcr.io/yianfri/routale'
readonly api='ghcr.io/yianfri/routale-api'

if [[ $# -ne 3 ]]; then
  echo 'Uso: bash deploy/verify-images.sh COMMIT_SHA WEB_POR_DIGEST API_POR_DIGEST' >&2
  exit 2
fi

readonly revision="$1" web_ref="$2" api_ref="$3"
if [[ ! $revision =~ ^[0-9a-f]{40}$ ||
  ! $web_ref =~ ^"$web"@sha256:[0-9a-f]{64}$ ||
  ! $api_ref =~ ^"$api"@sha256:[0-9a-f]{64}$ ]]; then
  echo 'Se requieren el commit completo y los digests SHA-256 de la web y API oficiales, en ese orden.' >&2
  exit 2
fi

if ! command -v gh >/dev/null; then
  echo 'Se necesita GitHub CLI con el comando gh attestation verify.' >&2
  exit 1
fi

verify_image() {
  local reference="$1" subjects expected
  if ! subjects="$(gh attestation verify "oci://$reference" \
    --hostname github.com \
    --repo "$repo" \
    --cert-identity "$workflow" \
    --source-ref "$source_ref" \
    --source-digest "$revision" \
    --deny-self-hosted-runners \
    --predicate-type 'https://slsa.dev/provenance/v1' \
    --format json \
    --jq '.[].verificationResult.statement.subject[] | [.name, .digest.sha256] | @tsv')"; then
    printf 'No se pudo verificar la procedencia de %s.\n' "$reference" >&2
    return 1
  fi

  # Vincular el digest verificado al nombre firmado evita intercambiar web y API.
  printf -v expected '%s\t%s' "${reference%@*}" "${reference##*@sha256:}"
  if ! grep -Fxq -- "$expected" <<< "$subjects"; then
    printf 'La atestación no vincula el nombre y digest de %s.\n' "$reference" >&2
    return 1
  fi
}

verify_image "$web_ref"
verify_image "$api_ref"
printf 'Procedencia comprobada para ambas imágenes del commit %s.\n' "$revision"
