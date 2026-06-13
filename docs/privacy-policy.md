# Privacy Policy — StuGram

**Last updated:** 2026-05-18  
**Effective date:** 2026-05-18  
**Live URL:** https://shrfyusupova-afk.github.io/stugram-full/privacy.html

> Rendered HTML version: see `website/privacy.html` (auto-deployed to GitHub Pages).

---

## 1. Introduction

StuGram ("we," "our," or "us") operates a social networking application for students ("Service"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our mobile application and backend services.

By creating an account or using StuGram, you agree to the collection and use of information in accordance with this policy.

---

## 2. Information We Collect

### 2.1 Account Information
- **Full name** — provided during registration
- **Email address or phone number** — used as account identity
- **Username** — chosen by you; visible to other users
- **Password** — stored as a bcrypt hash (we cannot recover it)
- **Date of birth** — optional; used for age-appropriate content
- **School, grade, group, region, district** — optional; used for student community features

### 2.2 Content You Create
- **Posts** (photos, videos, captions, hashtags) — stored on our servers and Cloudinary
- **Stories** — stored temporarily; automatically deleted after 24 hours
- **Direct messages and group chats** — stored on our servers
- **Comments, likes, reactions** — stored on our servers
- **Profile picture and banner** — uploaded to Cloudinary CDN

### 2.3 Usage Data
- **Login timestamps** and IP addresses — for security and suspicious activity detection
- **Device information** — device ID, user agent string — for session management
- **Last seen timestamp** — used to show online status

### 2.4 Technical Data
- **Crash reports** — collected via Sentry (crash reporting service); includes device model, OS version, stack traces
- **Session tokens** — JWT access and refresh tokens stored securely in device encrypted storage

---

## 3. How We Use Your Information

| Purpose | Legal Basis |
|---------|-------------|
| Providing the social network service | Contract performance |
| Account security (suspicious login detection, session management) | Legitimate interest |
| Showing your profile to followers | Contract performance |
| Sending OTP and password reset emails | Contract performance |
| Crash reporting and service improvement | Legitimate interest |
| Compliance with legal obligations | Legal obligation |

We **do not** sell your personal data to third parties.  
We **do not** use your data for targeted advertising.

---

## 4. Data Sharing

We share your data only with:

| Recipient | Purpose | Data Shared |
|-----------|---------|-------------|
| **MongoDB Atlas** (MongoDB Inc.) | Database storage | All user data |
| **Cloudinary** (Cloudinary Ltd.) | Media storage and delivery | Photos, videos, avatars |
| **Sentry** (Functional Software, Inc.) | Crash reporting | Device info, stack traces, anonymised user ID |
| **Brevo / Resend** | Email delivery (OTP, password reset) | Email address, OTP code |
| **Google** | OAuth sign-in | Google account ID, name, email |
| **Render** (Render Services, Inc.) | Backend hosting | Processed by our servers |

All recipients are contractually bound to protect your data.

---

## 5. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Active account data | Until account deletion |
| Deleted account data (tombstone) | 90 days after deletion, then purged |
| Session tokens | 30 days or until logout |
| Crash reports (Sentry) | 90 days |
| OTP codes | 10 minutes |
| Password reset tokens | 15 minutes |
| Story media | 24 hours |

---

## 6. Your Rights

You have the right to:
- **Access** your personal data — available via the app (profile, settings)
- **Correct** your data — edit profile at any time
- **Delete** your account and all associated data — available in Settings → Delete Account
- **Export** your data — contact us at [support email — TO BE SET]
- **Object** to processing — contact us at [support email — TO BE SET]

**Account deletion:** When you delete your account through the app, your profile is immediately anonymised (name changed to "Deleted User", bio and avatar removed) and all sessions are revoked. Remaining data is purged within 90 days. This satisfies Google Play Store's account deletion policy (effective November 2023).

---

## 7. Children's Privacy

StuGram is intended for users aged **13 and older**. We do not knowingly collect data from children under 13. If we become aware that a child under 13 has provided personal information, we will delete it immediately.

---

## 8. Security

We protect your data using:
- HTTPS/TLS for all data in transit
- bcrypt hashing for passwords (cost factor 12)
- Encrypted storage for tokens on Android devices
- JWT token rotation and revocation
- Rate limiting on authentication endpoints
- IP-based suspicious activity detection

---

## 9. Third-Party Services

StuGram integrates the following third-party services. Their respective privacy policies apply to data they process:

- MongoDB Atlas: https://www.mongodb.com/legal/privacy-policy
- Cloudinary: https://cloudinary.com/privacy
- Sentry: https://sentry.io/privacy/
- Google: https://policies.google.com/privacy
- Render: https://render.com/privacy

---

## 10. Changes to This Policy

We will notify users of material changes via an in-app notification and update the "Last updated" date. Continued use of the Service after changes constitutes acceptance.

---

## 11. Contact

For privacy questions or data requests:

**Email:** [support@stugram.uz — TO BE SET BEFORE LAUNCH]  
**Website:** [https://stugram.uz — TO BE SET BEFORE LAUNCH]

---

*This policy is provided in Uzbek/Russian/English. In case of conflict, the English version governs.*
