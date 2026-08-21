---
'@1agh/maude': patch
---

An invite link to a self-hosted workspace opens a welcome page and signs you in.

Inviting someone to a self-hosted hub mints a link of the form
`https://<workspace>/join/<token>`. Opening it in a browser showed raw JSON —
`{"ok":true,"workspace":…,"needsEmail":false,…}` — and nothing else. The
server half of the invite path was built (mint, look, redeem) for a desktop
deep-link client that never was, and the studio has since become a browser
page at `/` behind a cookie session, so the person on the other end of the
link had a door with no handle.

The link now opens a welcome page: the email is already filled in when the
invite was bound to one, the person chooses a password, and one click creates
the account, consumes the single-use invite, and lands them in the studio
signed in — the same session the workspace's own sign-in page sets. A short
password comes back as the form with a sentence, the invite untouched; an
expired, used or cancelled link is a plain page in plain words. API callers
keep the JSON contract they had. Sessions minted by an invite now also carry
the project role every other door stores, so a freshly invited member is not
met with 401s on the first edit. The plain service pages ("Paused", "You do
not have access", and now "This invitation no longer works") gained the
centred layout they had been missing.

The hub's People view also gained **Approve** on the "Waiting for access"
queue. When the person you invited signs in through your identity provider
instead of the link, they used to sit in that queue with nothing to do: "Link"
wanted an account that did not exist yet, and creating one meant inventing an
initial password for someone who will never type one. Approve creates the
account for the address you confirm, with the role you pick, links that
sign-in to it, and cancels the now-redundant invite — one click. Errors from
the console are shown as sentences, not JSON.

A security review of the new door (defender + attacker) ran before commit and
its findings are fixed in the same change: a mangled invite link — or a
malformed session cookie on any door — no longer takes the hub process down; an identity-provider-only (`strict`) hub refuses
the password redeem, not just hides the form; the form gate fails closed
(same-origin or a matching `Origin`, never same-site); a taken address is one
neutral sentence instead of an account-existence oracle; the server-rendered
pages carry referrer, framing and content-security headers; form bodies have
the same size and time bounds as JSON ones.
