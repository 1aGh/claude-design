---
name: maintain/docs
type: command
description: Documentation freshness check — scan for stale references across all docs and content
keywords: [documentation, freshness, stale, references, scan]
---

# Maintain: Documentation Freshness

> Scans content, AGENTS files, READMEs, and AI docs for references that have drifted from actual code.

## Step 1: Scan for known stale patterns

Run project-specific grep patterns and report any matches as **stale references**.

### Project-Specific Stale Patterns

> Add patterns relevant to your project below. Examples:
>
> ```bash
> # Old architecture references
> grep -rn "old-pattern\|deprecated-term" docs/ content/ README.md --include="*.md" --include="*.mdx" 2>/dev/null
>
> # Old paths or package names
> grep -rn "old-package-name\|legacy-path" src/ docs/ --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null
> ```

Scan all documentation-related files for patterns that indicate stale references:

```bash
# Scan AI docs for references to files that no longer exist
for ref in $(grep -roh '\./[a-zA-Z0-9/_.-]*\.md' .ai/docs/ CLAUDE.md README.md 2>/dev/null | sort -u); do
  if [ ! -f "$ref" ]; then echo "STALE REF: $ref"; fi
done
```

## Step 2: Cross-check key numbers

Verify that numbers mentioned in documentation match reality:

```bash
# Count assets by type and compare against CLAUDE.md claims
echo "Commands: $(find commands -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Agents: $(find agents -name '*.agent.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Skills: $(find skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
echo "Prompts: $(find prompts -name '*.prompt.md' 2>/dev/null | wc -l | tr -d ' ')"
```

Compare against what docs say and flag discrepancies.

## Step 3: Check for dead links in documentation

```bash
# Internal links that reference non-existent files
grep -roh '\]([^)]*\.md[^)]*)' docs/ CLAUDE.md README.md 2>/dev/null | \
  sed 's/\](//' | sed 's/)$//' | sort -u | while read link; do
    # Strip anchors
    file=$(echo "$link" | cut -d'#' -f1)
    if [ -n "$file" ] && [ ! -f "$file" ]; then echo "DEAD LINK: $link"; fi
  done
```

## Step 4: Cross-reference validation

Check references across AI docs, READMEs, and workflow files:

```bash
# Commands referenced in CLAUDE.md that don't exist
grep -oE '`[a-z/-]+`' CLAUDE.md 2>/dev/null | tr -d '`' | while read cmd; do
  if [ -f "commands/${cmd}.md" ] || [ -d "commands/${cmd}" ]; then
    : # exists
  fi
done
```

Report broken cross-references alongside the Step 3 dead links.

## Output

Report as:

```
Docs: ✅ / ⚠️ {N stale references}
- Stale patterns: {list with file:line}
- Number mismatches: {list}
- Dead links: {list}
```
