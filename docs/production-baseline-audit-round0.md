# StuGram Production Baseline Audit (Phase 0)

Date: 2026-05-15  
Scope: Android app + Node.js backend  
Goal: establish exact real/fake/hidden/blocked production baseline before enabling disabled features.

## Summary
- Current state is **alpha-hardened**, not production-ready.
- Core auth/profile/direct-messages/requests paths are real and tested.
- Several social features are backend-capable but Android-visible flow is still disabled/guarded.
- Legacy fake UI code still exists in unreachable branches and is a production risk if route guards regress.

## Feature Map
| Feature | Backend exists | Android wired | Real data | Fake present | Tests | Status | Risk | Next fix |
|---|---|---|---|---|---|---|---|---|
| Register/Login/Refresh/Logout | Yes (`authRoutes`) | Yes | Yes | No visible fake path | Backend auth tests + Android auth/session tests | ALPHA_READY | Medium | Phase 2 hardening (401 storm + token/security log audit final pass) |
| Profile read (`/profiles/me`) | Yes | Yes | Yes | Legacy fake profile branch exists (unreachable) | Backend profile tests + Android VM tests | ALPHA_READY | Medium | Remove/quarantine legacy profile branch |
| Edit profile (`PATCH /profiles/me`) | Yes | Yes | Yes | Legacy local-only edit flow exists in unreachable branch | Backend profile tests | ALPHA_READY | Medium | Remove legacy local-save branch, keep backend-only flow |
| Direct messages list + chat | Yes (`chatRoutes`) | Yes | Yes | No fake in alpha path | Backend chat tests + Android sync tests | REAL_BUT_NEEDS_TESTS | Medium | Execute manual 2-user reconnect/race matrix |
| Requests (Add to Chat / Block / Delete) | Yes (`requestRoutes`) | Yes | Yes | No fake in alpha path | Backend requests tests + Android VM tests | ALPHA_READY | Low | Add reconnect/session edge-case tests |
| Group chat | Yes (`groupChatRoutes`) | Guarded/hidden | Not enabled for users | Legacy fake group screen/components exist | Backend group-chat tests exist in suite | HIDDEN | High | Phase 9 production wiring + remove fake group UI branches |
| Follow/Unfollow | Yes (`followRoutes`) | Partial in current alpha UI | Partial | Potential hidden/legacy placeholders | Partial tests | PARTIAL | Medium | Phase 3 full Android wiring + tests |
| Search users/posts | Yes (`searchRoutes`) | Disabled alpha surface | Not enabled | Fake search discovery content exists in unreachable branch | Minimal | FAKE_GUARDED | High | Phase 1 quarantine + Phase 3 backend-wired search UI |
| Feed read/posts list | Yes (`postRoutes`) | Basic read/empty in alpha flow | Partial | Legacy fake interactions in old components | Partial | PARTIAL | High | Phase 4 full feed/post wiring |
| Create post | Yes (`postRoutes` + upload middleware) | Disabled in alpha | Not enabled | Camera/create was simulation earlier; now disabled screen | Minimal | HIDDEN | High | Phase 4 + Phase 10 media reliability |
| Likes (post) | Yes (`likeRoutes`) | Disabled in alpha | Not enabled | Legacy local-like behavior exists in legacy components | Minimal | HIDDEN | High | Phase 5 backend-backed like wiring |
| Comments (post) | Yes (`commentRoutes`) | Disabled in alpha | Not enabled | Legacy bottom-sheet/demo comment surfaces exist in old components | Minimal | HIDDEN | High | Phase 5 backend-backed comments wiring |
| Stories | Yes (`storyRoutes`) | Disabled/empty-only in alpha | Not enabled | Legacy fake story components exist | Minimal | FAKE_GUARDED | High | Phase 1 quarantine + Phase 6 full story system |
| Reels | Backend support partially present via posts/group features; dedicated route flow not fully verified | Disabled in alpha | Not enabled | `ReelsComponents.kt` fake dataset with demo media URLs exists | Minimal | FAKE_GUARDED | High | Phase 1 quarantine + Phase 7 real reels pipeline |
| Notifications | Yes (`notificationRoutes`) | Not clearly wired in alpha UI | Unknown | No visible fake in alpha path | Unknown | PARTIAL | Medium | Phase 11: either real-wire or hide fully |
| Settings | Yes (`settingsRoutes`) | Minimal alpha-safe logout-only UI | Partial | Legacy static settings catalog removed from visible path | Minimal | ALPHA_READY | Low | Phase 12: privacy/notification/block settings real wiring |
| Security controls | Yes (auth middleware, validators, rate-limit primitives) | Partial | Partial | Mock OTP provider exists in non-prod mode | Backend auth tests | REAL_BUT_NEEDS_TESTS | Medium | Phase 14 hardening + secrets/log audit |
| Observability/requestId | Yes (request correlation middleware/docs/tests) | Partial client correlation | Partial | None critical | Backend tests + docs | ALPHA_READY | Low | Phase 16 dashboard/alert completion |

## Fake/Legacy Paths Identified
These are currently guarded/unreachable in alpha flow, but still present in source:
- `D:\android app\app\src\main\java\com\example\myapplication\ui\home\SearchScreen.kt`
  - unreachable legacy branch contains fake recommended/trending loops, demo URLs, dead follow clicks.
- `D:\android app\app\src\main\java\com\example\myapplication\ui\home\ReelsComponents.kt`
  - fake reel datasets, local-only interaction counters, demo image sources.
- `D:\android app\app\src\main\java\com\example\myapplication\ui\home\StoryComponents.kt`
  - legacy fake story UI remains.
- `D:\android app\app\src\main\java\com\example\myapplication\ui\home\ProfileScreen.kt`
  - legacy local profile/edit data branch remains under early-return guard.
- `D:\android app\app\src\main\java\com\example\myapplication\ui\home\MessagesScreen.kt`
  - legacy static chats/groups/notes/requests branch remains under early-return guard.

## Disabled Features (Current Alpha)
- group chat
- reels
- stories viewer/create
- camera/create
- feed likes/comments/share interactions
- advanced search discovery
- advanced settings

## Production Blockers
1. Legacy fake code still present in runtime modules (guarded, but not removed/quarantined).
2. Core social loop (post/create/like/comment/share/story/reel) is not backend-wired end-to-end in Android flow.
3. Group chat is disabled; production target requires real group reliability.
4. Manual reconnect/race direct-chat matrix still incomplete for production claim.
5. 60–120 min backend stability/load evidence still pending.

## Next Execution Order (Strict)
1. **Phase 1**: quarantine/remove guarded fake branches from runtime modules.
2. **Phase 3**: complete profile/follow/search real wiring.
3. **Phase 4/5**: post feed + like/comment/share backend integration.
4. **Phase 6/7**: stories + reels production paths (or keep hidden until fully real).
5. **Phase 9/10/13**: group chat + upload reliability + long stability/load test.

## Baseline Verdict
- Current launch level: **20 USERS ONLY** (controlled alpha).
- For normal production social UX, app is **NOT READY**.

## Phase 1 Progress Note (2026-05-16)
- High-risk legacy fake runtime branches identified in this baseline have been removed/quarantined in:
  - `SearchScreen.kt`
  - `ReelsComponents.kt`
  - `StoryComponents.kt`
  - `ProfileScreen.kt`
  - `MessagesScreen.kt`
- Detailed change log and risk classification moved to:
  - `D:\android app\docs\fake-legacy-quarantine.md`

## Phase 3 Progress Note (2026-05-16)
- Search moved from disabled-only to real backend user search wiring.
- Other-user profile open flow is now wired through username route.
- Follow/unfollow actions are wired from profile and search surfaces.
- Remaining production blocker: feed/posts/likes/comments/stories/reels are still not fully real-wired.

## Phase 4 Progress Note (2026-05-16)
- Feed/Post moved from partial to backend-backed runtime flow for alpha-safe scope.
- Text-only post creation is enabled via real backend create endpoint.
- Profile posts tab now reads real post data.
- Remaining interaction scope (likes/comments/share) stays Phase 5 and remains disabled/passive.
