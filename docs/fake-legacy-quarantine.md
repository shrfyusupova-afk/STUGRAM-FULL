# Fake Legacy Quarantine (Phase 1)

Date: 2026-05-16

## Inventory
| File | Marker | Current risk | Decision | Action | Guard/Test | Status |
|---|---|---|---|---|---|---|
| `ui/home/SearchScreen.kt` | fake recommended/trending + demo URLs + dead follow actions | High | REMOVE_NOW | Replaced runtime file with alpha-safe disabled/empty search surface only | `AlphaFeatureFlags.SEARCH_DISCOVERY_ENABLED=false`; Android unit test suite pass | DONE |
| `ui/home/ReelsComponents.kt` | fake reels list + local counters + demo URLs | High | REMOVE_NOW | Replaced runtime file with disabled reels screen only | `AlphaFeatureFlags.REELS_ENABLED=false`; nav guard in `HomeScreen` | DONE |
| `ui/home/StoryComponents.kt` | fake story viewer/media paths | High | REMOVE_NOW | Replaced runtime with disabled story viewer modal shell | `AlphaFeatureFlags.STORIES_ENABLED=false`; `HomeScreen` guard | DONE |
| `ui/home/ProfileScreen.kt` | old hardcoded profile state + fake moments + fake tab grids | High | REMOVE_NOW | Removed legacy runtime branch; kept backend-backed profile + real empty states | `ProfileViewModel` state only; compile/test pass | DONE |
| `ui/home/MessagesScreen.kt` | fake chats/groups/notes/requests branch | High | REMOVE_NOW | Removed legacy runtime branch; kept backend conversations + real requests actions | `MessagesViewModel` state only; group remains disabled | DONE |
| `ui/home/CallScreens.kt` | marker hit from scan comments | Low | KEEP_DOC_ONLY | Not part of alpha-visible critical scope in this phase | Deferred to later audit round | OPEN |
| `ui/home/ChatSettingsScreen.kt` | marker hit from scan comments | Low | KEEP_DOC_ONLY | Not part of fake data leak risk in current alpha path | Deferred | OPEN |
| `ui/home/HomeCommonComponents.kt` | marker hits in static text/comments | Low | KEEP_DOC_ONLY | No fake dataset leak identified in inspected paths | Deferred | OPEN |

## Remaining Fake/Demo Policy
- Runtime fake branches for the 5 highest-risk files above have been removed from active code paths.
- If any future sample data is needed, it must be isolated under preview-only policy and never imported by runtime ViewModel/Repository/Nav.

## Verification Notes
- Android unit tests, Kotlin compile, and assemble were executed after cleanup and passed.
- Backend regression command failed in this run because in-memory Mongo test server timed out during startup (`MongoMemoryServer` timeout at 10s). This is an environment/test-runtime issue, not caused by Android fake-path cleanup.
