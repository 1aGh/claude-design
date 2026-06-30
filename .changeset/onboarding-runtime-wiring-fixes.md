---
"@1agh/maude": patch
---

Desktop onboarding: a batch of first-run fixes so a new user reaches the studio without dead-ends. The GitHub door now reflects that you're already signed in (shows **Continue**, not "Sign in with GitHub"), and the identity rail stays signed-in across a transient profile-fetch hiccup and updates live the moment sign-in completes — instead of wrongly showing "Sign in" with a valid token. **Cancel** on the GitHub device-code modal now re-enables the button immediately (previously it left the button stuck on "Starting…" until the code expired). **Merge this branch → main** shows a progress spinner while it runs (previously the multi-second checkout+merge+push showed nothing). A failed **Restore saved version** now surfaces an error instead of closing silently. And a freshly-created project is seeded with a neutral starter **Welcome** canvas so the studio opens to a real artboard instead of an empty list.
