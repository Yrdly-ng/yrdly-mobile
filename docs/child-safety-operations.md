# YRDLY child-safety operations

Prepared 26 October 2026. This is the operating procedure for the proposed child-safety release. It becomes operational only when the named owners, coverage, legal route and access checks below are completed. A published policy or an 18+ declaration alone does not establish readiness.

## Ownership and launch record

This is an internal operations document. Keep access limited to YRDLY staff with a need to know; do not copy the staff contacts into the public child-safety page or user-facing app.

| Responsibility | Required before launch | Status |
| --- | --- | --- |
| Child-safety lead | Victor Salami · victorsalami@yrdly.ng | Named by YRDLY; role acceptance, authority, Play Console entry and access to verify |
| Backup | Opiah David · Opiahdavid@yrdly.ng | Named by YRDLY; role acceptance and equivalent escalation access to verify |
| Additional escalation contact | Boluwatife Lasisi · boluwatifelasisi@yrdly.ng | Named by YRDLY; role acceptance, coverage and access to verify |
| Duty coverage | Named primary/backup schedule, handoff route and mailbox/queue monitoring | Awaiting company assignment |
| Legal escalation | Adviser confirms applicable preservation, authority-reporting and retention requirements for YRDLY and launch countries | Unconfirmed |
| Public contact | `support@yrdly.ng` is monitored and child-safety messages reach the lead/backup | Delivery/coverage to verify |
| Enforcement operator | Authorized person can restrict accounts and content using reviewed server controls; actions are audited | Access and drill to verify |
| Release owner | Confirms public policy, native release and web behavior match the procedure | Unassigned |

The public contact address already used by YRDLY can receive concerns. The Google Play designated contact must be an actual informed individual, not merely an unattended alias. Enter Victor Salami and victorsalami@yrdly.ng in Play Console after he accepts the role and verifies he can receive and act on notices. Keep the backup and additional escalation contact details here and in the restricted operations directory.

## Scope and age policy

Account registration and use of YRDLY's community service are for people aged 18 or older. Public policy, Terms, privacy notices, onboarding and store declarations must agree. An age acknowledgement records the person's declaration; it is not independent age verification. Do not collect identity documents or full dates of birth merely to implement this declaration.

Child-safety standards apply even where the service is intended for adults. They cover posts, replies, profiles, images, video, messages, communities, events, listings and behavior using YRDLY to arrange contact elsewhere. Reports of an underage account should enter the same safety process without inviting the reporter to gather identity documents or contact the child.

## Intake

1. Accept concerns through the in-app report flow or the published support address. Do not require the reporter to prove abuse before accepting a concern.
2. Capture a report ID, received time, relevant account/content/conversation identifiers, a short factual description, and any immediate-danger indication. Keep the original item referenced in its controlled source system where legally appropriate.
3. Do not ask people to download, screenshot, forward or reupload suspected child sexual abuse imagery. For this category, request identifiers and a text description instead of image attachments.
4. Confirm receipt without disclosing another person's identity or promising a specific outcome. A submission acknowledgement means saved for review, not investigated or resolved.
5. Confirm the report is visible to an authorized reviewer. Failed queue reads or writes are operational errors; an error must not look like an empty or completed queue.

## Triage and coverage

The following are proposed internal targets to approve and staff before launch. They are not statutory deadlines or public service promises. A coverage gap requires immediate escalation to the lead/backup; do not silently wait for the next routine review.

| Priority | Examples | Proposed response |
| --- | --- | --- |
| Critical | Credible immediate danger, suspected ongoing exploitation, or suspected CSAM | Alert duty lead and backup immediately; aim for initial trained review within one hour of receipt with coverage arranged outside ordinary hours |
| High | Grooming, sexual coercion/extortion, attempted sexual contact with a minor, suspected underage account | Prioritize the same day; reassess immediately if new information indicates immediate danger |
| Routine | Other harassment, spam or general policy concerns | Review through normal moderation with an assigned owner and due date |

Reviewers should not require certainty before making a protective restriction. A report alone is not proof of a violation; restrictions and escalation must consider available facts, safety, and the possibility of mistaken reports.

## Response and enforcement

1. Assess immediate safety. Where someone may be in immediate danger, advise contacting local emergency services and use the company's approved emergency escalation route. YRDLY is not an emergency service.
2. Assign a trained reviewer and a case owner. Do not investigate on a personal device, contact a suspected child for evidence, impersonate a user, or conduct an undercover conversation.
3. Use approved server controls to restrict access to suspected abusive content and prevent further harmful contact when appropriate. Preserve only what the confirmed legal procedure requires before irreversible deletion. Public removal and legally required preservation are separate actions.
4. Route suspected exploitation or CSAM to the child-safety lead promptly. Only trained authorized personnel should access sensitive evidence, using controlled tools without automatic image previews or routine copies.
5. The lead follows the confirmed legal reporting route. Record the authority, time, reference and authorized action when reporting is required. Google identifies NCMEC or a relevant regional authority in its policy; do not assume a particular route or reporting duty applies to YRDLY without jurisdiction-specific confirmation.
6. Apply the appropriate account/content action and record who approved it and why. Escalate limitations in current tools to engineering; do not represent a queue status change as content removal or account suspension.
7. Tell the reporter the concern was reviewed and action was taken where appropriate, without sharing private case details. Notify the affected account only when doing so is safe, permitted and consistent with the investigation. Allow appeals through the published support channel; where practical, a different reviewer handles the appeal.

## Evidence, privacy and access

**Current tool limits and controls:** mobile admins can now hide a reported post from other viewers, or suspend/ban a linked account, directly from an open child-safety report. The report form carries the post/account identifier into the case. The app calls authenticated server endpoints; the server checks admin authority and writes actions with audit records. Review the report first. Reports without linked targets cannot be used to act on content/accounts inferred from free text. Hiding a post does not establish that its underlying media object is inaccessible or deleted. The mobile inbox does not resolve or dismiss reports; keep case outcome tracking in the web moderation workspace.

The shared database session gate now checks suspension/ban status, so an already-issued session is denied on RLS paths that use that gate. Production requires `20261026170603_enforce_account_suspension_in_active_sessions.sql`, `20261026170833_add_audited_account_moderation_actions.sql`, and `20261026180520_enable_reported_child_safety_post_takedowns.sql`, plus the web API release. Follow the product repository's production-history procedure; do not apply these migrations directly from a development checkout. Reported-comment removal is available. Full removal coverage for every user-content type and associated media has not been demonstrated. Keep these content-removal gaps open until the responsible operator verifies the controls and access result across feeds, direct links, search, chat and media.

- Store case records only in the approved access-controlled moderation/case system. Do not put evidence, reporter contact details, signed media URLs or sensitive case notes in Git, analytics, ordinary chat, issue trackers or public bug reports.
- Grant case access only to people assigned to this work. Review access at onboarding, role changes and departures. Community volunteers should escalate potential child exploitation to YRDLY staff rather than receive unrestricted sensitive case access.
- Record minimal case metadata: ID, owner, severity, timestamps, source identifiers, decisions, authority-report reference where applicable, notification status and appeal outcome. Keep case attachments separate from general telemetry.
- The legal/data-protection owner must approve retention periods, preservation holds and deletion rules before launch. Remove unnecessary copies; do not arbitrarily destroy material subject to a lawful preservation requirement.
- Support/report screens should mask sensitive inputs in native session replay. Verify this on real devices before distribution.

## Training and verification drill

Use synthetic text, harmless placeholder images and isolated test accounts. Never use real abusive imagery to test filtering or reporting.

1. Submit a child-safety report from a chat/profile and a general report from Settings. Verify saved context, child-safety classification, failure recovery and duplicate-tap protection.
2. Confirm child-safety image attachment is unavailable and a previously selected general attachment cannot be sent after changing the category.
3. Verify both the lead and backup can find the report; an ordinary account cannot read other people's reports or staff case notes.
4. Practice a critical-case handoff, including an unavailable primary owner, with the approved internal contact route. Do not send a fictional emergency to authorities.
5. Restrict harmless test content/account through approved controls and verify it is no longer reachable through direct links, feeds, search, chats and media access as applicable. Blocking must prevent unwanted messaging through server enforcement, not just hide a screen.
6. Exercise mistaken-report review, an appeal and a suspected underage account. Confirm protective restrictions remain while review is pending where appropriate.
7. Verify declarations and age prompts for new/existing/social accounts, account switching, deep links and offline failures. Support, safety reporting and deletion must stay accessible when a person declines updated terms.
8. Run on iPhone and Android release candidates. Check relevant web flows too; a mobile declaration does not independently enforce age eligibility on the web or direct APIs.

Record the date, version, testers, pass/fail results and unresolved findings privately. Automated tests support this drill but cannot establish staffed coverage, authority-reporting readiness or native behavior.

## Go-live evidence

- Public `https://yrdly.ng/child-safety` loads without login, names YRDLY, explicitly prohibits CSAE/CSAM, and has working reporting and appeal instructions.
- Terms, privacy policy, app links, age acknowledgements and store age/content declarations agree.
- Named lead/backup accept responsibility; mailbox and queue delivery, monitoring, permission checks and coverage handoff pass.
- Mobile post-hide and suspension/ban actions, audit records and the shared session gate pass with isolated synthetic accounts after the migrations and web API are deployed.
- Legal reporting/preservation/retention procedure is confirmed and staff can access the required approved channel.
- Existing content filtering and staff enforcement controls are verified for all supported content types; gaps are documented and addressed before claiming coverage.
- Native/web drills pass; actual rollout versions and signed artifacts are recorded.
- Store owner enters the published standards URL, named contact and truthful child-safety declarations in Play Console. Do not certify unverified operations based solely on this document.

After launch, review urgent backlog and unassigned reports during every handoff. Review response times, missed targets, repeat offenders, appeals and access controls weekly during the initial rollout, then set a documented review cadence.

## Sources

- [Google Play child-safety standards](https://support.google.com/googleplay/android-developer/answer/14747720)
- [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Apple App Review Guidelines, section 1.2](https://developer.apple.com/app-store/review/guidelines/)
