# Production Profile/Follow/Search QA

Date: 2026-05-16

## Scope
- Own profile load/update
- Other-user profile open
- Follow / unfollow
- User search (real backend)

## Manual QA (Two Accounts)
1. Login as User A.
2. Open Search and type User B username.
3. Verify User B appears in results (no fake/trending/recommended rows).
4. Tap User B result and open real profile route.
5. Tap Follow and verify button state changes to Following.
6. Return to own profile and verify following count updated.
7. Open User B profile and verify followers count updated.
8. Tap Following/Unfollow and verify counts return.
9. Verify self profile does not show follow button.
10. Verify blocked pair follow action returns error and no fake success UI.
11. Verify query shorter than 2 chars shows hint state only.
12. Verify unknown query shows `No results found`.

## Automated Evidence
- Android:
  - `SearchViewModelTest`
  - `ProfileViewModelTest`
  - `MessagesViewModelTest`
- Backend:
  - `tests/follow/follow.integration.test.js`
  - `tests/search/search.integration.test.js`

## Notes
- Reels/Stories/Camera/Group remain disabled by feature flags in this phase.
- Search discovery content stays removed from runtime paths.
