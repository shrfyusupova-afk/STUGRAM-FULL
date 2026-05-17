# Production Post/Feed QA

## Scope
Phase 4 - feed/post production system validation.

## Accounts
- User A
- User B

## Checklist
1. Login as User A.
2. Open Home feed.
3. If no posts exist, confirm `No posts yet` is shown.
4. Create text-only post with caption.
5. Confirm submit succeeds and no fake success toast is used.
6. Confirm post appears in feed.
7. Open User A profile -> Posts tab; confirm created post appears.
8. Restart app and confirm post still exists in feed/profile.
9. Login as User B.
10. Open User A profile; confirm User A post is visible if privacy allows.
11. Attempt to create empty post (blank caption, no media).
12. Confirm request is rejected and error is shown.
13. Verify no demo/picsum/fake post cards appear in feed.
14. Verify like/comment/share are not active fake mutation controls.

## Endpoints Used
- `POST /api/v1/posts`
- `GET /api/v1/posts/feed/me`
- `GET /api/v1/posts/user/:username`

## Result Recording
- Mark each step PASS/FAIL.
- Capture requestId for failures.
- Capture screenshot for UI regression.
