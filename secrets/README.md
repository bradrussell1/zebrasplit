# secrets/

Credential files that EAS needs at submit time and that must never be committed.

| File | What it is | Where it comes from |
|---|---|---|
| `play-service-account.json` | Google Play Android Publisher service account key | Google Cloud console → service account with the **Android Publisher** role → JSON key, then invite that address in Play Console → Users and permissions |

The directory is gitignored apart from this file. `apps/mobile/eas.json` points
`submit.production.android.serviceAccountKeyPath` at the path above.

`google-services.json` (Firebase, for push) is **not** kept here — it belongs at
`apps/mobile/google-services.json`, where the Expo config plugin expects it, and is
gitignored there.
