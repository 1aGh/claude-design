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
// as "the safe default" (allow) vs "the escape hatch" (reject).
function kindClass(kind) {
  if (kind === 'reject_once' || kind === 'reject_always') return 'btn btn--danger';
  if (kind === 'allow_always') return 'btn btn--primary';
  return 'btn';
}

export default function PermissionPrompt({ request, onRespond }) {
  const cardRef = useRef(null);
  const { toolCall, options } = request;
  const target = toolTarget(toolCall);

  const firstAllow = options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always');
  const firstReject = options.find((o) => o.kind === 'reject_once' || o.kind === 'reject_always');

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
        <b>{toolCall?.title || 'Tool call'}</b>
        {target ? <span className="chat-tool-path">{target}</span> : null}
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
