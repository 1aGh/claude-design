export const revalidate = false;

const ROBOTS = `# md-claude docs — crawlable by everyone, including LLM / AI tools.
# Canonical machine-readable index lives at /llms.txt
# Full body of every page lives at /llms-full.txt
# Per-page raw MDX lives at /llms.mdx/docs/<slug>/content.md

User-agent: *
Allow: /

# Explicit allow for major LLM crawlers (informational; the wildcard already permits).
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: https://md-claude.iagh.com/sitemap.xml
`;

export function GET() {
  return new Response(ROBOTS, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
