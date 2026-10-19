# Android App Links (`/.well-known/assetlinks.json`)

The site already has the route — `apps/site/app/.well-known/assetlinks.json/route.ts` —
and it 404s on purpose until two environment variables are set on the
`zebrasplit-site` Vercel project:

| Variable | Value |
|---|---|
| `ANDROID_PACKAGE` | `com.bunktab.app` |
| `ANDROID_SHA256_FINGERPRINTS` | comma-separated SHA-256 certificate fingerprints |

Both were set on 2026-10-19 (production + preview). The route is `force-static`, so
**the file only appears after the next site deployment.**

## Fingerprints

The EAS **upload key**, read off the first Android build (`336225db`):

```
B6:59:0C:DA:5B:97:A6:B0:5F:56:20:90:4B:4E:4C:C0:16:B2:CC:68:4C:FA:63:13:C0:78:23:29:FC:3F:EB:0C
```

**This one alone is not enough once the app ships through Google Play.** Play App
Signing re-signs every build with Google's own key, so an app installed from the
Play Store presents a *different* certificate, and link verification fails against
an assetlinks file that only lists the upload key.

As soon as the Play Console app exists, copy the **SHA-256 certificate fingerprint**
from *Release → Setup → App signing* and append it, comma-separated:

```
ANDROID_SHA256_FINGERPRINTS=<upload key>,<Play app signing key>
```

Keeping both is deliberate: the upload key covers builds installed directly from an
AAB or APK (local testing, internal distribution), Google's covers everything
installed from the Play Store.

## Checking it

```sh
curl -s https://zebrasplit.com/.well-known/assetlinks.json | jq .
```

Android caches verification aggressively. To re-check on a device:

```sh
adb shell pm verify-app-links --re-verify com.bunktab.app
adb shell pm get-app-links com.bunktab.app
```

## How to get the fingerprint from a build

```sh
unzip -o app.aab 'META-INF/*' -d extracted
openssl pkcs7 -inform DER -in extracted/META-INF/*.RSA -print_certs -out cert.pem
openssl x509 -in cert.pem -noout -fingerprint -sha256
```

`keytool` is on the PATH on this machine but there is no Java runtime, so the
openssl route above is the one that works.
