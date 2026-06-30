import { browser } from '@wdio/globals';

/**
 * Invoke a Tauri command from inside the webview — the DOM-driven way to exercise
 * native-shell behavior (menu actions, project switch, …) WITHOUT clicking native
 * chrome (no computer-use). e.g. `invokeTauri('open_local_project', { path })`.
 *
 * Only works when running in the real native shell (`window.__TAURI__` present).
 */
export async function invokeTauri<T = unknown>(
  cmd: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  return browser.execute(
    (c: string, a: Record<string, unknown>) => {
      // biome-ignore lint/suspicious/noExplicitAny: __TAURI__ is an injected global
      const tauri = (window as any).__TAURI__;
      if (!tauri?.core?.invoke) {
        throw new Error('window.__TAURI__ not present — not running in the native shell?');
      }
      return tauri.core.invoke(c, a);
    },
    cmd,
    args
  ) as Promise<T>;
}

/** True when the webview is running inside the native Tauri shell. */
export async function isNativeShell(): Promise<boolean> {
  // biome-ignore lint/suspicious/noExplicitAny: __TAURI__ is an injected global
  return browser.execute(() => Boolean((window as any).__TAURI__));
}
