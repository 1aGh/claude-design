const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CREDENTIAL_VALUE =
  /(?:\bBearer\s+[A-Za-z0-9._~+/-]+=*|\b(?:sk|gh[opusr]|xox[baprs])[_-][A-Za-z0-9_-]{8,}|\bAKIA[A-Z0-9]{16}\b)/;
const COMMAND_CREDENTIAL =
  /--(?:access[_-]?token|api[_-]?key|authorization|password|private[_-]?key|secret|token)(?:=|\s+)(?!\$\{|\{env:|keychain:)[^\s]+/i;
const REFERENCE_ONLY =
  /^(?:\$\{[A-Z_][A-Z0-9_]*\}|\{env:[A-Z_][A-Z0-9_]*\}|keychain:[A-Za-z0-9._/-]+)$/;
const PEM_PRIVATE_KEY = /-----BEGIN ((?:[A-Z0-9]+ )*PRIVATE KEY)-----[\s\S]*?-----END \1-----/;
const PUBLIC_BOOLEAN = /^(?:0|1|false|true)$/;
const PUBLIC_COLOR = /^(?:0|1|2|3|false|true)$/;
const PUBLIC_LOCALE =
  /^(?:C|POSIX|[A-Za-z]{2,3}(?:_[A-Za-z]{2})?(?:\.[A-Za-z0-9-]{1,16})?(?:@[A-Za-z0-9_-]{1,16})?)$/;
const PUBLIC_ENVIRONMENT_VALIDATORS = new Map([
  ['AGENT_BROWSER_PROFILE', validAbsolutePath],
  ['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', (value) => PUBLIC_BOOLEAN.test(value)],
  ['CI', (value) => PUBLIC_BOOLEAN.test(value)],
  ['CLICOLOR', (value) => /^(?:0|1)$/.test(value)],
  ['CLICOLOR_FORCE', (value) => /^(?:0|1)$/.test(value)],
  ['FORCE_COLOR', (value) => PUBLIC_COLOR.test(value)],
  ['LANG', validLocale],
  ['LANGUAGE', validLocale],
  ['LC_ALL', validLocale],
  ['NODE_ENV', (value) => /^(?:development|production|test)$/.test(value)],
  ['NO_COLOR', (value) => PUBLIC_BOOLEAN.test(value)],
  ['POSTHOG_MCP_EXEC_GATE_ALLOW', (value) => value === '*'],
  ['TZ', validTimezone],
]);
const URI_CANDIDATE = /(?:jdbc:)?[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"'`]+/gi;
const URI_CREDENTIAL_PARAMETER =
  /^(?:access[_-]?token|api[_-]?key|auth|authorization|password|secret|token|user|username)$/i;
const SENSITIVE_ASSIGNMENT_KEY =
  '(?:access[_-]?token|api[_-]?key|apiKey|authorization|client[_-]?secret|cookie|credential|database[_-]?url|dsn|password|private[_-]?key|redis[_-]?url|secret|set[_-]?cookie|token|x[_-]?api[_-]?key)';
const EMBEDDED_AUTHORIZATION =
  /(\bAuthorization\s*:\s*)([A-Za-z][A-Za-z0-9._~-]*)([ \t]+)([A-Za-z0-9._~+/=_-]{4,})/gi;
const INLINE_SENSITIVE_ASSIGNMENT =
  /(\b([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*["']?)([A-Za-z0-9._~+/=-]{4,})/gi;

export function classifyCredential(value, { key = '' } = {}) {
  if (
    typeof value !== 'string' ||
    value === '[REDACTED_LITERAL_SECRET]' ||
    isCredentialReference(value)
  ) {
    return null;
  }
  if (PEM_PRIVATE_KEY.test(value)) return 'pem-private-key';
  if (containsCredentialUri(value) || hasLiteralUriParameter(value)) return 'credential-uri';
  if (containsEmbeddedAuthorization(value) || containsInlineSensitiveAssignment(value)) {
    return 'literal-secret';
  }
  if (isCredentialKey(key) && isReferenceBackedCredentialContainer(value)) return null;
  if (isCredentialKey(key) || CREDENTIAL_VALUE.test(value)) return 'literal-secret';
  return null;
}

export function isCredentialReference(value) {
  return REFERENCE_ONLY.test(value);
}

export function sanitizeConfiguredEnvironmentValue(name, value) {
  if (typeof value === 'string') {
    if (isCredentialReference(value)) return { rejected: false, value };
    if (isPublicEnvironmentLiteral(name, value)) return { rejected: false, value };
  }
  return {
    rejected: true,
    value: { $maudeSecret: 'literal-rejected' },
  };
}

export function isPublicEnvironmentLiteral(name, value) {
  return (
    typeof value === 'string' &&
    value.length <= 1024 &&
    PUBLIC_ENVIRONMENT_VALIDATORS.get(name)?.(value) === true
  );
}

export function sanitizeUntrustedValue(value, { maxDepth = 32, maxNodes = 50_000 } = {}) {
  const findings = [];
  let nodes = 0;

  function visit(candidate, path, depth, key = '') {
    nodes += 1;
    if (nodes > maxNodes) throw new Error(`untrusted value exceeds ${maxNodes} structural nodes`);
    if (depth > maxDepth) throw new Error(`untrusted value exceeds maximum depth ${maxDepth}`);
    if (typeof candidate === 'string') {
      const classification = classifyCredential(candidate, { key });
      if (classification && !isMcpServerUrl(path)) {
        findings.push({ path: path.join('.'), reason: classification });
        return { $maudeSecret: 'literal-rejected' };
      }
      if (isMcpServerUrl(path)) return candidate;
      return candidate;
    }
    if (Array.isArray(candidate)) {
      return candidate.map((nested, index) => {
        const previous = candidate[index - 1];
        if (
          key === 'args' &&
          typeof nested === 'string' &&
          ((typeof previous === 'string' &&
            isSensitiveFlag(previous) &&
            !isCredentialReference(nested)) ||
            COMMAND_CREDENTIAL.test(nested))
        ) {
          findings.push({ path: [...path, String(index)].join('.'), reason: 'literal-secret' });
          return { $maudeSecret: 'literal-rejected' };
        }
        return visit(nested, [...path, String(index)], depth + 1);
      });
    }
    if (!candidate || typeof candidate !== 'object') return candidate;

    const result = {};
    for (const [nestedKey, nested] of Object.entries(candidate)) {
      if (FORBIDDEN_KEYS.has(nestedKey)) {
        throw new Error(`forbidden key in untrusted value: ${nestedKey}`);
      }
      result[nestedKey] = visit(nested, [...path, nestedKey], depth + 1, nestedKey);
    }
    return result;
  }

  return { value: visit(value, [], 0), findings };
}

export function containsRejectedLiteral(value) {
  if (Array.isArray(value)) return value.some(containsRejectedLiteral);
  if (!value || typeof value !== 'object') return false;
  if (value.$maudeSecret === 'literal-rejected') return true;
  return Object.values(value).some(containsRejectedLiteral);
}

export function sanitizeUntrustedText(value) {
  const findings = [];
  let sanitized = redactCredentialUris(value, findings).replace(
    new RegExp(PEM_PRIVATE_KEY.source, 'g'),
    () => {
      findings.push({ reason: 'pem-private-key' });
      return '[REDACTED_LITERAL_SECRET]';
    }
  );
  sanitized = redactEmbeddedAuthorization(sanitized, findings);
  sanitized = redactInlineSensitiveAssignments(sanitized, findings);
  sanitized = redactBlockAssignments(sanitized, findings).replace(
    /(?:\bBearer\s+[A-Za-z0-9._~+/-]+=*|\b(?:sk|gh[opusr]|xox[baprs])[_-][A-Za-z0-9_-]{8,}|\bAKIA[A-Z0-9]{16}\b)/g,
    () => {
      findings.push({ reason: 'literal-secret' });
      return '[REDACTED_LITERAL_SECRET]';
    }
  );
  sanitized = sanitized.replace(
    new RegExp(
      `^(\\s*(?:[-*>]\\s*)?["']?(${SENSITIVE_ASSIGNMENT_KEY})["']?\\s*[:=]\\s*)(.+)$`,
      'gim'
    ),
    (match, prefix, key, candidate) => {
      const trimmed = candidate.trim().replace(/^['"]|['"]$/g, '');
      if (trimmed.includes('[REDACTED_LITERAL_SECRET]')) return match;
      if (!classifyCredential(trimmed, { key })) return match;
      findings.push({ reason: 'literal-secret-assignment' });
      return `${prefix}[REDACTED_LITERAL_SECRET]`;
    }
  );
  return { findings, value: sanitized };
}

function isCredentialKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return /(?:accesskey|accesstoken|apikey|auth|authorization|clientsecret|cookie|credential|databaseurl|dsn|password|privatekey|redisurl|secret|setcookie|token)$/.test(
    normalized
  );
}

function isSensitiveFlag(value) {
  return /^--(?:access[_-]?token|api[_-]?key|authorization|password|private[_-]?key|secret|token)$/i.test(
    value
  );
}

function validLocale(value) {
  return value.length <= 64 && PUBLIC_LOCALE.test(value);
}

function validTimezone(value) {
  if (value.length === 0 || value.length > 64 || !/^[A-Za-z0-9._+/-]+$/.test(value)) return false;
  if (value === 'UTC' || value === 'GMT') return true;
  const segments = value.split('/');
  return (
    segments.length >= 2 &&
    segments.length <= 4 &&
    segments.every((segment) => segment && segment !== '.' && segment !== '..')
  );
}

function validAbsolutePath(value) {
  return value.startsWith('/') && !value.includes('\0') && !value.split('/').includes('..');
}

function containsCredentialUri(value) {
  return [...value.matchAll(new RegExp(URI_CANDIDATE.source, 'gi'))].some((match) =>
    isCredentialUri(match[0])
  );
}

function redactCredentialUris(value, findings) {
  return value.replace(new RegExp(URI_CANDIDATE.source, 'gi'), (candidate) => {
    if (!isCredentialUri(candidate)) return candidate;
    findings.push({ reason: 'credential-uri' });
    return '[REDACTED_LITERAL_SECRET]';
  });
}

function isCredentialUri(candidate) {
  const parseable = candidate.toLowerCase().startsWith('jdbc:') ? candidate.slice(5) : candidate;
  let url;
  try {
    url = new URL(parseable);
  } catch {
    return hasLiteralUriParameter(candidate);
  }
  const username = decodeUriPart(url.username);
  if (url.username && (username === undefined || !isCredentialReference(username))) return true;
  const password = decodeUriPart(url.password);
  if (url.password && (password === undefined || !isCredentialReference(password))) return true;
  for (const [key, value] of url.searchParams) {
    if (value && URI_CREDENTIAL_PARAMETER.test(key) && !isCredentialReference(value)) return true;
  }
  if (hasLiteralUriParameter(candidate)) return true;
  const segments = url.pathname.split('/').map(decodeUriPart);
  if (segments.some((segment) => segment === undefined)) return true;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (URI_CREDENTIAL_PARAMETER.test(segment) && next && !isCredentialReference(next)) return true;
    if (isTokenLikePathSegment(segment)) return true;
  }
  return isKnownWebhookCredential(url, segments);
}

function hasLiteralUriParameter(candidate) {
  const parameter =
    /(?:[;?&/])(?:access[_-]?token|api[_-]?key|auth|authorization|password|secret|token|user|username)=([^;&#/\s"'`]+)/gi;
  return [...candidate.matchAll(parameter)].some((match) => !isCredentialReference(match[1]));
}

function isReferenceBackedCredentialContainer(value) {
  if (!/(?:\$\{|\{env:|keychain:)/.test(value)) return false;
  if (
    /^(?:Basic|Bearer) (?:\$\{[A-Z_][A-Z0-9_]*\}|\{env:[A-Z_][A-Z0-9_]*\}|keychain:[A-Za-z0-9._/-]+)$/.test(
      value
    )
  ) {
    return true;
  }
  const hasUri = new RegExp(URI_CANDIDATE.source, 'i').test(value);
  const hasDsnParameter =
    /;(?:access[_-]?token|api[_-]?key|auth|authorization|password|secret|token|user|username)=/i.test(
      value
    );
  return hasUri || hasDsnParameter;
}

function isKnownWebhookCredential(url, segments) {
  const host = url.hostname.toLowerCase();
  if (host === 'hooks.slack.com') {
    const marker = segments.indexOf('services');
    const credential = segments[marker + 3];
    return marker >= 0 && Boolean(credential && !isCredentialReference(credential));
  }
  if (host === 'discord.com' || host === 'discordapp.com') {
    const marker = segments.indexOf('webhooks');
    return (
      marker >= 0 && Boolean(segments[marker + 2] && !isCredentialReference(segments[marker + 2]))
    );
  }
  return host === 'api.telegram.org' && segments.some((segment) => /^bot[^/]+$/i.test(segment));
}

function isTokenLikePathSegment(segment) {
  if (!segment || isCredentialReference(segment)) return false;
  if (/^(?:sk|gh[opusr]|xox[baprs])[_-][A-Za-z0-9_-]{8,}$/.test(segment)) return true;
  return isOpaqueCredentialCandidate(segment);
}

function isOpaqueCredentialCandidate(candidate) {
  if (!candidate || isCredentialReference(candidate)) return false;
  if (/^[a-f0-9]{32,}$/i.test(candidate)) return true;
  if (candidate.length < 24 || !/^[A-Za-z0-9._~+/=_-]+$/.test(candidate)) return false;
  const frequencies = new Map();
  for (const character of candidate)
    frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  const entropy = [...frequencies.values()].reduce((sum, count) => {
    const probability = count / candidate.length;
    return sum - probability * Math.log2(probability);
  }, 0);
  return entropy >= 4;
}

function containsEmbeddedAuthorization(value) {
  return [...value.matchAll(new RegExp(EMBEDDED_AUTHORIZATION.source, 'gi'))].some((match) =>
    isAuthorizationCredential(match[2], match[4])
  );
}

function redactEmbeddedAuthorization(value, findings) {
  return value.replace(
    new RegExp(EMBEDDED_AUTHORIZATION.source, 'gi'),
    (match, prefix, scheme, spacing, credential) => {
      if (!isAuthorizationCredential(scheme, credential)) return match;
      findings.push({ reason: 'literal-secret-header' });
      return `${prefix}${scheme}${spacing}[REDACTED_LITERAL_SECRET]`;
    }
  );
}

function isAuthorizationCredential(scheme, credential) {
  if (isCredentialReference(credential)) return false;
  return /^(?:basic|bearer)$/i.test(scheme) || isOpaqueCredentialCandidate(credential);
}

function containsInlineSensitiveAssignment(value) {
  return [...value.matchAll(new RegExp(INLINE_SENSITIVE_ASSIGNMENT.source, 'gi'))].some(
    (match) =>
      isCredentialKey(match[2]) &&
      (isOpaqueCredentialCandidate(match[3]) || Boolean(classifyCredential(match[3])))
  );
}

function redactInlineSensitiveAssignments(value, findings) {
  return value.replace(
    new RegExp(INLINE_SENSITIVE_ASSIGNMENT.source, 'gi'),
    (match, prefix, key, credential) => {
      if (!isCredentialKey(key)) return match;
      if (!isOpaqueCredentialCandidate(credential) && !classifyCredential(credential)) return match;
      findings.push({ reason: 'literal-secret-assignment' });
      return `${prefix}[REDACTED_LITERAL_SECRET]`;
    }
  );
}

function decodeUriPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function isMcpServerUrl(path) {
  return path.length === 3 && path[0] === 'mcpServers' && path[2] === 'url';
}

function redactBlockAssignments(value, findings) {
  const lines = value.split('\n');
  const blockAssignment = new RegExp(
    `^(\\s*(?:[-*>]\\s*)?["']?${SENSITIVE_ASSIGNMENT_KEY}["']?\\s*:\\s*)[|>][+-]?\\s*$`,
    'i'
  );
  for (let index = 0; index < lines.length; index += 1) {
    const match = blockAssignment.exec(lines[index]);
    if (!match) continue;
    const baseIndent = /^\s*/.exec(lines[index])[0].length;
    lines[index] = `${match[1]}[REDACTED_LITERAL_SECRET]`;
    findings.push({ reason: 'literal-secret-block' });
    for (let nested = index + 1; nested < lines.length; nested += 1) {
      if (!lines[nested].trim()) {
        lines[nested] = '';
        continue;
      }
      const indent = /^\s*/.exec(lines[nested])[0].length;
      if (indent <= baseIndent) break;
      lines[nested] = '';
    }
  }
  return lines.join('\n');
}
