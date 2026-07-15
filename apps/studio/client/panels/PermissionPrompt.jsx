// The inline approve/deny card (Milestone B — retires DDR-125 F2's blanket
// auto-approve). Renders whatever `options[]` the agent actually offered —
// NOT a fixed Allow/Reject pair — because ExitPlanMode rides this SAME
// requestPermission path with its own multi-way option set ("Yes, and use
// auto mode" / "Yes, and auto-accept edits" / "No, keep planning", …). Only
// mounted while a request is pending for the ACTIVE chat (ChatThread gates
// this — one card at a time, oldest first).

import { useEffect, useRef } from 'react';

function toolTarget(toolCall) {
  const raw = toolCall?.rawInput;
  const fromInput =
    raw && typeof raw === 'object' ? raw.path || raw.file_path || raw.abs_path || raw.filePath : undefined;
  const fromLocation = Array.isArray(toolCall?.locations) ? toolCall.locations[0]?.path : undefined;
  const path = fromInput || fromLocation;
  return path ? String(path).split('/').pop() : null;
}

// Visual bucket for a PermissionOptionKind — drives which button style reads
// as "the safe default" (allow-once) vs "the escape hatch" (reject). Note
// `allow_always` is deliberately NOT primary-styled — see `pickDefaultAllow`
// below for why.
function kindClass(kind) {
  if (kind === 'reject_once' || kind === 'reject_always') return 'btn btn--danger';
  if (kind === 'allow_once') return 'btn btn--primary';
  return 'btn';
}

// SECURITY (ethical-hacker finding) — pure, exported for direct unit testing
// (test/acp-permission-prompt.test.ts) without needing to render the
// component. Prefers `allow_once` over `allow_always` as the default (Enter
// key + visually primary button). The adapter's own option ordering for BOTH
// a routine tool call and an ExitPlanMode request happens to list the
// most-permissive standing-exemption option FIRST (`allow_always`, or
// ExitPlanMode's `auto` mode) — a plain `.find()` over an unordered
// preference grabbed whichever came first, which meant Enter/the one bold
// button on an ORDINARY tool-call card silently granted a session-scoped
// standing exemption instead of a one-time approval, and on an ExitPlanMode
// card silently flipped the whole session into an unattended auto mode
// (after which `requestPermission` is never called again — DDR-179's own
// bypassPermissions short-circuit). Only fall back to `allow_always` when no
// once-only option was offered at all, so there's always SOME allow default
// rather than none.
export function pickDefaultAllow(options) {
  const list = Array.isArray(options) ? options : [];
  return (
    list.find((o) => o?.kind === 'allow_once') ?? list.find((o) => o?.kind === 'allow_always') ?? null
  );
}

export function pickDefaultReject(options) {
  const list = Array.isArray(options) ? options : [];
  return list.find((o) => o?.kind === 'reject_once' || o?.kind === 'reject_always') ?? null;
}

export default function PermissionPrompt({ request, onRespond, queueLength = 1 }) {
  const cardRef = useRef(null);
  const { toolCall, options } = request;
  const target = toolTarget(toolCall);

  const firstAllow = pickDefaultAllow(options);
  const firstReject = pickDefaultReject(options);

  useEffect(() => {
    cardRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Enter' && firstAllow) {
        e.preventDefault();
        onRespond(firstAllow.optionId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onRespond(firstReject ? firstReject.optionId : 'cancelled');
      }
    }
    const el = cardRef.current;
    el?.addEventListener('keydown', onKey);
    return () => el?.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  return (
    <div
      className="chat-perm"
      role="alertdialog"
      aria-label="Permission request"
      tabIndex={-1}
      ref={cardRef}
      data-testid="chat-permission-prompt"
    >
      <div className="chat-perm-hd">
        <b title={toolCall?.title || 'Tool call'}>{toolCall?.title || 'Tool call'}</b>
        {target ? <span className="chat-tool-path">{target}</span> : null}
        {/* SECURITY (ethical-hacker finding) — a growing backlog was
            invisible (always "1 of 1"), which is what manufactures the
            reflexive-Enter-mashing precondition the wrong-default bug
            depended on. Now visible whenever more than one is queued. */}
        {queueLength > 1 ? (
          <span className="chat-perm-queue" data-testid="chat-perm-queue">
            +{queueLength - 1} more waiting
          </span>
        ) : null}
      </div>
      <p className="chat-perm-body">Claude wants permission to continue. Choose an option:</p>
      <div className="chat-perm-actions">
        {options.map((o) => (
          <button
            key={o.optionId}
            type="button"
            className={kindClass(o.kind)}
            onClick={() => onRespond(o.optionId)}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
