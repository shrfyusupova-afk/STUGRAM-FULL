let username = null;
let publicUrl = null;

function setUsername(value) {
  username = value;
}

function getUsername() {
  return username;
}

// The bot's own public HTTPS base URL (e.g. Render's RENDER_EXTERNAL_URL) --
// null when running in local long-polling mode with no public domain.
function setPublicUrl(value) {
  publicUrl = value || null;
}

function getPublicUrl() {
  return publicUrl;
}

module.exports = { setUsername, getUsername, setPublicUrl, getPublicUrl };
