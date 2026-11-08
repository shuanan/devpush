# Changelog

## [Unreleased]

### Added

- Add a deny-only deploy-admission stub. It always returns admit false and ignores its argument. Push, dashboard, API, and rollback paths do not call it, so a push still queues the pushed SHA.
- Record whether a CI run checked out the selected commit and whether every job selected by the change plan succeeded. A pull request run is not land evidence. The Prism entry contract is a proposal and does not deploy.
- A manual CI dispatch with no comparison base still runs the application test jobs. Pull request and push plans are unchanged.
- Each deploy-admission denial is a new frozen object, so changing one result cannot make a later call admit.

## [1.1.0] - 2026-11-02

### Added

- Add `npx devpush@latest init` to create, configure and deploy standalone Docker Compose or Cloudflare installations using the npm package, without a source checkout. Generated projects retain the repository’s dependency overrides for npm installs, including matching serializer and stream-plugin versions.

## [1.0.3] - 2026-10-30

### Changed

- Return idle agent job checks immediately; agents poll every ten seconds with jitter and back off after errors. Upgrade agents with the dashboard to avoid increased polling from older agents.
- Add a database migration for indexed backup scheduling; existing applied migrations are unchanged.
- Schedule backups through an indexed, bounded due-policy scan. Existing policies initialize on their next scheduler pass; overdue policies run once rather than replaying missed intervals.
- Remove redundant runtime-log expiry cleanup during ingestion; hourly maintenance handles expiry.
- Repair project notification observations every five minutes while retaining immediate delivery and minute retries.

## [1.0.2] - 2026-10-30

### Changed

- Reduced agent polling and unchanged runtime reconciliation work, avoided unnecessary heartbeat metadata writes, and deferred scheduler imports until needed. Server alert checks now use the minute scheduler.
- Simplified package installation examples and removed outdated pre-release setup guidance.

### Fixed

- Added a static favicon for browsers requesting `/favicon.ico` and fixed static asset delivery when installed from npm on Node.

## [1.0.0] - 2026-10-29

A complete rewrite of devpush. This release replaces the previous architecture and requires a fresh installation.

### Added

- Docker Compose deployments from GitHub, with environments, preview URLs, custom domains and HTTPS.
- Backups and restores, logs, server monitoring and notifications.
- Teams, scoped API keys and MCP access.
- Self-hosting on Node.js or Cloudflare Workers.
