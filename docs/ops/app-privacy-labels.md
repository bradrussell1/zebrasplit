# App Privacy labels (App Store Connect)

What to enter under **App Store Connect → your app → App Privacy**. These labels
are set in the ASC web UI only — `eas metadata` cannot write them.

Every answer below was read off the code and schema, not assumed:

- Login identity is a phone number (`users.phone`), so phone is always collected.
- `users` also holds `first_name`, `last_name`, `display_name`, `email`, `photo_url`, `venmo_username`.
- Contacts the user picks become `invites` rows holding that person's phone number.
- Receipt photos and trip covers go to the `receipts` / `covers` buckets; avatars to `avatars`.
- Push tokens are stored per device in `devices`.
- Sentry runs with `sendDefaultPii: false`, never calls `setUser`, and scrubs phone
  numbers and dollar amounts in `beforeSend` — so diagnostics are **not** linked to identity.
- There is no analytics SDK in the app (no Firebase, Segment, Amplitude, AppsFlyer, Branch…).
- The app never collects card or bank details. Venmo / Cash App / PayPal all happen
  outside the app, in those apps.

## Tracking

**Do you or your third-party partners use data for tracking?** → **No.**

Nothing is shared with data brokers or ad networks, and nothing is combined with
third-party data for advertising or measurement. No ATT prompt is required.

## Data collected

| Category | Data type | Linked to identity | Purpose |
|---|---|---|---|
| Contact Info | Name | Yes | App Functionality |
| Contact Info | Email Address | Yes | App Functionality |
| Contact Info | Phone Number | Yes | App Functionality |
| Contact Info | Other User Contact Info *(payment handle: Venmo / Cash App / PayPal)* | Yes | App Functionality |
| Financial Info | Other Financial Info *(expense amounts, who paid, balances owed)* | Yes | App Functionality |
| Contacts | Contacts *(only the people the user picks to invite)* | Yes | App Functionality |
| User Content | Photos or Videos *(receipts, trip covers, avatar)* | Yes | App Functionality |
| User Content | Other User Content *(trip names, expense descriptions, comments)* | Yes | App Functionality |
| Identifiers | User ID | Yes | App Functionality |
| Identifiers | Device ID *(push token)* | Yes | App Functionality |
| Usage Data | Product Interaction *(Sentry session counts)* | No | Analytics |
| Diagnostics | Crash Data | No | App Functionality |
| Diagnostics | Performance Data | No | App Functionality |

For every row above, answer **No** to "used for tracking".

## Data explicitly NOT collected

Say no to all of these — they are the ones a reviewer is most likely to query:

- **Payment Info** — no card, bank or account credentials are ever collected. The Pay
  button opens Venmo / Cash App / PayPal with the amount pre-filled; the money moves
  entirely inside that app.
- **Precise or Coarse Location** — the app requests no location permission.
- **Health & Fitness**, **Sensitive Info**, **Browsing History**, **Search History**,
  **Purchases**, **Advertising Data**, **Audio Data**.

## Optional-disclosure notes

Apple lets you mark a data type as optional when the user can use the app without
providing it. Worth flagging:

- **Email Address** — optional; phone is the identity. Sign-in with Apple or Google
  supplies it, otherwise it can stay empty.
- **Contacts** — optional; a user can type a phone number instead of granting access.
- **Photos or Videos** — optional; expenses can be entered by hand with no receipt photo.
- **Other User Contact Info** — the payment handle is required at onboarding, so this
  one is **not** optional.

## Related

- Privacy policy: https://zebrasplit.com/privacy
- Account deletion is in-app (Profile → Settings → Delete account), as Apple requires
  for any app with account creation.
