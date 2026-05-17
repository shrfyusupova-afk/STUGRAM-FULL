# School Alpha Visibility Policy

## Scope (Round 6)
For school alpha users, visible surfaces must be real backend-backed, real empty state, or safely hidden/disabled.

## Phase 1 Update (2026-05-16)
- Legacy fake runtime branches were removed from:
  - `SearchScreen.kt`
  - `ReelsComponents.kt`
  - `StoryComponents.kt`
  - `ProfileScreen.kt`
  - `MessagesScreen.kt`
- These files now expose only backend-backed flows or safe disabled/empty states in runtime.
- Quarantine register: `D:\android app\docs\fake-legacy-quarantine.md`.

## Current Alpha Visibility Decisions

### Profile
- Visible: backend-backed profile identity from `GET /api/v1/profiles/me`.
- Visible tabs: Posts/Reels/Tagged as real empty states when no data.
- Hidden: fake profile cards, fake moments, fake demo grids.
- Edit Profile: visible and backend-persistent via `PATCH /api/v1/profiles/me`.

### Messages
- Visible: backend-backed direct conversations from `GET /api/v1/chats/conversations`.
- Visible search: filters only loaded real conversation rows.
- Empty state: `No chats yet`.
- Hidden: fake notes, fake groups, fake requests.

### Requests
- Status: visible and backend-backed.
- Endpoints:
  - `GET /api/v1/requests`
  - `POST /api/v1/requests/:requestId/add-to-chat`
  - `POST /api/v1/requests/:requestId/block`
  - `DELETE /api/v1/requests/:requestId`
- Actions:
  - Add to Chat
  - Block
  - Delete/Remove

### Group Chat Entry
- Status: hidden from alpha messages list.
- Reason: group detail flow still contains non-production placeholder behavior.

### Search
- Status: visible and backend-backed for user discovery.
- Behavior: query drives real `/api/v1/search/users` requests; no fake recommended/trending/demo rows in runtime.

### Camera/Create
- Status: disabled for alpha.
- Behavior: camera simulation UI removed from alpha-visible path; users now see a disabled notice and can close safely.

### Settings
- Status: partially wired.
- Visible behavior: only alpha-safe messaging plus Logout action.
- Hidden: static/dead catalog items that had no persistence or backend wiring.

### Feed / Posts
- Status: real list only; fake interactions removed from alpha-visible path.
- Behavior: backend posts render; comment/share/like local-only actions are not exposed as active buttons in alpha path.

### Reels
- Status: disabled for alpha.
- Behavior: reels tab routes to explicit disabled state; fake reels dataset is not reachable from alpha navigation.

### Stories
- Status: empty-state only for alpha.
- Behavior: story row shows `No stories yet`; story viewer and activity overlays are unreachable in alpha path.

## Non-Negotiable Rule
No fake data or dead buttons are allowed on visible alpha paths.

## Alpha Guard Matrix
| Feature | Status | Flag | Alpha behavior | Legacy fake path risk | Guarded by |
|---|---|---|---|---|---|
| Reels | Disabled | `REELS_ENABLED=false` | Disabled screen | `ReelsComponents.kt` | Home tab guard + flag test |
| Story viewer | Disabled | `STORIES_ENABLED=false` | Empty stories state only | `StoryComponents.kt` | ViewModel/story-open guard + flag test |
| Search discovery | Restricted | `SEARCH_DISCOVERY_ENABLED=false` | Real user search only (no discovery/trending modules) | `SearchScreen.kt` legacy branch removed | Runtime replacement + tests |
| Camera/Create | Disabled | `CAMERA_CREATE_ENABLED=false` | Disabled create screen | old camera simulation paths | Camera toggle guard + flag test |
| Group chat | Disabled | `GROUP_CHAT_ENABLED=false` | Hidden from messages + blocked route | `GroupChatDetailScreen` legacy | Nav guard + route block screen |
| Feed interactions | Disabled | `FEED_INTERACTIONS_ENABLED=false` | Passive interaction UI only | old local mutation branches | ViewModel/UI guard + alpha audit |

## Phase 4 Update (2026-05-16)
- Feed is backend-backed and displays real posts only.
- Create Post is enabled as text-only real flow (backend `POST /api/v1/posts`).
- Media create path remains intentionally disabled for alpha until upload reliability phase.
- Profile Posts tab shows real backend posts (`GET /api/v1/posts/user/:username`).
- Like/comment/share actions remain hidden/passive until Phase 5.
