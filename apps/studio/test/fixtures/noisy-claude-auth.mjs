#!/usr/bin/env node
// Test fixture for issue #107 — a `claude` stand-in whose `auth status --json`
// stdout is exactly what the test asks for. Lets a test pin the wrapper-noise
// shape it cares about (banner line, brace-bearing noise, trailing chatter,
// pure garbage) without a fixture per case.
//
//   FAKE_CLAUDE_OUT   verbatim stdout, for the small cases.
//   FAKE_CLAUDE_HEAD / FAKE_CLAUDE_PAD_BYTES / FAKE_CLAUDE_TAIL
//                     head + N generated filler bytes + tail. The padding is
//                     generated HERE because a multi-MiB env var exceeds the
//                     exec argument/environment limit — passing it in makes the
//                     spawn fail with E2BIG, which a test would misread as the
//                     parser rejecting the input.
//
// No `process.exit()` after the write: on a pipe a large write completes
// asynchronously, and an explicit exit truncates it. Let the process end on its
// own once stdout has drained, so multi-MiB cases deliver every byte.
const [, , cmd, sub] = process.argv;
if (cmd !== 'auth' || sub !== 'status') {
  process.exitCode = 1;
} else if (process.env.FAKE_CLAUDE_PAD_BYTES) {
  process.stdout.write(process.env.FAKE_CLAUDE_HEAD ?? '');
  process.stdout.write('x'.repeat(Number(process.env.FAKE_CLAUDE_PAD_BYTES)));
  process.stdout.write(process.env.FAKE_CLAUDE_TAIL ?? '');
} else {
  process.stdout.write(process.env.FAKE_CLAUDE_OUT ?? '');
}
