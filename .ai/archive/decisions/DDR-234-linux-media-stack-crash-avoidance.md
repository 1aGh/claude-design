# DDR-234: On Linux, Maude owns the GStreamer failure envelope — it declares the plugins, sets the driver workaround, and names what is missing

**Status:** Implemented — closes [#105](https://github.com/1aGh/maude/issues/105).
**Relates:** [DDR-106](DDR-106-tauri-v2-native-shell-architecture.md) (the native shell this runs inside), [DDR-126](DDR-126-native-distribution-auto-update-and-security-posture.md) (the distribution channels a dependency declaration reaches, and the ones it doesn't), [DDR-128](DDR-128-first-open-readiness-check-detect-and-guide.md) (detect-and-guide: say what is missing, name the command, don't fail silently).
**Instruments:** `apps/desktop/src-tauri/src/linux_media.rs`, `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/src/notify.rs`, `apps/desktop/src-tauri/tauri.conf.json`, `site/content/docs/desktop/index.mdx`.

## Context

macOS and Windows render a canvas's `<audio>`/`<video>` through an OS media framework that is simply present. Linux renders through WebKitGTK, which plays media through **GStreamer** — a stack that is split across packages, optional in most distros' WebKitGTK dependency lists, and layered on a GPU driver. Two independent failures live there, and the second only becomes reachable once the first is fixed. Both present to the user identically: the window opens, the canvas starts loading, the view goes blank. Nothing in the UI names a cause; it took a symbolized core dump to tell them apart.

**1 — No audio sink is a hard abort, not a silent track.** `gst-plugins-good` carries the `autodetect` plugin, hence `autoaudiosink`. It is an *optional* dependency of `webkit2gtk-4.1` on Arch and most non-Debian distros, so nothing pulls it in. Without it `createPlatformAudioSink()` returns null and `MediaPlayerPrivateGStreamer::createAudioSink()` hits a `RELEASE_ASSERT` — the whole web process aborts. WebKit plainly intended a soft failure here; the line immediately after the assert is a now-unreachable `if (!audioSink) return nullptr;`. We cannot patch that. Reproduced deterministically on the reporter's machine: two crashes, byte-identical stacks.

**2 — The GL video sink faults on radeonsi.** With the plugins installed, playback gets further and dies again. `gst-gl` asks for a colour buffer the AMD driver rejects (`radeonsi: error: si_state.c:2309 … Invalid CB format: 133, disabling CB`), and the readback that follows faults: `SIGBUS`/`BUS_ADRERR` inside `gst_gl_memory_read_pixels` on the `gstglcontext` thread. This is an upstream Mesa/gst-gl bug. Diagnosing #105 on a second machine (Intel UHD 630 + AMD Baffin, mesa 26.2.1) found the same path failing a second way: under VRAM pressure `amdgpu` logs `pin failed` / `Not enough memory for command submission!` and libgallium aborts outright. Different signal, same component, same env-var escape hatch.

## Decision

**1. The `.deb` declares the plugins it needs.** `bundle.linux.deb.depends` names `gstreamer1.0-plugins-good`, `-bad` and `-libav` (Tauri appends these to its auto-generated `libwebkit2gtk-4.1-0` / `libgtk-3-0`). For the channel we actually ship, apt now makes failure 1 unreachable.

**2. Detection covers the channels a dependency declaration cannot reach.** A repacked `.deb`, a distro package, an extracted tree — none of them inherit our `Depends`. At startup on Linux the shell looks for `libgstautodetect.so` across every plugin directory GStreamer might use, and when it is absent says so on stderr **and** as one OS notification, quoting the install command for the distro `/etc/os-release` names (Arch, Debian/Ubuntu, Fedora, openSUSE, and derivatives via `ID_LIKE`). Best-effort and non-blocking — a machine with no notification daemon still gets the stderr line.

**3. On an AMD GPU, Maude sets `WEBKIT_GST_DISABLE_GL_SINK=1` for itself.** Gated on the AMD PCI vendor id (`0x1002`) appearing under `/sys/class/drm/*/device/vendor` — the driver the fault is in, read directly, no probing and no guessing. The cost is software video decode.

**4. Any value the user set wins, including `0`.** `WEBKIT_GST_DISABLE_GL_SINK=0` is how you ask for the GL sink back on hardware we would otherwise disable it on. Maude only fills the variable in when the user has expressed no preference, and logs whichever branch it took.

## Alternatives rejected

- **Document the workaround and stop there** (the issue's first suggestion). A crash with no message on first run is not something a docs page reaches in time — the user has already lost the window. Documented *as well*, not *instead*.
- **Set the variable on all of Linux.** Simplest, and wrong: it hands every NVIDIA and Intel user a software video path to fix a bug in a driver they are not running. Reading one `sysfs` file per DRM node is cheap enough that the blunt version buys nothing.
- **Gate on *hybrid* AMD** — the exact reported hardware (Intel + AMD Baffin). Rejected: hybrid is not in the causal chain. The stack faults inside radeonsi's pixel readback; a single-GPU AMD machine has the same driver and the same bug, and would have kept crashing silently with no way to discover why.
- **Detect `radeonsi` by probing GL / parsing `glxinfo`.** More precise in principle, but it means spawning a process or initialising a GL context during startup, on the path whose whole point is not to blow up. The vendor id is one file read and cannot hang.
- **Put the missing-plugin warning in the studio readiness list** (`readiness.ts`) instead of the native shell. That list is cross-platform and browser-agnostic; "your WebKitGTK has no GStreamer audio sink" is true of neither Chrome nor macOS, and the shell is the only layer that knows which engine is rendering. Kept native.
- **Route the notice through `send_notification`'s cooldown/cap bookkeeping.** Those bound a repeating signal whose timing untrusted project state can steer (see notify.rs). This is a fixed string with no project content, fired at most once per launch by our own startup path — throttling it could only ever swallow the single line that explains a blank window.
- **Ship the workaround as a wrapper script / `.desktop` `Exec=` prefix.** It would miss every launch that does not go through our `.desktop` entry, and it puts a user-visible incantation in a file distro packagers rewrite.

## Consequences

- Video decodes in software on AMD hardware unless the user opts back in. Acceptable for a design tool showing short canvas clips; stated in the docs with the opt-out.
- `configure_env()` runs before the Tauri builder and calls `std::env::set_var`, which is only sound while single-threaded. It is the first statement in `run()` and must stay there.
- The plugin search is deliberately a **superset** of GStreamer's real search order (where `GST_PLUGIN_SYSTEM_PATH_1_0`, when set, *replaces* the defaults). Searching extra directories can only suppress a warning, never invent one — and a false "your media stack is broken" shown to a user whose stack is fine is the worse of the two failures.
- The AUR repack (`maude-desktop-bin`, which reads the `.deb`'s `Depends`) inherits the fix only if its deb→Arch name mapping knows the `gstreamer1.0-*` names. That PKGBUILD is outside this repo; decision 2 is what covers it regardless.
