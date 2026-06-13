// Tests for the legacy token auto-migration path in auth.js.
// Covers the race-condition fix: concurrent requests with the same legacy token
// must not cause multiple Account.create calls or repeated user.save() writes.

jest.mock("../../src/utils/token", () => ({
  verifyAccessToken: jest.fn(),
}));
jest.mock("../../src/models/User");
jest.mock("../../src/models/Account");
jest.mock("../../src/services/redisSecurityService", () => ({
  isTokenDenied: jest.fn().mockResolvedValue(false),
}));

const { verifyAccessToken } = require("../../src/utils/token");
const User = require("../../src/models/User");
const Account = require("../../src/models/Account");

// We test authenticateRequest indirectly through requireAuth.
const { requireAuth } = require("../../src/middlewares/auth");

const buildLegacyPayload = (userId) => ({
  sub: userId,
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
  jti: `jti-${userId}`,
});

const buildUser = (overrides = {}) => ({
  _id: "user123",
  id: "user123",
  identity: "test@example.com",
  passwordHash: "hash",
  googleId: null,
  lastLoginAt: null,
  tokenInvalidBefore: null,
  isSuspended: false,
  accountId: null,
  save: jest.fn().mockResolvedValue(undefined),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  ...overrides,
});

const buildAccount = (overrides = {}) => ({
  _id: "acc123",
  id: "acc123",
  isSuspended: false,
  suspendedUntil: null,
  tokenInvalidBefore: null,
  ...overrides,
});

describe("legacy token auto-migration (auth.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("migrates a legacy token by creating a new Account and linking it atomically", async () => {
    const user = buildUser();
    const account = buildAccount();

    verifyAccessToken.mockReturnValue(buildLegacyPayload("user123"));
    // Mongoose findById returns a chainable query; mock .select() on the return value.
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    Account.findOne = jest.fn().mockResolvedValue(null);
    Account.create = jest.fn().mockResolvedValue(account);
    User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const req = { headers: { authorization: "Bearer legacy.token.here" } };
    const next = jest.fn();
    await requireAuth(req, {}, next);

    expect(Account.create).toHaveBeenCalledTimes(1);
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: user._id, accountId: null },
      { $set: { accountId: account.id } }
    );
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it("handles E11000 duplicate key gracefully when concurrent request already created Account", async () => {
    const user = buildUser();
    const existingAccount = buildAccount();

    verifyAccessToken.mockReturnValue(buildLegacyPayload("user123"));
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    // First findOne returns null (no account yet), then after duplicate error, findOne finds it.
    Account.findOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingAccount);
    const dupError = new Error("duplicate key");
    dupError.code = 11000;
    Account.create = jest.fn().mockRejectedValue(dupError);
    User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 0 }); // no-op, other request won

    const req = { headers: { authorization: "Bearer legacy.token.here" } };
    const next = jest.fn();
    await requireAuth(req, {}, next);

    expect(Account.create).toHaveBeenCalledTimes(1);
    // Must retry findOne after duplicate error.
    expect(Account.findOne).toHaveBeenCalledTimes(2);
    // Must still attempt the atomic user link.
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: user._id, accountId: null },
      { $set: { accountId: existingAccount.id } }
    );
    expect(next).toHaveBeenCalledWith(); // no error — migration succeeded via retry
  });

  it("does not call Account.create when Account already exists", async () => {
    const existingAccount = buildAccount();
    const user = buildUser();

    verifyAccessToken.mockReturnValue(buildLegacyPayload("user123"));
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    Account.findOne = jest.fn().mockResolvedValue(existingAccount);
    Account.create = jest.fn();
    User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const req = { headers: { authorization: "Bearer legacy.token.here" } };
    const next = jest.fn();
    await requireAuth(req, {}, next);

    expect(Account.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("skips migration entirely when user already has an accountId (multi-profile token path)", async () => {
    const user = buildUser({ accountId: "acc-already-set" });
    const account = buildAccount({ _id: "acc-already-set", id: "acc-already-set" });

    verifyAccessToken.mockReturnValue(buildLegacyPayload("user123"));
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    Account.findById = jest.fn().mockResolvedValue(account);
    Account.create = jest.fn();
    Account.findOne = jest.fn();

    const req = { headers: { authorization: "Bearer modern.token.here" } };
    const next = jest.fn();
    await requireAuth(req, {}, next);

    expect(Account.create).not.toHaveBeenCalled();
    expect(Account.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 401 when token is missing from Authorization header", async () => {
    const req = { headers: {} };
    const next = jest.fn();
    await requireAuth(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
