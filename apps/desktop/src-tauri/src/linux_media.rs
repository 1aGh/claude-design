// linux_media.rs — issue #105.
//
// WebKitGTK plays a canvas's <audio>/<video> through GStreamer, and two
// properties of that stack turn a design canvas into a dead renderer on Linux.
// Both present to the user identically — the window appears, the canvas starts
// loading, the view goes blank — with nothing in the UI naming a cause.
//
//   1. MISSING AUDIO SINK. `gst-plugins-good` (which carries the `autodetect`
//      plugin, and therefore `autoaudiosink`) is only an OPTIONAL dependency of
//      webkit2gtk on Arch and most non-Debian distros. Without it
//      `MediaPlayerPrivateGStreamer::createAudioSink()` hits a RELEASE_ASSERT
//      and aborts the entire web process. WebKit clearly meant this to be a soft
//      failure — the very next line is a now-dead `if (!audioSink) return
//      nullptr;` — but the assert wins. We cannot patch WebKit from here, so we
//      detect the missing plugin and SAY so, with the install command for the
//      distro we're actually on.
//
//      For the .deb channel this is fixed properly instead: `bundle.linux.deb.
//      depends` in tauri.conf.json now names the plugin packages, so apt pulls
//      them in and this check never fires. The check is for every other channel
//      (the AUR repack, a hand-extracted .deb, a distro that vendors its own
//      package) where nothing declares that dependency on our behalf.
//
//   2. GL SINK ON radeonsi. With the plugins present, playback gets further and
//      then dies again: `gst-gl` asks for a colour-buffer format the AMD driver
//      rejects ("radeonsi: error: si_state.c: Invalid CB format: 133, disabling
//      CB"), and the subsequent `gst_gl_memory_read_pixels` faults — SIGBUS on
//      the `gstglcontext` thread. Under VRAM pressure the same path aborts
//      outright from inside libgallium. This is an upstream Mesa/gst-gl bug, not
//      ours, but WebKit ships the escape hatch for exactly it:
//      WEBKIT_GST_DISABLE_GL_SINK=1 routes video frames through system memory.
//      We set it when an AMD GPU is present, and never when the user has already
//      expressed a preference — setting it to `0` is how you ask for the GL sink
//      back.
//
// Everything here is Linux-only; the module is not compiled elsewhere.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

/// WebKitGTK's own opt-out for the GStreamer GL video sink. Read by the WEB
/// process, which inherits our environment — so this must be set before the
/// webview is created, i.e. before the Tauri builder runs.
const GL_SINK_ENV: &str = "WEBKIT_GST_DISABLE_GL_SINK";

/// PCI vendor id for AMD/ATI. `/sys/class/drm/*/device/vendor` reports it for
/// both `amdgpu` and the older `radeon` — both of which land on Mesa's radeonsi
/// or r600 gallium driver, which is where the gst-gl fault lives.
const PCI_VENDOR_AMD: &str = "0x1002";

/// The shared object that carries `autoaudiosink`. Ships in gst-plugins-good on
/// every distro that splits GStreamer up, which is all of them. Its presence is
/// the cheapest honest proxy for "WebKit will find an audio sink" that does not
/// require linking GStreamer into this binary.
const AUDIO_SINK_PLUGIN: &str = "libgstautodetect.so";

// ── GPU detection ────────────────────────────────────────────────────────────

/// True when any DRM node under `drm_root` reports the AMD PCI vendor id.
///
/// Takes the root as a parameter rather than hardcoding `/sys/class/drm` so the
/// decision is testable against a fixture tree.
fn amd_gpu_present_in(drm_root: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(drm_root) else {
        return false;
    };
    for entry in entries.flatten() {
        let vendor = entry.path().join("device").join("vendor");
        let Ok(raw) = std::fs::read_to_string(&vendor) else {
            continue;
        };
        if raw.trim().eq_ignore_ascii_case(PCI_VENDOR_AMD) {
            return true;
        }
    }
    false
}

// ── GStreamer plugin detection ───────────────────────────────────────────────

/// Every directory GStreamer might load plugins from, in ADDITIVE form: the
/// standard system paths for the distros we know about, plus whatever the
/// environment names.
///
/// Deliberately a superset rather than a faithful reproduction of GStreamer's
/// own search order (where `GST_PLUGIN_SYSTEM_PATH_1_0`, when set, REPLACES the
/// defaults). The bias is intentional and one-directional: searching extra
/// directories can only ever suppress a warning, never invent one, and a false
/// "your media stack is broken" told to a user whose stack is fine is the worse
/// failure of the two.
fn plugin_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    for var in [
        "GST_PLUGIN_SYSTEM_PATH_1_0",
        "GST_PLUGIN_PATH_1_0",
        "GST_PLUGIN_SYSTEM_PATH",
        "GST_PLUGIN_PATH",
    ] {
        if let Ok(value) = std::env::var(var) {
            dirs.extend(
                value
                    .split(':')
                    .filter(|p| !p.is_empty())
                    .map(PathBuf::from),
            );
        }
    }

    // `<libdir>/gstreamer-1.0` for the three libdir conventions in the wild:
    // plain (Arch), 64-suffixed (Fedora/openSUSE), multiarch (Debian/Ubuntu).
    let multiarch = format!("{}-linux-gnu", std::env::consts::ARCH);
    for lib in [
        "/usr/lib".to_string(),
        "/usr/lib64".to_string(),
        format!("/usr/lib/{multiarch}"),
        "/usr/local/lib".to_string(),
        "/usr/local/lib64".to_string(),
        format!("/usr/local/lib/{multiarch}"),
    ] {
        dirs.push(PathBuf::from(lib).join("gstreamer-1.0"));
    }

    if let Ok(home) = std::env::var("HOME") {
        dirs.push(
            PathBuf::from(home)
                .join(".local/share/gstreamer-1.0")
                .join("plugins"),
        );
    }

    dirs
}

/// True when `file` exists in any of `dirs`.
fn has_plugin_in(dirs: &[PathBuf], file: &str) -> bool {
    dirs.iter().any(|dir| dir.join(file).exists())
}

// ── Distro-specific remediation ──────────────────────────────────────────────

/// The install command for the distro `os_release` describes, keyed off
/// `ID` and then `ID_LIKE` so derivatives (Omarchy, Mint, Pop, Nobara) inherit
/// their base's command instead of falling through to the generic line.
fn install_hint_from(os_release: &str) -> &'static str {
    let mut ids: Vec<String> = Vec::new();
    for line in os_release.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim().trim_matches('"').to_ascii_lowercase();
        match key.trim() {
            "ID" => ids.insert(0, value),
            "ID_LIKE" => ids.extend(value.split_whitespace().map(str::to_string)),
            _ => {}
        }
    }

    for id in &ids {
        match id.as_str() {
            "arch" | "archlinux" | "manjaro" | "endeavouros" => {
                return "sudo pacman -S --needed gst-plugins-good gst-plugins-bad gst-libav"
            }
            "debian" | "ubuntu" => {
                return "sudo apt install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav"
            }
            "fedora" | "rhel" | "centos" => {
                return "sudo dnf install gstreamer1-plugins-good gstreamer1-plugins-bad-free gstreamer1-libav"
            }
            "opensuse" | "suse" | "opensuse-tumbleweed" | "opensuse-leap" => {
                return "sudo zypper install gstreamer-plugins-good gstreamer-plugins-bad gstreamer-plugins-libav"
            }
            _ => {}
        }
    }

    "install your distro's gst-plugins-good package (plus gst-plugins-bad and gst-libav for video codecs)"
}

fn install_hint() -> &'static str {
    match std::fs::read_to_string("/etc/os-release") {
        Ok(text) => install_hint_from(&text),
        Err(_) => install_hint_from(""),
    }
}

// ── Entry points ─────────────────────────────────────────────────────────────

/// What to do about the GL sink, given the user's current preference and
/// whether an AMD GPU is present. `None` = leave the environment alone.
///
/// Split out from `configure_env` so the policy is testable without mutating
/// this process's environment.
fn gl_sink_decision(current: Option<&str>, amd_present: bool) -> Option<&'static str> {
    // ANY existing value wins, including "0". A user who has been bitten by
    // this once and set it, and a user who wants the GL sink back on hardware
    // we would otherwise blanket-disable, are the same case: they told us.
    if current.is_some() {
        return None;
    }
    if amd_present {
        return Some("1");
    }
    None
}

/// Set `WEBKIT_GST_DISABLE_GL_SINK` when this machine is in the failure envelope.
///
/// MUST be called before the Tauri builder — WebKit reads it in the web process,
/// which inherits the environment we have at webview-creation time. Also relies
/// on being called while still single-threaded (`set_var` is not thread-safe).
pub fn configure_env() {
    let current = std::env::var(GL_SINK_ENV).ok();
    let amd = amd_gpu_present_in(Path::new("/sys/class/drm"));
    // Bound in its own statement, not inline in the `match` scrutinee: a
    // scrutinee temporary (`current.as_deref()`'s borrow of `current`) lives to
    // the end of the match, which would collide with the arm below consuming
    // `current`.
    let decision = gl_sink_decision(current.as_deref(), amd);

    match decision {
        Some(value) => {
            std::env::set_var(GL_SINK_ENV, value);
            eprintln!(
                "[maude] AMD GPU detected — setting {GL_SINK_ENV}={value} (issue #105: gst-gl \
                 on radeonsi faults during pixel readback). Set it yourself to override; \
                 {GL_SINK_ENV}=0 keeps the GL sink."
            );
        }
        None => {
            if let Some(v) = current {
                eprintln!("[maude] {GL_SINK_ENV}={v} already set — leaving it alone");
            }
        }
    }
}

/// Tell the user when the GStreamer stack cannot play media, instead of letting
/// WebKit's RELEASE_ASSERT take the renderer down the moment a canvas contains
/// an <audio>/<video> element.
///
/// Best-effort and non-blocking by design: it fires at most once per launch, it
/// never gates startup, and a machine with no notification daemon still gets the
/// same text on stderr. A modal here would punish every Linux user who opens a
/// project with no media in it.
pub fn warn_if_incomplete(app: &AppHandle) {
    if has_plugin_in(&plugin_dirs(), AUDIO_SINK_PLUGIN) {
        return;
    }
    let hint = install_hint();
    eprintln!(
        "[maude] WARN: no GStreamer audio sink found ({AUDIO_SINK_PLUGIN} is missing from every \
         plugin path). A canvas containing audio or video will kill the view with no message \
         (issue #105). Fix: {hint}"
    );
    crate::notify::send_system_notice(
        app,
        "Maude can't play media yet",
        &format!("A GStreamer plugin is missing, so canvas audio and video will fail. Fix: {hint}"),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A throwaway `/sys/class/drm` lookalike. Same shape as `server_json.rs`'s
    /// fixtures (a named dir under the system temp, wiped first) so the crate
    /// keeps a single temp-dir convention and no new dependency.
    fn drm_fixture(name: &str, vendors: &[(&str, &str)]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("maude-linux-media-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        for (card, vendor) in vendors {
            let device = dir.join(card).join("device");
            std::fs::create_dir_all(&device).expect("temp dir");
            std::fs::write(device.join("vendor"), format!("{vendor}\n")).expect("write vendor");
        }
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn amd_gpu_detected_on_a_hybrid_machine() {
        // The reported machine: Intel UHD 630 + AMD Baffin. The AMD half is the
        // one whose driver faults, and it is not card0.
        let dir = drm_fixture("hybrid", &[("card1", "0x8086"), ("card2", "0x1002")]);
        assert!(amd_gpu_present_in(&dir));
    }

    #[test]
    fn no_amd_gpu_on_an_intel_only_machine() {
        let dir = drm_fixture("intel-only", &[("card0", "0x8086")]);
        assert!(!amd_gpu_present_in(&dir));
    }

    #[test]
    fn nvidia_is_not_mistaken_for_amd() {
        let dir = drm_fixture("nvidia", &[("card0", "0x10de")]);
        assert!(!amd_gpu_present_in(&dir));
    }

    #[test]
    fn missing_drm_root_is_not_an_amd_machine() {
        assert!(!amd_gpu_present_in(Path::new("/definitely/not/here")));
    }

    #[test]
    fn a_node_without_a_vendor_file_is_skipped_not_fatal() {
        let dir = drm_fixture("no-vendor-file", &[("card0", "0x1002")]);
        std::fs::create_dir_all(dir.join("version")).expect("temp dir");
        assert!(amd_gpu_present_in(&dir));
    }

    #[test]
    fn gl_sink_disabled_on_amd_when_unset() {
        assert_eq!(gl_sink_decision(None, true), Some("1"));
    }

    #[test]
    fn gl_sink_untouched_without_amd() {
        assert_eq!(gl_sink_decision(None, false), None);
    }

    #[test]
    fn an_existing_value_always_wins() {
        // Including "0" — that IS the way to ask for the GL sink back on
        // hardware we would otherwise disable it on.
        assert_eq!(gl_sink_decision(Some("0"), true), None);
        assert_eq!(gl_sink_decision(Some("1"), false), None);
        assert_eq!(gl_sink_decision(Some(""), true), None);
    }

    #[test]
    fn plugin_found_in_any_searched_dir() {
        let dir = std::env::temp_dir().join("maude-linux-media-test-plugins");
        let _ = std::fs::remove_dir_all(&dir);
        let libdir = dir.join("gstreamer-1.0");
        std::fs::create_dir_all(&libdir).expect("temp dir");
        std::fs::write(libdir.join(AUDIO_SINK_PLUGIN), b"").expect("write plugin");

        let dirs = vec![PathBuf::from("/nope"), libdir];
        assert!(has_plugin_in(&dirs, AUDIO_SINK_PLUGIN));
        assert!(!has_plugin_in(&dirs, "libgstsomethingelse.so"));
    }

    #[test]
    fn plugin_dirs_cover_the_three_libdir_conventions() {
        let dirs = plugin_dirs();
        let has = |p: &str| dirs.iter().any(|d| d == Path::new(p));
        assert!(has("/usr/lib/gstreamer-1.0"), "arch-style libdir");
        assert!(has("/usr/lib64/gstreamer-1.0"), "fedora-style libdir");
        assert!(
            dirs.iter()
                .any(|d| d.to_string_lossy().contains("-linux-gnu/gstreamer-1.0")),
            "debian-style multiarch libdir"
        );
    }

    #[test]
    fn install_hint_per_distro() {
        assert!(install_hint_from("ID=arch\n").starts_with("sudo pacman"));
        assert!(install_hint_from("ID=ubuntu\nID_LIKE=debian\n").starts_with("sudo apt"));
        assert!(install_hint_from("ID=fedora\n").starts_with("sudo dnf"));
        assert!(install_hint_from("ID=opensuse-tumbleweed\n").starts_with("sudo zypper"));
    }

    #[test]
    fn derivatives_inherit_their_base_command() {
        // Omarchy is Arch underneath; Mint is Ubuntu underneath. Neither ID is
        // one we enumerate, so ID_LIKE is what has to carry them.
        assert!(install_hint_from("ID=omarchy\nID_LIKE=arch\n").starts_with("sudo pacman"));
        assert!(
            install_hint_from("ID=linuxmint\nID_LIKE=\"ubuntu debian\"\n").starts_with("sudo apt")
        );
    }

    #[test]
    fn id_wins_over_id_like() {
        // A quoted ID and a conflicting ID_LIKE — the concrete distro decides.
        assert!(install_hint_from("ID_LIKE=debian\nID=\"fedora\"\n").starts_with("sudo dnf"));
    }

    #[test]
    fn unknown_distro_gets_a_generic_but_actionable_line() {
        let hint = install_hint_from("ID=plan9\n");
        assert!(hint.contains("gst-plugins-good"), "{hint}");
        assert!(!hint.starts_with("sudo"), "{hint}");
    }
}
