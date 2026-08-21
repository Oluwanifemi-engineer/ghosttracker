# Secret Management and POC

This document explains a recommended pattern for moving secrets out of `.env` files and into a dedicated secret store. It includes a small proof-of-concept that integrates with HashiCorp Vault and a GitHub Actions pattern for provisioning secrets to CI.

## Goals

- Avoid long-lived secrets embedded in code or APKs
- Keep CI and production secrets separate
- Allow rotation and audit of secret access

## Recommended stack

- HashiCorp Vault (self-hosted or managed)
- GitHub Actions (secrets stored in repo/org secrets for CI access)
- Bind secrets to short-lived tokens or use GitHub OIDC to mint tokens

## Local POC (Vault)

1. Install Vault locally (dev mode for POC):

```bash
vault server -dev -dev-root-token-id="root"
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='root'
```

2. Write a secret for the server (example):

```bash
vault kv put secret/magneetar/server MT_API_KEY=supersecret MT_DEVICE_KEY=lowprivkey
```

3. Read secrets in a deployment script or entrypoint (example):

```bash
#!/usr/bin/env bash
set -euo pipefail
# Fetch secrets and render .env for local run (POC only — in prod mount as env)
vault kv get -format=json secret/magneetar/server | jq -r '.data.data | to_entries | .[] | "\(.key)=\(.value)"' > server/.env.vault
```

> Note: For production, use Vault policies, short-lived AppRole/OCI tokens, and avoid writing plaintext files to disk. Use a Vault agent sidecar or template mechanism instead.

## GitHub Actions CI pattern

- Use GitHub OIDC (recommended) to mint short-lived credentials from a cloud secret manager (e.g., GCP Secret Manager, AWS Secrets Manager) or Vault.
- If Vault is used, enable a role that accepts OIDC claims and issues short-lived tokens for CI runs.

Example: use `hashicorp/vault-action` to fetch secrets at workflow runtime instead of storing them in the repo.

## Next steps

- Decide on a secrets provider (Vault, AWS Secrets Manager, Azure Key Vault)
- Implement an environment-specific retrieval pattern (agent/sidecar, init container, or runtime fetch)
- Replace direct `.env` usage in `server/scripts/deploy.sh` with a secrets fetch step
