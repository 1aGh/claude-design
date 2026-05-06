---
name: ui-kit
description: Reference UI prototypes for every Dugmate surface — desktop (Rail, TopBar, VideoPlayer, PlaybookEditor, Chat, LiveControlRoom, TeamHub, Calendar, ScoutInbox, ScoutDiscovery, SocialFeed/Explore/DM/Profile, PublicProfile, TapeLibrary, WatchParty, HighlightComposer, Surfaces) and mobile (Home, TeamHub, Playbook, FilmRoom, Chrome). Auto-load when designing or implementing any Dugmate screen. Content lives in .ai/design/ui/ — this skill is a pointer.
---

# Dugmate UI kit — pointer skill

This skill is a **thin pointer**. The actual UI-kit content lives at:

```
.ai/design/ui/
```

This skill is non-user-invocable. Auto-loads when Claude is doing UI work for any of the surfaces below. The user-facing entry point is the `design` orchestrator skill.

## What's where

| Path (from repo root) | Contents |
|---|---|
| `.ai/design/ui/project/Dugmate Studio.html` | Desktop composer — mounts the full Studio app |
| `.ai/design/ui/project/Dugmate Mobile.html` | Mobile composer — mounts the iOS-frame mobile app |
| `.ai/design/ui/project/Calendar Screen.html` | Standalone calendar surface |
| `.ai/design/ui/project/design-canvas.jsx` | Canvas wrapper + section layout |
| `.ai/design/ui/project/tweaks-panel.jsx` | The Claude-Design-style tweaks panel (slider patterns) |
| `.ai/design/ui/project/.design-canvas.state.json` | Canvas section labels (provenance for which screen serves which goal) |
| `.ai/design/ui/project/components/*.jsx` | 20 desktop components (manifest below) |
| `.ai/design/ui/project/components/mobile/*.jsx` | 5 mobile components (Home, TeamHub, Playbook, FilmRoom, Chrome) |
| `.ai/design/ui/project/ds/colors_and_type.css` | Local copy of design tokens (kept in sync with `.ai/design/system/project/colors_and_type.css`) |
| `.ai/design/ui/project/uploads/dugmate-prd.md` | Snapshot of PRD as it was when these screens were designed |
| `.ai/design/ui/project/screenshots/` | (empty — placeholder) |
| `.ai/design/ui/chats/chat1…chat9.md` | Iteration history per surface — **read first** if touching that surface |
| `.ai/design/ui/_HANDOFF-BUNDLE-README.md` | Original Claude Design handoff metadata |

## Component → chat transcript map

When iterating a surface, the matching chat transcript is the source of truth for "what the user actually wanted". Always read it before regenerating.

| Surface | Chat transcript | Topic |
|---|---|---|
| TeamHub, Studio, Rail, TopBar | `.ai/design/ui/chats/chat1.md` | Football Command Center (foundation) |
| Comments | `.ai/design/ui/chats/chat2.md`, `chat5.md`, `chat6.md` | Comment UI evolution |
| WatchParty | `.ai/design/ui/chats/chat3.md` | Watch Party screen |
| Calendar | `.ai/design/ui/chats/chat4.md` | Calendar with events |
| Scout (Marketplace, Inbox, Discovery, Social*) | `.ai/design/ui/chats/chat7.md` | Scout marketplace + social layer |
| TeamHub admin | `.ai/design/ui/chats/chat8.md` | Správa klubu |
| Mobile (all) | `.ai/design/ui/chats/chat9.md` | Mobilní aplikace návrh |

## Desktop component manifest (`.ai/design/ui/project/components/`)

`Calendar.jsx · Chat.jsx · HighlightComposer.jsx · LiveControlRoom.jsx · PlaybookEditor.jsx · PublicProfile.jsx · Rail.jsx · ScoutDiscovery.jsx · ScoutInbox.jsx · SocialDM.jsx · SocialExplore.jsx · SocialFeed.jsx · SocialProfile.jsx · Surfaces.jsx · TapeLibrary.jsx · TeamHub.jsx · TopBar.jsx · VideoPlayer.jsx · WatchParty.jsx · ios-frame.jsx`

## Mobile component manifest (`.ai/design/ui/project/components/mobile/`)

`MobileHome.jsx · MobileTeamHub.jsx · MobilePlaybook.jsx · MobileFilmRoom.jsx · MobileChrome.jsx`

## How the orchestrator uses this skill

When `design` is asked to start a session for a known surface (e.g. `TeamHub mobile`), it:
1. Resolves surface → component file (`.ai/design/ui/project/components/mobile/MobileTeamHub.jsx`)
2. Resolves surface → chat transcript (`.ai/design/ui/chats/chat9.md` — all-mobile chat)
3. Reads both, plus tokens from `.ai/design/system/project/colors_and_type.css`
4. Hands the union to `frontend-design` as the aesthetic+layout brief
5. Diffs the regeneration against the original to flag intentional vs. accidental drift

For unknown / new surfaces, the orchestrator skips the component-mapping step but still loads tokens + layout idioms from one similar reference (`Surfaces.jsx` is a good starter).

## Migration provenance

- Source: `.ai/design-import/ui/dugmate-ui/` (gitignored Claude Design export, May 5 2026)
- All `project/` and `chats/` content preserved byte-exact
- Outer Claude-Design handoff README preserved as `.ai/design/ui/_HANDOFF-BUNDLE-README.md`
- This `SKILL.md` is the pointer for Claude Code's skill discovery
