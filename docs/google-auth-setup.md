# Google OAuth Setup

Google Sign-In is disabled by default. The `app/src/main/res/values/strings.xml` file ships with a placeholder value `YOUR_GOOGLE_WEB_CLIENT_ID` that **must** be replaced before building a release APK. The Gradle task `checkGoogleClientId` blocks `assembleRelease`/`bundleRelease` until this is done.

## Steps

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **People API** (required for Google Sign-In).
3. Under **APIs & Services → Credentials**, create an **OAuth 2.0 Client ID** of type **Web application**. Copy the Client ID (it ends with `.apps.googleusercontent.com`).
4. Also create a Client ID of type **Android** for your `uz.stugram.app` package (required by Credential Manager on-device).
5. Open `app/src/main/res/values/strings.xml` and replace the placeholder:

```xml
<string name="google_web_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
```

6. The release build guard will now pass. Verify with `./gradlew assembleRelease`.

## Runtime guard

`LoginViewModel.loginWithGoogle()` checks whether the string is still the placeholder at runtime and surfaces an error message instead of crashing. This prevents accidental misconfiguration from reaching users.

## Closed-beta note

Google Sign-In is intentionally disabled in closed-beta builds to reduce the OAuth surface. Enable it only after the production Client ID is verified and the backend `authService.googleLogin()` is tested end-to-end.
