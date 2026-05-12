// Minimal flag/positional parser. No deps.
//
// parseArgs(['--name', 'foo', '--force', 'pos1'])
//   → { flags: { name: 'foo', force: true }, positional: ['pos1'] }
//
// Boolean flags must be in the `booleans` set or they consume the next arg.
export function parseArgs(args, { booleans = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        if (booleans.includes(key)) {
          flags[key] = true;
        } else {
          flags[key] = args[++i];
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1);
      if (booleans.includes(key)) flags[key] = true;
      else flags[key] = args[++i];
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}
