// Workspace mode + the containment invariant's first enforcement point.
//
// DDR-193 states the invariant:
//
//   > No tenant-authored TSX is ever evaluated by vendor-operated compute.
//   > A cell runs sync + git + asset storage — nothing else. It never renders a
//   > canvas, never builds a bundle, never executes a canvas module, never runs
//   > a headless browser against tenant content.
//
// and states how it is kept: "enforced, not asserted — a boot-assert in the cell
// image plus a CI grep gate." This module is the boot-assert. The grep gate is
// `scripts/check-containment.sh`.
//
// WHY A BOOT-ASSERT AND NOT A CODE REVIEW RULE. Every canvas is code the tenant
// wrote. The moment vendor compute evaluates it, an anonymous signup has
// arbitrary code execution inside our perimeter, next to other tenants' designs
// and the control plane's credentials. A convention protects that for exactly as
// long as everyone remembers it; a process that refuses to start does not
// forget. The failure mode this prevents is not "someone adds a bad route on
// purpose" — it is "someone adds a thumbnail endpoint in 2027 without knowing
// this line exists."
//
// It fails CLOSED and LOUD: the cell refuses to boot, naming the exact surfaces
// that broke it. A cell that will not start is a page; a cell that quietly
// renders tenant code is an incident.

/** True when this process is a vendor-operated workspace cell. */
export function isWorkspaceMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MAUDE_WORKSPACE_MODE === '1';
}

/**
 * Route paths a workspace cell must not expose, with the reason each one
 * violates containment. The reason travels with the entry so the error message
 * teaches rather than just refusing.
 *
 * These are prefixes: `/_api/export-jobs` is caught by `/_api/export` and that
 * is intended — a variant of a forbidden surface is still forbidden.
 */
export const FORBIDDEN_ROUTE_PREFIXES: ReadonlyArray<{ prefix: string; why: string }> =
  Object.freeze([
    {
      prefix: '/_api/export',
      why: 'export renders the canvas through a headless browser — it EVALUATES tenant TSX',
    },
    {
      prefix: '/_api/photo-edit',
      why: 'photo editing decodes and processes tenant-supplied media in-process',
    },
    {
      prefix: '/_api/generate',
      why: 'media generation runs tenant-authored prompts against a provider key held here',
    },
    {
      prefix: '/_canvas-shell',
      why: 'the canvas shell is the surface that mounts and executes a canvas module',
    },
    {
      prefix: '/_canvas-runtime',
      why: 'serving the canvas runtime only makes sense if something here renders a canvas',
    },
    {
      prefix: '/_ws/acp',
      why: 'the ACP bridge spawns the user’s own `claude` and can drive file edits (DDR-123 is desktop-only)',
    },
  ]);

/**
 * Modules a cell must not be able to load. Presence of the *dependency* is the
 * signal — a cell image that ships Playwright is one `import()` away from
 * rendering tenant content, so the invariant is cheaper to hold at the image
 * boundary than at the call site.
 */
export const FORBIDDEN_MODULES: ReadonlyArray<string> = Object.freeze([
  'playwright',
  'playwright-core',
  'puppeteer',
  'puppeteer-core',
]);

/** True when `route` is (or starts with) a forbidden prefix. */
export function isForbiddenRoute(route: string): boolean {
  return FORBIDDEN_ROUTE_PREFIXES.some((f) => route === f.prefix || route.startsWith(f.prefix));
}

/**
 * Remove every forbidden surface from a route table.
 *
 * This is what lets a cell boot at all: the studio serves one route table, and
 * most of it (sync, comments, annotations, assets, git) is exactly what a cell
 * needs. Pruning — rather than maintaining a separate cell server — means a cell
 * runs the SAME code path a self-hoster runs, which is the property DDR-192 §1
 * is built on. A second implementation would drift.
 *
 * Order matters: prune first, then `assertContainment` over the PRUNED keys.
 * That makes the boot-assert a post-condition on this function rather than an
 * independent opinion, so a prefix added to the vocabulary automatically both
 * prunes and is verified.
 */
export function pruneForWorkspace<T extends Record<string, unknown>>(
  routes: T
): { routes: Partial<T>; removed: string[] } {
  const kept: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [route, handler] of Object.entries(routes)) {
    if (isForbiddenRoute(route)) removed.push(route);
    else kept[route] = handler;
  }
  return { routes: kept as Partial<T>, removed: removed.sort() };
}

export interface ContainmentReport {
  ok: boolean;
  /** Route prefixes that are reachable and must not be. */
  routes: Array<{ route: string; prefix: string; why: string }>;
  /** Forbidden modules that resolve in this process. */
  modules: string[];
}

/**
 * Check a route table against the invariant. Pure — takes the route names so it
 * can be unit-tested without booting a server, and so the caller decides what
 * "reachable" means for its own dispatch shape.
 */
export function checkContainment(
  routeNames: Iterable<string>,
  { resolveModule }: { resolveModule?: (specifier: string) => boolean } = {}
): ContainmentReport {
  const routes: ContainmentReport['routes'] = [];
  for (const route of routeNames) {
    for (const { prefix, why } of FORBIDDEN_ROUTE_PREFIXES) {
      if (route === prefix || route.startsWith(prefix)) {
        routes.push({ route, prefix, why });
        break;
      }
    }
  }

  const modules: string[] = [];
  if (resolveModule) {
    for (const specifier of FORBIDDEN_MODULES) {
      if (resolveModule(specifier)) modules.push(specifier);
    }
  }

  return { ok: routes.length === 0 && modules.length === 0, routes, modules };
}

/** Render a report as the message the operator sees when a cell refuses to boot. */
export function formatContainmentFailure(report: ContainmentReport): string {
  const lines = [
    'REFUSING TO START: this process is running as a workspace cell',
    '(MAUDE_WORKSPACE_MODE=1) but exposes surfaces that break the containment',
    'invariant — "no tenant-authored TSX is ever evaluated by vendor-operated',
    'compute" (DDR-193 §2).',
    '',
  ];
  if (report.routes.length > 0) {
    lines.push('Reachable routes that must not be:');
    for (const { route, prefix, why } of report.routes) {
      lines.push(`  ${route}`);
      lines.push(`      matches ${prefix} — ${why}`);
    }
    lines.push('');
  }
  if (report.modules.length > 0) {
    lines.push('Modules that resolve in this process and must not:');
    for (const m of report.modules) lines.push(`  ${m}`);
    lines.push('');
  }
  lines.push(
    'A cell runs sync + git + asset storage. Rendering happens on a member’s own',
    'machine, in Maude Desktop, where DDR-063/DDR-054 already contain it.',
    '',
    'If a feature genuinely needs one of these, Direction B (a structured,',
    'non-executable synced unit) is its HARD PREREQUISITE — not a flag to add here.'
  );
  if (report.modules.length > 0) {
    lines.push(
      '',
      'Testing workspace mode inside a DEV CHECKOUT? Playwright is a legitimate',
      'devDependency here (the E2E harness), so it resolves and this fires. Set',
      'MAUDE_WORKSPACE_ALLOW_DEV_MODULES=1 to skip the module check locally. It has',
      'no effect on a built cell image, where the runtime-dependency gate in',
      'scripts/check-containment.sh is the enforcement — a shipped cell must not',
      'contain a browser at all.'
    );
  }
  return lines.join('\n');
}

/**
 * Boot gate. No-op unless workspace mode is on; otherwise throws with the full
 * report when anything forbidden is reachable.
 *
 * Deliberately throws rather than returning a boolean: a caller that forgets to
 * check a return value is exactly the class of mistake this exists to survive.
 */
export function assertContainment(
  routeNames: Iterable<string>,
  {
    env = process.env,
    resolveModule,
  }: { env?: NodeJS.ProcessEnv; resolveModule?: (specifier: string) => boolean } = {}
): void {
  if (!isWorkspaceMode(env)) return;
  const report = checkContainment(routeNames, { resolveModule });
  if (report.ok) return;
  throw new Error(formatContainmentFailure(report));
}
