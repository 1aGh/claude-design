fn main() {
    // Declare the app commands in the ACL manifest so they can be GRANTED to the
    // remote dev-server origin in a capability (Phase 28 / DDR-108). Tauri v2 rejects
    // custom-command invokes from a remote (non-local) origin unless the resolved ACL
    // allows the command; declaring them here generates per-command `allow-*`
    // permissions the capability references.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "github_sign_in",
                "github_open_verification",
                "github_is_signed_in",
                "github_sign_out",
                "pick_directory",
                "open_local_project",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
