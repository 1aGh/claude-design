---
"@1agh/maude": minor
---

**You can take your project and go.** A hosted project can produce a complete export: every commit and branch of its history as a git bundle you open with `git clone`, a manifest of every media file with its size, and a README in plain language.

The README says what the export does *not* contain as prominently as what it does — the media bytes are listed rather than enclosed, because an export big enough to be expensive is one nobody takes. It also tells you how to tell a bad download from a bad archive.

This is what makes deleting a project safe: Maude has always refused to erase a project that has not been exported, and now there is something real behind that refusal.
