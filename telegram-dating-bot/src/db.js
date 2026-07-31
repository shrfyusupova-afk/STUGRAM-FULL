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
  setTelegramUsername: store.setTelegramUsername,
  deleteProfile: store.deleteProfile,
  getAllProfiles: store.getAllProfiles,
  searchProfiles: store.searchProfiles,
  getProfileStats: store.getProfileStats,
  listAllProfileIds: store.listAllProfileIds,
  setProfileActive: store.setProfileActive,
  // Postgres-only fast path; discover.js falls back when absent.
  pickCandidateRow: store.pickCandidateRow || null,
  // Entitlements
  setPremiumUntil: store.setPremiumUntil,
  hasPremium: store.hasPremium,
  setAnonGenderFilterUntil: store.setAnonGenderFilterUntil,
  hasAnonGenderFilter: store.hasAnonGenderFilter,
  grantVipChat: store.grantVipChat,
  hasVipChat: store.hasVipChat,
  hasUnlocked: store.hasUnlocked,
  grantUnlock: store.grantUnlock,
  // Referrals + the free profile views they pay for. Both backends implement
  // all of these, so unlike txStore below there is nothing to fall back to.
  createReferral: store.createReferral,
  getReferral: store.getReferral,
  markReferralRewarded: store.markReferralRewarded,
  countReferrals: store.countReferrals,
  getUnlockCredits: store.getUnlockCredits,
  addUnlockCredits: store.addUnlockCredits,
  consumeUnlockCredit: store.consumeUnlockCredit,
  getLikeNoticeAt: store.getLikeNoticeAt,
  setLikeNoticeAt: store.setLikeNoticeAt,
  backfillMatchUnlocks: store.backfillMatchUnlocks,
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
  // Complaints
  createComplaint: store.createComplaint,
  getComplaint: store.getComplaint,
  listComplaints: store.listComplaints,
  setComplaintReply: store.setComplaintReply,
  // Admin + language
  isAdmin: store.isAdmin,
  addAdmin: store.addAdmin,
  listAdmins: store.listAdmins,
  removeAdmin: store.removeAdmin,
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
        listUndeliveredOrders: store.listUndeliveredOrders,
        markDelivered: store.markDelivered,
        bumpDeliveryAttempts: store.bumpDeliveryAttempts,
      }
    : null,
};
