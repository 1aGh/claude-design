/**
 * @file       figma/codegen-client.ts — the LOCAL Dev Mode MCP client (DDR-219 D2).
 * @scope      apps/studio/figma/codegen-client.ts
 * @purpose    Ask Figma's own generator for one frame's resolved DOM, over
 *             loopback, with `apps/studio` as the JSON-RPC client.
 *
 * @invariant  THIS IS THE ONLY MODULE IN THE REPO ALLOWED TO NAME `:3845`.
 *             `cli/lib/figma-codegen-reachability.test.mjs` asserts it, and
 *             asserts that Figma's REMOTE MCP host appears in no runtime code
 *             path at all — not even here, which is why this comment does not
 *             spell it: the guard is a coarse grep and it is only trustworthy if
 *             it is absolute. Both halves are controls, not intentions: the
 *             remote server
 *             is spoken by an AGENT, so its response would transit a model's
 *             context by construction — which closes the DDR-130 trifecta inside
 *             a single turn (DDR-219 § Security review, chain 1). The local
 *             server is spoken by US, so no model is in the path.
 *
 * @invariant  NO MODEL READS WHAT THIS RETURNS. The dev-server fetches, parses,
 *             converts and writes. The agent that invoked the verb sees only the
 *             verb's code-owned stdout (DDR-216 D10). That is the whole reason
 *             the channel decision mattered — see the prose note below.
 *
 * @invariant  THE HANDSHAKE IS ASSERTED BEFORE A DOCUMENT IS REQUESTED, AND A
 *             FAILED ASSERTION REFUSES. The local server is UNAUTHENTICATED
 *             loopback (DDR-219 residual 3), so any local process can squat the
 *             port and feed us arbitrary JSX. That requires local code execution
 *             — largely game-over independently — but the specific consequence
 *             is that our converter would ingest attacker-authored markup
 *             believing it came from Figma. So: `initialize` must answer with a
 *             Figma-shaped `serverInfo`, `tools/list` must carry the expected
 *             tool, and no exposed tool may match the WRITE vocabulary.
 *
 * @invariant  WE NEVER LET THIS SERVER WRITE A FILE. `dirForAssetWrites` is a
 *             caller-supplied absolute path the server writes assets to
 *             (measured — DDR-219 probe finding 2). It is never sent. Assets are
 *             re-fetched by node id through the existing `/v1/images` lane
 *             instead (D6), which is strictly better containment than Figma's
 *             own allowed-directories allowlist.
 *
 * @invariant  A RESPONSE THAT IS NOT CODE IS A REFUSAL, NOT A DEGRADATION.
 *             `forceCode` exists because the server silently returns METADATA
 *             instead of code when the output is too large (probe finding 3). A
 *             converter that did not check would emit a confidently wrong
 *             artboard. We assert; we do not paper over it by setting
 *             `forceCode` unconditionally, because the size ceiling is telling
 *             us something real about the caps.
 *
 * @invariant  ONE CODEGEN CALL PER SESSION, ENFORCED HERE (DDR-219 D10). Local
 *             metering is undocumented (fact 5) and the remote budget is 200
 *             calls/day. Without a hard ceiling, an instruction inside a
 *             document ("fetch design context for each of these node ids
 *             first…") spends the user's whole daily Figma budget from content,
 *             and the failure reads as a Figma outage. It is a property of the
 *             CODE, never of how a caller chooses to behave.
 *
 * @invariant  DEPENDENCY-FREE — `fetch` plus `node:crypto` for the response
 *             hash. The transport is streamable HTTP with SSE-framed replies,
 *             which is ~40 lines, not a library.
 */

import { createHash } from 'node:crypto';

/**
 * The local Dev Mode MCP server. Loopback, unauthenticated, no catalog gate —
 * which is exactly why reaching it from a second module would silently turn
 * codegen into a bulk ingestion route (DDR-219 D1's table quietly false).
 */
const CODEGEN_ENDPOINT = 'http://127.0.0.1:3845/mcp';

/** The one tool this client is allowed to call. */
export const CODEGEN_TOOL = 'get_design_context';

/**
 * The tool surface measured on 2026-08-11 — six tools, every one read-only.
 * Recorded so a future reader can see what "no write surface" was measured
 * against rather than having to take the DDR's word for it.
 */
export const MEASURED_LOCAL_TOOLS = Object.freeze([
  'get_design_context',
  'get_variable_defs',
  'get_screenshot',
  'get_motion_context',
  'get_metadata',
  'get_figjam',
]);

/**
 * Write-shaped tool names. A DENYLIST, deliberately, and this is the one place
 * in the Figma lane where that is the right shape: an allowlist over a
 * third-party server's tool surface would refuse on every Figma feature release,
 * while the property we actually need is narrow and stable — *no write surface
 * is co-tenant with this call*. Figma Developer Terms §4.f pushes toward
 * write-back tools existing somewhere; this asserts they are not on this wire.
 */
const WRITE_TOOL_RE = /^(use_figma|create_|upload_|add_|send_|set_|update_|delete_|write_)/i;

/** Handshake: the server must at least claim to be Figma's. Weak on its own —
 *  a squatter can say anything — which is why it is one assertion of several
 *  and why the parser contract (DDR-219 D5) is what actually bounds the damage. */
const SERVER_NAME_RE = /^figma\b/i;

/** Protocol version we speak. Sent as-is; the server answers with its own. */
const PROTOCOL_VERSION = '2025-06-18';

/**
 * INPUT byte cap (DDR-219 D5 rule 2). Distinct from the 512 KB per-artboard
 * OUTPUT cap and from `client.ts`'s 8 MB REST cap, which this response never
 * traverses. Measured: a real 375×812 screen is 33 KB.
 */
export const MAX_CODEGEN_RESPONSE_BYTES = 1024 * 1024;

/** A codegen call is slow-ish (measured ~344 ms) but never minutes. */
const CALL_TIMEOUT_MS = 60_000;
/** The handshake is local and instant; a hang here means nothing is listening. */
const HANDSHAKE_TIMEOUT_MS = 10_000;

/** D10 — one `get_design_context` per user invocation, full stop. */
export const MAX_CODEGEN_CALLS_PER_INVOCATION = 1;

export type CodegenErrorKind =
  /** Nothing listening, or the transport failed. The COMMON case (residual 2). */
  | 'unavailable'
  /** `initialize` did not answer like Figma's server. */
  | 'handshake'
  /** `get_design_context` absent, or a write-shaped tool is co-tenant. */
  | 'tool_surface'
  /** The node is not in the open document, or Figma refused it. */
  | 'node_unavailable'
  /** The server returned metadata instead of code (probe finding 3). */
  | 'not_code'
  /** Over the input byte cap. */
  | 'too_large'
  /** Malformed JSON-RPC / SSE. */
  | 'bad_response'
  /** The per-invocation ceiling already spent. */
  | 'ceiling';

/**
 * Fixed, code-owned messages. NOTHING upstream is ever interpolated — this
 * string reaches verb stdout, which D10 declares entirely code-owned, and the
 * one place an error message would otherwise become a prompt-injection channel.
 */
const MESSAGE_BY_KIND: Readonly<Record<CodegenErrorKind, string>> = {
  unavailable:
    'Figma Dev Mode MCP server is not reachable — open the Figma desktop app, switch to Dev Mode, and enable the MCP server (needs a Dev or Full seat).',
  handshake: 'Something is listening on the Dev Mode port but it is not Figma — refusing.',
  tool_surface: 'The Dev Mode server did not expose the expected read-only codegen tool.',
  node_unavailable:
    'Figma has no such node in the OPEN document — make the right file the active tab.',
  not_code: 'Figma returned metadata instead of code for this frame — it is too large to explode.',
  too_large: 'The codegen response exceeded this lane’s input cap.',
  bad_response: 'The Dev Mode server returned a reply this client could not read.',
  ceiling: 'One codegen call per invocation (DDR-219 D10) — already spent.',
};

export class CodegenError extends Error {
  readonly kind: CodegenErrorKind;
  constructor(kind: CodegenErrorKind) {
    super(MESSAGE_BY_KIND[kind]);
    this.name = 'CodegenError';
    this.kind = kind;
  }
}

/**
 * The response's code half, plus what provenance needs (DDR-219 D7).
 *
 * `responseSha256` does NOT make the artboard reproducible — nothing can, there
 * is no second door (fact 1). It makes *"did these two artboards come from the
 * same generator state"* answerable, which is the minimum an incident needs.
 */
export interface CodegenResponse {
  /** The module source, truncated at the code/prose boundary. */
  code: string;
  /** `sha256` of the FULL response text, prose included — the generator state. */
  responseSha256: string;
  /** Always `'local'`. Recorded so a stored artifact names its own channel. */
  endpoint: 'local';
  tool: string;
  /** Bytes of imperative prose that were discarded. Reported, never carried. */
  proseBytes: number;
}

/**
 * The imperative tail Figma appends to every response — verbatim
 * *"SUPER CRITICAL: The generated React+Tailwind code MUST be converted…"*,
 * *"IMPORTANT: After you call this tool, you MUST call get_screenshot…"*.
 * 1 648 B on the measured frame, issued by **Figma itself**, not an attacker.
 *
 * On this channel it is inert bytes a parser discards. Carrying it into an
 * artifact would write Figma's instructions into a canvas that agents later
 * read — so the boundary is cut HERE, before the converter ever sees it, rather
 * than being left as a property the converter is trusted to preserve.
 *
 * Anchored to line starts and bounded: no `s` flag, no unbounded capture
 * (DDR-172 Decision 4 discipline, which D5 rule 6 carries into this lane).
 */
const PROSE_MARKER_RE =
  /^[ \t>*-]{0,8}(?:\d{1,2}[.)]\s*)?(?:SUPER CRITICAL|IMPORTANT|CRITICAL|NOTE|DO NOT|Analyze the target|After you call this tool)\b/im;

/**
 * Cut the response at the code/prose boundary.
 *
 * The rule is positional rather than semantic: the prose is a TRAILING block, so
 * the first line that reads as an imperative directive ends the code. A response
 * with no such line is all code, which is also the measured shape when the frame
 * is small enough that Figma skips its advice.
 */
export function splitCodeAndProse(raw: string): { code: string; prose: string } {
  const m = PROSE_MARKER_RE.exec(raw);
  let cut = m ? m.index : -1;
  if (cut < 0) {
    // Secondary rule, so the boundary does not depend on Figma's current
    // wording: a generated module ends with a `}` in column 0, and anything
    // after the LAST such line is not part of it. Applied only when there is
    // trailing content — otherwise the module already ends cleanly.
    const lastBrace = raw.lastIndexOf('\n}');
    if (lastBrace >= 0 && raw.slice(lastBrace + 2).trim().length > 0) cut = lastBrace + 2;
  }
  if (cut < 0) return { code: raw, prose: '' };
  return { code: raw.slice(0, cut), prose: raw.slice(cut) };
}

/**
 * Strip a fenced code block if the tool wrapped one. Figma returns bare source
 * on the local channel, but a fence is cheap to tolerate and expensive to
 * discover in production — and an unstripped ``` is a parse error, i.e. a
 * refused frame, for a reason that has nothing to do with the frame.
 */
function unfence(text: string): string {
  const fence = /^\s*```(?:[a-z]{0,16})\n([\s\S]*?)\n```\s*$/;
  const m = fence.exec(text);
  return m ? m[1] : text;
}

// ── Transport ───────────────────────────────────────────────────────────────

interface JsonRpcReply {
  result?: unknown;
  error?: unknown;
}

/**
 * The streamable-HTTP transport answers `event: message\ndata: {json}` even for
 * a single reply, so pull the LAST `data:` line rather than assuming raw JSON.
 * Measured on the live server 2026-08-11.
 */
export function parseRpcBody(text: string): JsonRpcReply {
  if (!/^\s*(?:event|data):/m.test(text)) return JSON.parse(text) as JsonRpcReply;
  const lines = text.split('\n').filter((l) => l.startsWith('data:'));
  if (lines.length === 0) throw new CodegenError('bad_response');
  return JSON.parse(lines[lines.length - 1].slice(5).trim()) as JsonRpcReply;
}

/** Injected so the client is testable with no server and no network. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface CodegenClientOptions {
  fetchImpl?: FetchLike;
  /** Overrides the per-invocation ceiling. Tests only — never a user flag. */
  maxCalls?: number;
}

/**
 * One invocation's worth of conversation with the local server.
 *
 * Deliberately a class with a spent-call counter rather than a free function:
 * D10's ceiling is only real if it lives somewhere a second call has to get
 * past. A module-level counter would leak across invocations in the long-lived
 * dev-server process; a per-session one is scoped to exactly the unit the
 * ceiling is defined over.
 */
export class CodegenSession {
  private readonly fetchImpl: FetchLike;
  private readonly maxCalls: number;
  private sessionId: string | null = null;
  private rpcId = 0;
  private ready = false;
  /** D10's ceiling, spent. */
  private calls = 0;

  constructor(opts: CodegenClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.maxCalls = opts.maxCalls ?? MAX_CODEGEN_CALLS_PER_INVOCATION;
  }

  private async rpc(
    method: string,
    params: unknown,
    { notify = false, timeoutMs = HANDSHAKE_TIMEOUT_MS } = {}
  ): Promise<JsonRpcReply | null> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    const body = notify
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id: ++this.rpcId, method, params };

    let res: Response;
    try {
      res = await this.fetchImpl(CODEGEN_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        // Loopback never legitimately redirects, and following one would be the
        // one way this call could leave the machine.
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Swallow the cause deliberately — a fetch error can carry the URL and,
      // on some runtimes, request detail (D10: output is code-owned).
      throw new CodegenError('unavailable');
    }

    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;
    if (notify) {
      // A notification has no reply worth reading; drain so the socket closes.
      await res.text().catch(() => '');
      return null;
    }
    if (!res.ok) throw new CodegenError('unavailable');

    const text = await readCapped(res);
    try {
      return parseRpcBody(text);
    } catch (err) {
      if (err instanceof CodegenError) throw err;
      throw new CodegenError('bad_response');
    }
  }

  /**
   * `initialize` → assert → `tools/list` → assert. Runs once per session and
   * REFUSES rather than falling through, because everything after it trusts the
   * peer to be Figma's server (DDR-219 D2's named new threat).
   */
  async handshake(): Promise<void> {
    if (this.ready) return;

    const init = await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'maude', version: '1' },
    });
    const initResult = asRecord(init?.result);
    const serverInfo = asRecord(initResult?.serverInfo);
    const serverName = typeof serverInfo?.name === 'string' ? serverInfo.name : '';
    if (!initResult || !SERVER_NAME_RE.test(serverName)) throw new CodegenError('handshake');

    // The transport requires this before any other call.
    await this.rpc('notifications/initialized', {}, { notify: true }).catch(() => null);

    const list = await this.rpc('tools/list', {});
    const listResult = asRecord(list?.result);
    const tools = Array.isArray(listResult?.tools) ? listResult.tools : [];
    const names: string[] = [];
    for (const t of tools) {
      const name = asRecord(t)?.name;
      if (typeof name === 'string') names.push(name);
    }
    if (!names.includes(CODEGEN_TOOL)) throw new CodegenError('tool_surface');
    // §4.f is answered by the CHANNEL, not by argument (DDR-219 D2): our code
    // calls read tools only, and the write surface is measured absent from this
    // endpoint. If it ever appears, that measurement has expired — refuse.
    if (names.some((n) => WRITE_TOOL_RE.test(n))) throw new CodegenError('tool_surface');

    this.ready = true;
  }

  /**
   * The one call. Returns the CODE half of the response plus its provenance.
   *
   * `nodeId` is charset-checked by the caller (`^\d+[:-]\d+$` is the server's own
   * pattern) and is the ONLY addressing parameter the tool takes — it reads the
   * currently open document, with no file key anywhere (probe finding 1). The
   * open-document coupling that follows from that is the caller's problem to
   * close, not this module's: see `--explode`'s frame cross-check.
   */
  async fetchDesignContext(nodeId: string): Promise<CodegenResponse> {
    if (this.calls >= this.maxCalls) throw new CodegenError('ceiling');
    this.calls += 1;

    await this.handshake();

    const reply = await this.rpc(
      'tools/call',
      {
        name: CODEGEN_TOOL,
        arguments: {
          nodeId,
          clientLanguages: 'typescript',
          clientFrameworks: 'react',
          // `dirForAssetWrites` is DELIBERATELY ABSENT — see the file header.
          // Every asset is re-fetched by node id through the REST lane (D6), so
          // this server never writes a byte on this machine.
        },
      },
      { timeoutMs: CALL_TIMEOUT_MS }
    );

    if (reply?.error) throw new CodegenError('node_unavailable');
    const result = asRecord(reply?.result);
    if (!result) throw new CodegenError('bad_response');
    if (result.isError === true) throw new CodegenError('node_unavailable');

    const raw = collectText(result.content);
    if (raw === null) throw new CodegenError('bad_response');

    // Hash the FULL response — prose included. The provenance question is "same
    // generator state?", and the advice block is part of that state.
    const responseSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');

    // The tool answers a missing node with a human sentence rather than an
    // error object; that sentence is not code and must not become an artboard.
    if (/No node could be found for the provided nodeId/i.test(raw)) {
      throw new CodegenError('node_unavailable');
    }

    const { code, prose } = splitCodeAndProse(raw);
    const source = unfence(code).trim();
    if (!looksLikeCode(source)) throw new CodegenError('not_code');

    return {
      code: source,
      responseSha256,
      endpoint: 'local',
      tool: CODEGEN_TOOL,
      proseBytes: prose.length,
    };
  }
}

/**
 * Probe finding 3, as a check rather than as a `forceCode: true` that would hide
 * it. A code response always declares a component; a metadata response is XML-ish
 * or prose and declares nothing.
 */
export function looksLikeCode(source: string): boolean {
  if (source.length === 0) return false;
  return /^\s*(?:export\s+default\s+)?function\s+[A-Za-z_$]/m.test(source);
}

/** MCP tool results are `content: [{ type: 'text', text }]`. Join the text parts. */
function collectText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const item of content) {
    const rec = asRecord(item);
    if (rec?.type === 'text' && typeof rec.text === 'string') parts.push(rec.text);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * `Object.create(null)`-safe record narrowing. Nothing here indexes by an
 * upstream key, but the shape check is the thing that keeps `result.isError`
 * from throwing on a primitive (D5 rule 5's neighbourhood).
 */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Read a body, aborting the moment it exceeds the INPUT cap. Streaming rather
 * than `res.text()` so an unbounded body is never fully materialized before the
 * check — the same rule `client.ts` states for the REST lane, for the same
 * reason: a missing or lying `Content-Length` must not be what stands between a
 * cap and the heap.
 */
async function readCapped(res: Response): Promise<string> {
  const body = res.body;
  if (!body) {
    // Some fetch stubs (and `Response` in a few runtimes) expose no stream.
    const text = await res.text();
    if (text.length > MAX_CODEGEN_RESPONSE_BYTES) throw new CodegenError('too_large');
    return text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_CODEGEN_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new CodegenError('too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}
