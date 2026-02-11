# Release Process

## Overview
The release pipeline builds versioned Docker images, generates an SBOM, publishes a changelog, and tags the release.

## Workflow
GitHub Actions workflow: `.github/workflows/release.yml`

Steps:
1. Generate changelog from conventional commits.
2. Generate SBOM (CycloneDX).
3. Build and push Docker images with tags:
   - `v<semver>`
   - `<git-sha>`
4. Tag the release in git.

## Trigger
Manual workflow dispatch with a semver version:
```
Version: 1.2.3
```

## Images
Pushed to `ghcr.io/<org>/<repo>`:
- `erp-api`
- `erp-admin`
- `erp-storefront`
- `erp-bot`

## SBOM
Saved as artifact `sbom/bom.json` per release.

## Conventional commits
Changelog uses the `angular` preset:
- `feat: ...`
- `fix: ...`
- `chore: ...`

## Notes
- Ensure Dockerfiles exist under each app.
- Release job requires `packages: write` and `contents: write` permissions.
- Update deploy configs to use the new semver tag.
