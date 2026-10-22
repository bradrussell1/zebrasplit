# secrets/

Credential files that EAS needs at submit time and that must never be committed.

| File | What it is | Where it comes from |
|---|---|---|
| `play-service-account.json` | Google Play Android Publisher service account key | Google Cloud console → service account with the **Android Publisher** role → JSON key, then invite that address in Play Console → Users and permissions |

The directory is gitignored apart from this file. `apps/mobile/eas.json` points
`submit.production.android.serviceAccountKeyPath` at the path above.

`google-services.json` (Firebase, for push) is **not** kept here and is **not**
gitignored. It carries no private key and is compiled into every APK, so it cannot be
a secret; hiding it would only stop EAS — which builds from the git archive — from
ever seeing it. It lives at `apps/mobile/google-services.json` and is committed. The
Firebase API key inside it is a client identifier, protected by restricting it to the
package name and signing certificate in the Google Cloud console.
