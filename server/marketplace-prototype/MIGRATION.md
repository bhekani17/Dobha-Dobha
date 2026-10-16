# AWS migration status and release gates

AWS is the target for the `aws` branch. Do not switch existing users to a partial
API: deployed Cloudflare data, sessions and media are separate from this stack.

| Area | AWS implementation | Remaining before client cutover |
| --- | --- | --- |
| Email/password identity | Cognito registration, confirmation, login, refresh and recovery | Client confirmation/refresh flows; account import/reset and logout revocation |
| Profiles | Read/edit, vendor mode, avatar, account deletion | Deployed integration checks and migration of existing accounts |
| Catalog | Listings, feed, detail, S3 upload grants | Client upload protocol, media verification, category and pagination contract parity |
| Orders and wallet | Atomic checkout/escrow, dispatch, confirmation, dispute and admin resolution | Cart checkout, order reviews, real payment integration and migration reconciliation |
| Social | Not yet migrated | Likes, saves, comments, reports, follows, people search and profiles |
| Offers and chat | Checkout validates accepted AWS offers | Offer creation/responses, conversations and unread counts |
| Support and moderation | Verified Cognito admin authorization for settlement | Support requests/replies, listing moderation and dispute listing |
| Notifications | DynamoDB outbox → SQS → stored notifications | Device push delivery, chat counts and deployed retry tests |
| Live video | Existing optional LiveKit viewer integration | Decide AWS IVS versus retaining LiveKit; implement host/client parity |
| Operations | Private buckets, recovery/retention, throttles, CI tests and SAM validation | Metrics/alarms, restore/rollback drills, least-privilege deployment-role review |

## Required integration scenarios

- Register a synthetic user, confirm email, log in, refresh, recover a password,
  revoke sessions and delete the account. An unverified email must never receive
  administrator access.
- Publish/edit a listing with photo/video uploads; verify listing visibility,
  filters, pagination, ownership, comments, saves and moderation on both clients.
- Race two buyers against the final unit; exactly one order may succeed. Race a
  listing edit against checkout; stock and price must remain consistent.
- Inject a transaction failure during confirmation and settlement; retry must
  succeed once without a duplicate payout. Reconcile order totals, both wallet
  balances and ledger entries.
- Race account deletion against checkout and top-up; either deletion or the
  financial operation may succeed, with no retained positive balance belonging
  to a deleted account.
- Exercise cart, offers, chat, support, push and live selling on web and mobile.
- Export and reconcile production records/media, rehearse a restore into an
  isolated environment, and verify a client rollback before scheduling cutover.

## Client maintainability work

When implementing the Cognito client contract, extract session persistence and
refresh handling from Flutter's central `AppState` and the website's main script.
Keep marketplace state and views separate from authentication/network concerns.
The current Flutter app cannot be validated without its declared Flutter/Dart
SDK; CI must run Flutter analysis and relevant tests when those files change.
