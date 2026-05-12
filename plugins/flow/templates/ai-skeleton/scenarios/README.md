# Scenarios

Cross-platform UI scenarios. One folder per scenario; per-run reports inside.

## Layout

```
scenarios/
├── _lib/                       — shared helpers (selectors, fixtures, env)
└── <scenario-slug>/
    ├── spec.md                 — what the flow does, success criteria, platform matrix
    └── <YYYY-MM-DD-HHMM>/
        ├── report.md           — TL;DR + per-platform pivot table + counter deltas
        ├── web-desktop/        — screenshots, logs
        ├── web-mobile/
        ├── ios-phone/
        └── android-phone/
```

## Conventions

- **Scenario slug:** kebab-case, action-oriented (`coach-creates-recurring-practice`, `signup-via-invite`).
- **Run timestamp:** local time of the run start. Latest run = lexicographically last folder.
- **Report format:** owned by the `scenario` skill — see plugin docs.

Run with `/flow:scenario <slug>` (registered scenarios) or `/flow:scenario <ad-hoc description>` (one-off).
