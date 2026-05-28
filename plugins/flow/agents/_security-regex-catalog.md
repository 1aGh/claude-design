# security-auditor — OWASP-class regex catalog

> Loaded on demand by `security-auditor.md` when it enters the static-scan pass (one read per audit run). Kept out of the agent persona so the persona stays small in every spawn. Run each pattern via `grep -nE` against changed files; per hit, read context (±5 lines), decide if it's a real finding, and classify by the §A rule + severity.

## Regex catalog (run via `grep -nE` against changed files)

```
# A1 Injection — string-concatenated queries / shell calls
\b(query|execute|exec|run)\s*\(\s*[`'"][^`'"]*\$\{|\.format\(|f["']\s*SELECT|sprintf.*SELECT
child_process\.(exec|execSync)\(|subprocess\.(call|run|Popen)\([^,]*shell\s*=\s*True
os\.system\(|`[^`]*\$\{|eval\(

# A2 Secrets — high-entropy + known prefixes
sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]+
BEGIN (RSA |EC |DSA |OPENSSH |PRIVATE) ?PRIVATE KEY
(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'][A-Za-z0-9_/+=-]{16,}["']
[A-Za-z0-9_/+=-]{40,}                          # entropy candidates — manual triage per hit

# A3 AuthN/Z
\.(post|put|patch|delete)\(.*\)             # cross-check each for an auth middleware
req\.(headers|body|query)\.(user_?id|tenant_?id|role)  # client-supplied identity → IDOR risk
\.findById\(req\.|\.findOne\(\{[^}]*id[^}]*req\.

# A4 Crypto
\b(md5|sha1)\(|createHash\(["'](md5|sha1)["']|hashlib\.(md5|sha1)\(
Math\.random\(\)|new Random\(\)|rand\(\)               # in auth/token contexts only
\b(AES|aes)[-/_]?ECB\b|mode\s*=\s*ECB

# A5 SSRF / open redirect
(fetch|axios\.get|http\.get|requests\.get|urllib)\(.*req\.(body|query|params)
res\.redirect\(req\.(query|body|params)\.

# A6 XSS
dangerouslySetInnerHTML|innerHTML\s*=|document\.write\(
v-html\s*=|\{\{\{                              # vue / mustache

# A7 CSRF — state-mutating GET
(router|app)\.get\(['"][^'"]*['"],.*function.*\{[\s\S]{0,200}\b(save|delete|update|create)\(

# A8 Deserialization
pickle\.loads?\(|yaml\.load\([^,)]*\)|node-serialize|Marshal\.load
new Function\(|Function\(["']                  # dynamic code construction

# A9 Path traversal
path\.join\(.*req\.(body|query|params)|fs\.(readFile|createReadStream)\(.*req\.

# A11 Logging — secret/PII leakage
console\.log\(.*\b(password|token|secret|api_?key|authorization)\b
log(ger)?\.(info|debug|warn|error)\(.*req\.headers\b

# A12 Error handling
res\.(status|send|json)\(.*\b(stack|trace|message)\b.*err
catch\s*\([^)]*\)\s*\{\s*\}                    # empty catch
```

## Secret-entropy scan

Per changed file, also run:

```bash
grep -nE '[A-Za-z0-9_/+=-]{32,}' <file>
```

For each hit, decide:
- Test fixture? (look at containing dir / test file name / comment) → suppress
- Looks like a hash / opaque ID with no entropy-bearing prefix? → suppress
- Has a credential-prefix or lives in a config/env path? → flag as A2

## Dependency surface

If any of `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `Cargo.lock`, `go.mod`, `go.sum`, `Gemfile`, `Gemfile.lock` changed:

```bash
git diff "$BASE"...HEAD -- <lockfile or manifest>
```

For each newly added or upgraded dep:
1. Run `npm view <pkg> time` (or `pip show <pkg>`, `cargo info <pkg>`) — flag if maintainer/publish date looks abandoned or freshly typosquatted.
2. Check for install scripts (`scripts.postinstall`, `scripts.preinstall` in `package.json` of the dep) — flag any.
3. Compare name to popular packages within edit-distance 1 — flag typosquats.
4. Skip if it's a well-known monorepo internal package (workspace ranges, `workspace:*`).
