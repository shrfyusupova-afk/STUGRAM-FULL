// Privacy and block regression tests.
// Verifies that block and private-account enforcement holds across the API boundary.

const { setupIntegrationTestSuite } = require("../helpers/integration");
const { authHeader, createAuthenticatedUser, createPost, createFollow } = require("../helpers/factories");

const { getClient } = setupIntegrationTestSuite();

const createBlock = async ({ blockerId, blockedId }) => {
  const Block = require("../../src/models/Block");
  return Block.create({ blocker: blockerId, blocked: blockedId });
};

describe("Privacy regression — block enforcement", () => {
  it("blocked user's posts do not appear in blocker's feed", async () => {
    const client = getClient();
    const { user: blocker, accessToken } = await createAuthenticatedUser({
      identity: "blocker@example.com",
      username: "blocker_user",
    });
    const { user: blocked } = await createAuthenticatedUser({
      identity: "blocked@example.com",
      username: "blocked_user",
    });

    await createPost({ authorId: blocked._id, caption: "hidden post" });
    await createBlock({ blockerId: blocker._id, blockedId: blocked._id });

    const response = await client
      .get("/api/v1/posts/feed/me?limit=50")
      .set(authHeader(accessToken));

    expect(response.statusCode).toBe(200);
    const captions = response.body.data.map((p) => p.caption);
    expect(captions).not.toContain("hidden post");
  });

  it("blocker's posts do not appear in blocked user's feed either", async () => {
    const client = getClient();
    const { user: blocker } = await createAuthenticatedUser({
      identity: "blocker2@example.com",
      username: "blocker_user2",
    });
    const { user: blocked, accessToken } = await createAuthenticatedUser({
      identity: "blocked2@example.com",
      username: "blocked_user2",
    });

    await createPost({ authorId: blocker._id, caption: "blocker post hidden from victim" });
    await createBlock({ blockerId: blocker._id, blockedId: blocked._id });

    const response = await client
      .get("/api/v1/posts/feed/me?limit=50")
      .set(authHeader(accessToken));

    expect(response.statusCode).toBe(200);
    const captions = response.body.data.map((p) => p.caption);
    expect(captions).not.toContain("blocker post hidden from victim");
  });

  it("GET /blocks/me returns the correct list of blocked accounts", async () => {
    const client = getClient();
    const { user: blockerUser, accessToken } = await createAuthenticatedUser({
      identity: "blocklist-blocker@example.com",
      username: "blocklist_blocker",
    });
    const { user: target } = await createAuthenticatedUser({
      identity: "blocklist-target@example.com",
      username: "blocklist_target",
    });

    await createBlock({ blockerId: blockerUser._id, blockedId: target._id });

    const response = await client
      .get("/api/v1/blocks/me")
      .set(authHeader(accessToken));

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    const ids = response.body.data.map((item) => String(item._id ?? item.user?._id));
    expect(ids).toContain(String(target._id));
  });

  it("block and unblock removes the entry and restores feed visibility", async () => {
    const client = getClient();
    const { user: actor, accessToken } = await createAuthenticatedUser({
      identity: "toggle-blocker@example.com",
      username: "toggle_blocker",
    });
    const { user: peer } = await createAuthenticatedUser({
      identity: "toggle-peer@example.com",
      username: "toggle_peer",
    });

    await createPost({ authorId: peer._id, caption: "peer post" });

    // Block the peer.
    const blockRes = await client
      .post(`/api/v1/blocks/${peer._id}`)
      .set(authHeader(accessToken));
    expect(blockRes.statusCode).toBe(200);

    // Feed must not contain peer's post while blocked.
    const feedAfterBlock = await client
      .get("/api/v1/posts/feed/me?limit=50")
      .set(authHeader(accessToken));
    expect(feedAfterBlock.body.data.map((p) => p.caption)).not.toContain("peer post");

    // Unblock the peer.
    const unblockRes = await client
      .delete(`/api/v1/blocks/${peer._id}`)
      .set(authHeader(accessToken));
    expect(unblockRes.statusCode).toBe(200);

    // Feed should now show peer's post.
    const feedAfterUnblock = await client
      .get("/api/v1/posts/feed/me?limit=50")
      .set(authHeader(accessToken));
    expect(feedAfterUnblock.body.data.map((p) => p.caption)).toContain("peer post");
  });
});

describe("Privacy regression — private account enforcement", () => {
  it("private user's profile is accessible to non-followers but with limited data (not 403)", async () => {
    // The profile endpoint returns 200 for private accounts but restricts content
    // fields. Only blocks result in 403 from this endpoint.
    const client = getClient();
    const { user: privateUser } = await createAuthenticatedUser({
      identity: "private@example.com",
      username: "private_user",
      isPrivateAccount: true,
    });
    const { accessToken } = await createAuthenticatedUser({
      identity: "stranger@example.com",
      username: "stranger_user",
    });

    const response = await client
      .get(`/api/v1/profiles/${privateUser.username}`)
      .set(authHeader(accessToken));

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toBeTruthy();
    // Private account is discoverable but followers count / posts should be restricted.
    expect(response.body.data.isPrivate ?? response.body.data.isPrivateAccount).toBe(true);
  });

  it("private user's posts return 403 to unauthenticated viewers (route has no auth middleware)", async () => {
    // GET /posts/user/:username does not run requireAuth, so viewerId is always
    // undefined. Private accounts therefore return 403 for all callers since
    // follower status cannot be verified without a token.
    const client = getClient();
    const { user: privateUser } = await createAuthenticatedUser({
      identity: "private2@example.com",
      username: "private_user2",
      isPrivateAccount: true,
    });

    await createPost({ authorId: privateUser._id, caption: "private post" });

    const response = await client
      .get(`/api/v1/posts/user/${privateUser.username}`);

    expect(response.statusCode).toBe(403);
  });
});
