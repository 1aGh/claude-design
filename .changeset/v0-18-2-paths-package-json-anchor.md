---
"@1agh/maude": patch
---

`fix(dev-server)`: paths.ts walk-up no longer requires package.json anchor

v0.18.1 shipped `paths.ts` to resolve real disk install root via `process.execPath` walk-up — but the `isDevServerDir()` check required BOTH `http.ts` AND `package.json` to be present. Turns out npm excludes nested workspace `package.json` files from the published tarball by default, so `plugins/design/dev-server/package.json` is absent in every npm install. The walk-up silently fell through to the virtual `/$bunfs/root`, self-heal then reported `dist/client.bundle.js` and `dist/runtime/react.js` missing (against the virtual path), and printed an unhelpful reinstall hint to a user whose install was actually correct.

Fix: drop the `package.json` check. `http.ts` alone is a sufficient anchor — process.execPath walk-up only traverses node_modules layers above the binary, so false-match risk from a stray `http.ts` somewhere in the user's tree is negligible.

Verified end-to-end against a real npm install of v0.18.1: replaced the binary in `~/.nvm/.../node_modules/@1agh/maude/node_modules/@1agh/maude-darwin-arm64/maude` with the fix, ran `maude design serve` in a fresh scratch project, server booted without self-heal warnings, `/_client/client.bundle.js` + `/_canvas-runtime/react.js` + `/_canvas-runtime/react-dom_client.js` all returned 200. Greenfield `npm i -g @1agh/maude` is now actually clean.

(Bonus deferred: `canvas-lib-resolver.ts` still uses `import.meta.url` for `fs.watch`, which logs a benign ENOENT warning against `/$bunfs/root/canvas-lib.tsx` in compiled binaries — doesn't block boot but should adopt `paths.ts` in a follow-up.)
