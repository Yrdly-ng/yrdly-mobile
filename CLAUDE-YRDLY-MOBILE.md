# Yrdly Mobile App

## Product context

Yrdly is a neighbourhood social network and local marketplace for Nigerian communities. This repository is the native iOS and Android client, built with Expo and React Native. It connects to the Yrdly Supabase project and the main web product at `app.yrdly.ng`; the public marketing site is in the separate `yrdly` repository. All three projects have independent Git histories and dependency installs.

The app includes a local social feed, community discovery, marketplace listings and checkout, events/tickets, business catalogs and bookings, messaging, notifications, profiles, safety tools, and admin flows. The web and mobile clients implement many of the same domain features separately. Shared-looking `src/lib` modules are copied into each repo, not imported from a shared package; check parity when changing backend-facing behavior.

## Stack and commands

- Expo SDK 57, Expo Router, React Native 0.86, TypeScript, React 19, and React Native Unistyles.
- Supabase Auth, Postgres, Realtime, and Storage; payment integrations include Paystack and Payluk-related checkout/escrow flows.
- Other native integrations include Expo notifications, location/maps, camera and image picker, Crisp support, secure storage, and deep links.
- Run commands from this directory: `pnpm start`, `pnpm ios`, `pnpm android`, `pnpm web`, `pnpm lint`, and `pnpm format:check`.
- EAS build profiles are in `eas.json`; native app configuration, plugins, URL scheme, permissions, and environment-based plugin settings are in `app.config.js`.

## Code map

- `src/app/`: Expo Router screens. `(auth)`, `(onboarding)`, `(tabs)`, and `(admin)` define navigation groups; other files cover marketplace, events, bookings, checkout, disputes, chats, communities, profiles, and settings.
- `src/components/`: shared native UI and feature pieces such as feed cards, marketplace items, event cards, alerts, onboarding, and payment checkout.
- `src/lib/`: Supabase client, auth and feature services for marketplace, bookings, escrow, events, disputes, moderation, notifications, reviews, and storage.
- `src/hooks/`, `src/context/`, and `src/types/`: shared hooks and domain-grouped hooks, theme/location/notification state, and app domain types. Keep cross-cutting hooks at `src/hooks/`; group feature hooks under `src/hooks/<domain>/`.
- Feature hook folders: `src/hooks/bookings/`, `categories/`, `chat/`, `location/`, `media/`, `notifications/`, `payments/`, `people/`, and `posts/`. These contain booking, category, typing, GPS, media, push, bank-logo, social-connection, and feed hooks respectively.
- `src/lib/offline/local-cache.ts`: account-scoped offline cache, including the bounded in-memory recent-post cache. Keep post cache reads and writes behind `localCache`.
- `src/constants/` and `src/data/`: visual tokens, alert constants, and Nigerian location, interest, and bank datasets.
- `supabase/migrations/` and `supabase/functions/`: local copies of database changes and app-specific Edge Functions. Compare migration names/content with `yrdly-app/supabase/` before changing shared schema behavior.
- `plugins/`, `assets/`, `scripts/`, `eas.json`, and `codemagic.yaml`: native build configuration, assets, config plugins, and automation.

## Navigation and app behavior

- The root layout in `src/app/_layout.tsx` composes theme, auth, location, notification, splash, and navigation handling. It also guards routes based on session and onboarding state.
- Tab navigation is under `src/app/(tabs)/`. The central create menu routes to post, listing, event, and alert creation.
- Deep links use the `yrdlymobile` scheme and verified links under `app.yrdly.ng`; inspect `app.config.js` and the root navigation guard before changing routing.
- Location, camera, media, and notification permissions are described in native app configuration. Keep permission requests tied to a clear feature and maintain iOS/Android configuration together.
- Supabase auth uses a custom SecureStore adapter in `src/lib/supabase/supabase.ts` to persist large session values safely on native platforms. Preserve session behavior when changing auth storage.

## Important implementation rules

- For payment, escrow, booking, event ticket, refund, payout, or dispute work, follow the whole path from screen and service through web API/provider callback to database state. Some server-side flows are implemented in `yrdly-app`; confirm which client/server owns a step before editing.
- Treat schema migrations as production-impacting. Review RLS, RPCs, triggers, and Edge Functions; compare the copied migrations with the web app. Never run destructive database scripts against production.
- Keep secret keys on trusted server infrastructure. Expo `EXPO_PUBLIC_*` values are shipped in the client and must not contain service-role or payment secrets.
- Prefer existing services, hooks, contexts, and theme tokens over direct database calls in screens or ad-hoc style values.
- Respect platform differences in deep links, permissions, keyboard/safe areas, push notifications, and native modules. Verify platform-specific configuration before assuming web behavior represents iOS or Android.
- `test:e2e:smoke` is available for the configured E2E runner; use the specific project's documented checks when asked to validate a change.

## Product model and mobile architecture

Yrdly is a local network built around nearby people and places: users have Nigerian location/community context, share local posts, discover goods and services, message, attend events, and use safety tools. Mobile is a first-class native client with device capabilities, not simply a wrapper around the website. It shares the product's Supabase data model with the web app, but much screen and service code is implemented separately.

The app uses Expo Router file-based navigation. Many reads and writes use Supabase directly; trusted payment/provider operations use the main Next.js web app. `src/lib/network/api.ts` is the bridge to that app: it attaches the current Supabase bearer token, refreshes once after a 401, and expects JSON. This separation is deliberate; provider secrets must never move into the Expo bundle.

### Core records and compatibility

- Supabase Auth is the identity; a corresponding `users` row is the Yrdly profile. Auth context exposes both. The app can load cached profile data at startup and refresh it from Supabase.
- `posts` stores social content and many marketplace listings. Business products use `businesses`/`catalog_items`; service commerce uses offerings, staff, availability, quotes, and bookings.
- Normalized events and tickets use `events`, `ticket_tiers`, and `tickets`, though event service code still supports some old event posts.
- Community posts/membership/join requests are a separate data family from the neighborhood feed.
- Purchases/disputes live in `escrow_transactions`, apart from the listing/catalog record. SQL migrations and RLS rules are part of mobile behavior.

## Startup and navigation lifecycle

1. `src/app/_layout.tsx` sets up Unistyles, fonts, native splash handling, gesture/safe-area/keyboard/bottom-sheet providers, auth, theme, location, notification badges, push handling, and global UI.
2. `AuthProvider` in `src/hooks/use-supabase-auth.tsx` restores the Supabase session, checks a local profile cache for a fast boot, fetches a fresh profile when online, creates a missing profile when appropriate, and subscribes to profile updates through Realtime.
3. The root `RootNavigationGuard` routes signed-out users through onboarding/auth, incomplete profiles to profile setup, and complete profiles to tabs. It explicitly permits selected content deep links such as posts, events, marketplace, profile, chat, and checkout.
4. `src/app/(tabs)/_layout.tsx` hosts the tab bar, unread message state, and create menu. The create menu routes to post, for-sale listing, event, or alert creation. A user without `profile.phone_verified` must verify before creating a listing or event.
5. `app.config.js` defines the `yrdlymobile` scheme, app/universal links under `app.yrdly.ng`, native permissions, Expo plugins, map keys, notification mode, and web API base URL.

For auth, redirect, or deep-link bugs, inspect the screen, root guard, auth provider, `app.config.js`, and platform app-link setup together.

## End-to-end mobile journeys

### Account and profile

- Auth screens are in `src/app/(auth)/*`; profile and onboarding screens are in `src/app/(onboarding)/*`.
- `src/hooks/use-supabase-auth.tsx` wraps `AuthService`, manages user/profile state, and uses offline-aware boot/cache behavior. `src/lib/supabase/supabase.ts` uses a chunked SecureStore adapter on native because session values can exceed SecureStore's per-value limit; web uses localStorage.
- Phone verification screens are top-level `src/app/verify-phone.tsx` and `verify-phone-otp.tsx`, with backend support in Supabase functions/API logic. Keep posting gates and verification state aligned.
- Avoid changing profile recovery/session persistence without considering slow network, offline startup, OAuth account creation, and app restarts.

### Neighborhood feed, create menu, and communities

- Main tabs: `src/app/(tabs)/index.tsx` is the home/feed; `catalog.tsx` combines discovery surfaces such as marketplace/events/businesses; `messages.tsx` and `profile.tsx` are the other primary tabs.
- The create menu dispatches to `src/app/create-post.tsx`, `create-for-sale.tsx`, `create-event.tsx`, and `create-alert.tsx`.
- Feed hooks and cards live in `src/hooks/posts/use-posts.tsx` and `src/components/posts/PostCard.tsx`; location context/hooks plus `src/data/{states,lgas,wards,lgas-with-wards}.json` support local discovery.
- Community screens are under `src/app/communities/*`; `src/lib/communities/community-service.ts` handles discovery, approval, membership/join requests, posts/comments/likes, and moderation state. Community posts are not ordinary `posts` rows.

### Marketplace contact and checkout

1. Listings are browsed in catalog/explore surfaces and opened under `src/app/marketplace/[id].tsx`; create/edit screens are `src/app/create-for-sale.tsx` and `src/app/marketplace/edit/[id].tsx`. A listing is generally a `posts` row; catalog-item checkout is a separate branch.
2. The item screen can open/create a conversation or route to checkout. Messages use `src/app/chat/[id].tsx` and conversation list state in the tabs.
3. `src/app/checkout/[id].tsx` fetches either a `catalog_items` record (when route type says catalog) or a marketplace post, then posts to `/api/payment/initialize` using `src/lib/network/api.ts`.
4. The API request goes to the `yrdly-app` server. The server is responsible for authorization, provider credentials, authoritative price/total, and transaction initialization. Keep those responsibilities out of client code.
5. Payluk's inline checkout is hosted by `src/components/payments/PaylukCheckout.tsx` inside a WebView. The SDK callback is only a UI event; the app listens for Supabase Realtime changes from the trusted server webhook to see the transaction become paid, with a fallback navigation timeout.
6. The success screen is `src/app/checkout/success.tsx`; transaction history/details, delivery/receipt, dispute, and review screens are under `src/app/transactions/*`.

For checkout changes, inspect the screen, `src/lib/network/api.ts`, matching `yrdly-app/src/app/api/payment/*` and provider webhook, and transaction migrations. The API's `WEB_APP_URL` defaults to production, so confirm environment before any write.

### Events and ticket check-in

- Discovery is included in catalog and event screens; event detail is `src/app/events/[id]/index.tsx`. Event create is `src/app/create-event.tsx`; organizer management is `src/app/events/[id]/manage.tsx`.
- `src/lib/events/event-service.ts` reads normalized events/tickets and keeps fallback support for older event posts. Keep both formats in mind when changing display or lookup code.
- Tickets are listed in `src/app/tickets.tsx`. Event scanning uses `src/app/events/scan.tsx` and `src/app/events/[id]/scan.tsx` with camera permission from `app.config.js`.
- Purchase, payment verification, capacity, cancellation, refunds, and payout may cross into server endpoints in `yrdly-app`. Confirm which app owns each step before changing tickets.

### Businesses, bookings, and transactions

- Business profiles and catalogs live under `src/app/businesses/*`; owners manage services/staff/availability through related business screens.
- `src/lib/bookings/booking-service.ts` reads offerings and calculates possible slots from service duration, weekly schedules, exceptions/blackouts, and existing bookings. It creates requests and exposes confirm/decline/cancel/complete/no-show/review operations.
- Booking entry screens are `src/app/bookings/create.tsx`, with lists/details in `src/app/bookings/*`. Quotes, deposit/full payment, escrow, cancellation limits, no-show strikes, and review eligibility affect the lifecycle.
- Transaction list/detail and dispute/review routes live in `src/app/transactions/*`. The data is `escrow_transactions`, so do not edit status fields optimistically without checking webhooks/database rules.

### Chat, notifications, safety, and offline support

- Chat UI is `src/app/chat/[id].tsx`; conversation list/unread state is in tab layout and `src/lib/offline/active-chat-tracker.ts`. Message RLS and Realtime behavior matter alongside the screen.
- Push registration/handling is in `src/hooks/notifications/use-push-notifications.ts`; notification routing, badges, services, and Edge Functions connect device tokens to delivery. Keep push tap destinations aligned with actual Expo Router paths and deep links.
- Alerts, blocks, reports, moderation, disputes, and admin screens are top-level routes and `(admin)` routes. Screen visibility is not the security boundary; enforce permissions in Supabase policies or trusted server APIs.
- Offline handling includes NetInfo, profile caching, and `src/components/OfflineBanner.tsx`. Consider resume/reconnect behavior when adding network-dependent actions.

## Native-specific boundaries

- `EXPO_PUBLIC_*` is bundled into the client. Never store service-role, payment, or other server secrets there.
- Android EAS builds use the ignored local `google-services.json` by default; set the EAS file variable `GOOGLE_SERVICES_JSON` for each build environment to supply it in cloud builds.
- `app.config.js` owns iOS/Android links, permission declarations, plugin config, Maps, notifications, and Expo module setup. Keep permission text and capabilities matched to the feature and both platforms.
- Follow local patterns for Expo Router typed routes, Reanimated/worklets, Unistyles, keyboard/safe area, and native module usage. Native/plugin changes may require rebuilding the app; Expo web does not validate native behavior.
- `EXPO_PUBLIC_WEB_APP_URL` can redirect API calls to preview/dev, but defaults to `https://app.yrdly.ng`. Confirm target environment before testing mutating flows.

## How Claude Code should investigate a change

1. Trace from the `src/app` screen to component/hook/service. Determine whether it calls Supabase directly or `api` to the web app.
2. For `api` calls, follow `src/lib/network/api.ts` to the matching Next.js handler in `yrdly-app`; check auth header, response shape, retry, and error handling.
3. For shared data, inspect types, both client services, web implementation, migration/RLS/trigger, and Edge Functions as applicable. Compare migration copies before changing shared schema behavior.
4. For native work, inspect `app.config.js` and platform behavior. Consider permissions, app resume, offline state, keyboard/safe areas, and deep-link entry.
5. Check `git status` before editing and preserve in-progress changes. Keep web/mobile behavior aligned when changing a shared user journey.

## Commands and validation

- Run here: `pnpm start`, `pnpm ios`, `pnpm android`, `pnpm web`, `pnpm lint`, `pnpm format:check`, and the configured E2E smoke command when requested.
- EAS development/production profiles use Node 22 and pnpm 11 per `eas.json`.
- A native plugin or permission change needs native build validation; web rendering cannot validate native module behavior.
- Do not run destructive database scripts against production. Never print or commit local environment secrets.
