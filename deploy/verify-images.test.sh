#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -f -- "$tmp/gh" "$tmp/calls"; rmdir -- "$tmp"' EXIT

export calls="$tmp/calls"
export PATH="$tmp:$PATH"
printf -v revision '%040d' 1
printf -v web_digest '%064d' 2
printf -v api_digest '%064d' 3
export revision
web="ghcr.io/yianfri/routale@sha256:$web_digest"
api="ghcr.io/yianfri/routale-api@sha256:$api_digest"

cat > "$tmp/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$3" >> "$calls"
[[ $1 == attestation && $2 == verify &&
  $4 == --hostname && $5 == github.com &&
  $6 == --repo && $7 == Yianfri/routale &&
  $8 == --cert-identity && $9 == https://github.com/Yianfri/routale/.github/workflows/ci.yml@refs/heads/main &&
  ${10} == --source-ref && ${11} == refs/heads/main &&
  ${12} == --source-digest && ${13} == "$revision" &&
  ${14} == --deny-self-hosted-runners &&
  ${15} == --predicate-type && ${16} == https://slsa.dev/provenance/v1 ]]

image="${3#oci://}"
name="${image%@*}"
case "${MOCK_CASE:-ok}:$name" in
  failed:ghcr.io/yianfri/routale-api) exit 1 ;;
  swapped:ghcr.io/yianfri/routale-api) name='ghcr.io/yianfri/routale' ;;
esac
printf '%s\t%s\n' "$name" "${image##*@sha256:}"
MOCK
chmod 700 "$tmp/gh"

reject() {
  if bash "$script_dir/verify-images.sh" "$@" >/dev/null 2>&1; then
    echo 'La política aceptó una entrada que debía rechazar.' >&2
    exit 1
  fi
}

: > "$calls"
reject 'latest' "$web" "$api"
reject "$revision" 'ghcr.io/yianfri/routale:latest' "$api"
reject "$revision" "${web/yianfri/otro}" "$api"
reject "$revision" "$api" "$web"
[[ ! -s $calls ]]

bash "$script_dir/verify-images.sh" "$revision" "$web" "$api"
[[ $(cat -- "$calls") == "$(printf 'oci://%s\noci://%s' "$web" "$api")" ]]

MOCK_CASE=failed reject "$revision" "$web" "$api"
MOCK_CASE=swapped reject "$revision" "$web" "$api"
echo 'La política acepta el par esperado y rechaza referencias o atestaciones inválidas.'
