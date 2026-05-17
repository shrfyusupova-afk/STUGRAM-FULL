# Chat Reliability Matrix (Round 9)

| Scenario | Automated test | Manual QA | Status | Evidence | Risk |
|---|---|---|---|---|---|
| normal send | `tests/chat/chat.integration.test.js` (direct conversations/messages) | Not run in Round 9 | PASS | Jest pass logs | Low |
| reverse send | `tests/chat/chat.integration.test.js` (reply flow + fetch) | Not run in Round 9 | PASS | Jest pass logs | Low |
| fast send | `tests/chat/chat.integration.test.js` (retry storm / 5x) | Not run in Round 9 | PASS | Jest pass logs | Medium |
| same clientId retry | `tests/chat/chat.integration.test.js` (`clientId` race/idempotency) | Not run in Round 9 | PASS | Jest pass logs | Low |
| socket + HTTP race | `ChatLocalStoreSyncTest.socketThenHttpRace_doesNotDuplicate` | Not run in Round 9 | PASS | Android unit test pass | Medium |
| HTTP + socket race | Not explicitly separate yet | Not run in Round 9 | NOT TESTED | N/A | Medium |
| reconnect missed messages | Partial (cursor/event apply tests) | Not run in Round 9 | PARTIAL | `duplicateReplayAndStaleSequence_areIgnored` | Medium |
| app restart persistence | Not covered in automated unit scope | Not run in Round 9 | NOT TESTED | N/A | Medium |
| timeout/weak network | Partial backend error mapping only | Not run in Round 9 | PARTIAL | ChatRepository timeout mapping | Medium |
| realtime disabled fallback | Covered in backend ops tests outside chat suite | Not run in Round 9 | PARTIAL | `tests/realtime/socketKillSwitch.test.js` (existing) | Low |
| duplicate replay | `ChatLocalStoreSyncTest.duplicateReplayAndStaleSequence_areIgnored` | Not run in Round 9 | PASS | Android unit test pass | Low |
| stale sequence | `ChatLocalStoreSyncTest.duplicateReplayAndStaleSequence_areIgnored` | Not run in Round 9 | PASS | Android unit test pass | Low |
| tombstone resurrection | `ChatLocalStoreSyncTest.tombstonePreventsResurrection_fromOlderEvent` | Not run in Round 9 | PASS | Android unit test pass | Low |

## Notes
- Manual 2-user QA matrix for reconnect/restart is still required before 100-user approval.
- Group chat rows are out of scope for this matrix because group chat remains disabled in alpha.
