# School Alpha 20-User Gate

## Backend
- [ ] Backend service is up and stable.
- [ ] MongoDB connected and healthy.
- [ ] `/livez` returns healthy.
- [ ] `/readyz` returns healthy.
- [ ] `x-request-id` is present in responses.
- [ ] Profile integration tests pass.
- [ ] Requests integration tests pass.
- [ ] Kill switches are configured and documented.
- [ ] Runtime logs are visible to the incident owner.

## Android
- [ ] `:app:assembleDebug` passes.
- [ ] Register and login work.
- [ ] Profile loads real backend data.
- [ ] Edit Profile persists to backend.
- [ ] Messages list loads real conversations.
- [ ] Direct chat send/receive manually verified.
- [ ] Requests: Add to Chat / Block / Delete manually verified.
- [ ] Search discovery is disabled in alpha.
- [ ] Camera/Create is disabled in alpha.
- [ ] Reels is disabled in alpha.
- [ ] Stories show empty-state only.
- [ ] Group chat is hidden/blocked.
- [ ] Settings logout works.
- [ ] No fake/demo content is visible in alpha path.

## Operational
- [ ] Test users are prepared and limited to 20.
- [ ] Feedback channel is ready.
- [ ] Rollback plan is ready.
- [ ] Kill switch instructions are ready.
- [ ] Incident owner is assigned.
- [ ] Bug report format is prepared.

## Immediate Stop Conditions
- Confirmed message loss.
- Confirmed message duplication.
- Auth refresh loop.
- Repeated timeout spike.
- Crash affecting multiple users.
- Any fake/demo screen becomes visible.
- Privacy/block/request security bug.
