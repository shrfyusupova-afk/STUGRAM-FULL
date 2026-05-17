# School Alpha QA Checklist

1. Register and login with a real account.
2. Open Profile tab.
3. Verify profile identity data comes from backend, not demo.
4. Verify Posts/Reels/Tagged show real empty states when no data.
5. Close and reopen app, login again, verify profile still real.
6. Open Messages tab.
7. Verify chat list is from backend conversations endpoint.
8. If no conversations, verify `No chats yet` appears.
9. Search in messages and confirm filtering affects only real loaded rows.
10. Toggle to Requests in Messages.
11. Verify requests load from backend (`GET /api/v1/requests`) or show `No requests yet`.
12. For a pending request, verify all actions:
   - Add to Chat opens/creates chat and removes request.
   - Block removes request and blocks user.
   - Delete removes request only.
13. Verify Group entry is not visible in alpha messages path.
14. Open Search tab:
   - no fake recommended/trending content
   - no demo images
   - only safe empty/disabled state messaging
15. Tap create/camera entry from Home:
   - simulation camera must not appear
   - only safe disabled message should appear
16. Open Settings (if entry is enabled in test build):
   - no static dead folder catalog
   - Logout action works (tokens cleared, socket disconnected)
17. Open Edit Profile from Profile tab, change name/bio/location/school, save, and verify persistence after app restart.
18. Logout and login again.
19. Re-check Profile and Messages for fake/demo regressions.
20. Open Search and type at least 2 characters.
21. Verify real users are returned from backend (no fake recommended/trending cards).
22. Open another user profile from search result.
23. Follow that user, verify state changes to Following.
24. Unfollow same user, verify state returns.

## Build Verification Commands
- `./gradlew.bat :app:tasks --console=plain`
- `./gradlew.bat :app:testDebugUnitTest --console=plain --stacktrace`
- `./gradlew.bat :app:compileDebugKotlin --console=plain --stacktrace`
- `./gradlew.bat :app:assembleDebug --console=plain --stacktrace`

## Known Alpha Limitations (Round 6)
- Group chat entry is hidden pending production-stable flow.
- Camera/Create flow is intentionally disabled pending media reliability hardening.
- Reels feed is disabled for alpha (disabled state screen is shown).
- Stories render only as real empty state (`No stories yet`) in alpha path.
- Advanced Search discovery sections (recommended/trending/loops) remain disabled in alpha path.

## Round 9 Chat Reliability Manual Matrix (Required Before 100-User Approval)
1. Two-user basic direct chat:
   - User A sends `A1`, User B receives once.
   - User B sends `B1`, User A receives once.
2. Fast send burst:
   - User A sends `A-fast-1..10` quickly.
   - User B receives all 10 in order, no duplicates.
3. App restart persistence:
   - Exchange 3 messages, force close both apps, reopen.
   - Message history remains intact on both sides.
4. Reconnect recovery:
   - Disable User B network, send 3 messages from User A.
   - Re-enable User B network, missed messages arrive once.
5. Weak network retry:
   - Simulate weak network while sending.
   - UI must show retry/error state, never infinite loading.
6. Correlation evidence:
   - Capture backend logs for one send flow.
   - Verify `requestId`, `conversationId`, and `clientId` are present.

Status in this environment: manual matrix NOT RUN (requires live two-user session and controlled network toggling).

## Phase 4 Feed/Post QA Additions
25. Open Home feed and verify data is from backend only (no demo cards).
26. If no backend posts, verify `No posts yet` state appears.
27. Create a text-only post from Home create flow.
28. Verify new post appears in Home feed after submit.
29. Open own profile -> Posts tab and verify created post exists.
30. Open another user profile -> Posts tab and verify their real posts (if allowed).
31. Verify like/comment/share controls are not active fake actions in feed.
