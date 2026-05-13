# Release Guide — PROJECT_NAME

> Walked step-by-step by `/flow:release`. Each `##` heading is a step; bash blocks are candidate commands (the slash command asks before running each). Edit this file to match how **your** project actually releases — the runbook is plain Markdown, no schema.

## Pre-flight

- [ ] On `main` with clean working tree (`git status` empty)
- [ ] Latest CI green on `main`
- [ ] At least one `.changeset/*.md` (or equivalent) since previous tag
- [ ] You have publish permissions for the package(s) being released

## Version bump

```bash
# CHANGELOG_PROVIDER_VERSION_CMD
```

## Tag & push

```bash
# CHANGELOG_PROVIDER_TAG_CMD
```

## Publish

```bash
# CHANGELOG_PROVIDER_PUBLISH_CMD
```

## Post-release

- [ ] Announce in #releases (Slack / Discord / etc.)
- [ ] Update tracker tickets to `released` status
- [ ] Bump dependent repos / docs site if applicable
- [ ] Verify the published artifact (e.g. `npm view <pkg> version`, smoke install in scratch dir)
