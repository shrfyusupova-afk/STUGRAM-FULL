// Chooses the storage backend once, at require time, and re-exports it under
// the names the rest of the app already uses.
//
// With DATABASE_URL set (Render Postgres, Supabase, Neon...) data survives
// deploys and restarts. Without it, the original JSON files are used, so
// local development needs no database and an existing deploy keeps working
// unchanged until a database is actually provisioned.
//
// Both backends expose the SAME async API. Everything here returns a promise
// and must be awaited by callers.
const usePostgres = !!process.env.DATABASE_URL;

const store = usePostgres ? require("./storage/pgStore") : require("./storage/jsonStore");

if (usePostgres) {
  console.log("Storage: PostgreSQL (DATABASE_URL is set) -- data survives restarts.");
} else {
  console.warn(
    "Storage: local JSON files (DATABASE_URL is not set). On a host with an " +
      "ephemeral filesystem this means profiles, likes and payment records are " +
      "LOST on every deploy or restart. Set DATABASE_URL to use Postgres."
  );
}

// Only the Postgres backend has schema setup / connection teardown; the JSON
// one has nothing to do, so callers can always call these unconditionally.
async function initStorage() {
  if (store.init) await store.init();
}

async function closeStorage() {
  if (store.close) await store.close();
}

module.exports = {
  usePostgres,
  initStorage,
  closeStorage,
  // Profiles
  getProfile: store.getProfile,
  saveProfile: store.saveProfile,
  deleteProfile: store.deleteProfile,
  getAllProfiles: store.getAllProfiles,
  setProfileActive: store.setProfileActive,
  // Entitlements
  setPremiumUntil: store.setPremiumUntil,
  hasPremium: store.hasPremium,
  setAnonGenderFilterUntil: store.setAnonGenderFilterUntil,
  hasAnonGenderFilter: store.hasAnonGenderFilter,
  grantVipChat: store.grantVipChat,
  hasVipChat: store.hasVipChat,
  hasUnlocked: store.hasUnlocked,
  grantUnlock: store.grantUnlock,
  // Likes / dislikes
  recordLike: store.recordLike,
  getLikers: store.getLikers,
  hasLiked: store.hasLiked,
  recordDislike: store.recordDislike,
  getDislikes: store.getDislikes,
  // Discovery cursor
  getDiscoverState: store.getDiscoverState,
  setDiscoverState: store.setDiscoverState,
  clearDiscoverState: store.clearDiscoverState,
  // Admin + language
  isAdmin: store.isAdmin,
  addAdmin: store.addAdmin,
  getLanguage: store.getLanguage,
  setLanguage: store.setLanguage,
  // Payment ledger -- Postgres only; click.js falls back to its own JSON file
  // when these are absent.
  txStore: usePostgres
    ? {
        getTransaction: store.getTransaction,
        findPendingOrder: store.findPendingOrder,
        createTransaction: store.createTransaction,
        updateTransactionAmount: store.updateTransactionAmount,
        markTransaction: store.markTransaction,
        getSalesRows: store.getSalesRows,
      }
    : null,
};
