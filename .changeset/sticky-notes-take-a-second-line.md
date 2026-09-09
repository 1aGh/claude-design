---
"@1agh/maude": patch
---

Fix Shift+Enter not giving you a new line in a whiteboard sticky note (issue #106). The report was "nefunguje shift+enter na novy radek ve sticky note", and the keystroke was never the problem — the editor passes it straight to the browser, and it inserts the break correctly in both Chrome and Safari. Three separate things then took the line away again, and any one of them alone looks exactly like "Shift+Enter does nothing".

**A sticky now grows to fit its text instead of clipping it.** A note's size was fixed when you dropped it and nothing ever changed it, while the body is clipped at the card's edge — so past about nine lines every further line simply wasn't drawn. On a note that was already full, Shift+Enter inserted the line and then hid it: nothing moved on screen. The note now grows as you type, and the commit keeps whatever height the text actually needed. It only ever grows, so a note you deliberately made roomy stays that way.

**Shift+Enter adds a line instead of eating the note.** Opening a sticky from the keyboard (select it, press Enter) selects all of its text, so you can retype it — which is right for a typed character and wrong for Shift+Enter, where the break replaced everything and left one blank line behind. Typing still replaces; Shift+Enter now appends. Your own partial selection is untouched, so replacing the words you highlighted works as before. The same fix covers shape labels and standalone text.

**A collaborator's edit no longer overwrites the note you have open.** On a project synced to a workspace, someone else committing to the same sticky while you were editing it replaced your live text mid-keystroke — your uncommitted words and line breaks gone, with nothing to undo. What you have typed now stays put until you commit it, while everything arriving from your collaborator — their text included — is still applied to the project exactly as before.
