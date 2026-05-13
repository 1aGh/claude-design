import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 py-24 text-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">md-claude</h1>
      <p className="text-lg text-fd-muted-foreground max-w-2xl mb-8">
        A Claude Code marketplace shipping two plugins — <code className="font-mono">design</code>{' '}
        (canvas-first iteration) and <code className="font-mono">flow</code> (agentic workflow loop
        with a second-brain <code className="font-mono">.ai/</code> workspace) — plus the{' '}
        <code className="font-mono">mdcc</code> CLI.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center px-5 py-2.5 rounded-md bg-fd-primary text-fd-primary-foreground font-medium hover:opacity-90 transition"
        >
          Read the docs
        </Link>
        <Link
          href="/docs/getting-started"
          className="inline-flex items-center px-5 py-2.5 rounded-md border border-fd-border font-medium hover:bg-fd-muted transition"
        >
          Getting started
        </Link>
        <a
          href="https://github.com/1aGh/md-claude"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-5 py-2.5 rounded-md border border-fd-border font-medium hover:bg-fd-muted transition"
        >
          GitHub
        </a>
      </div>
      <pre className="mt-12 text-left text-sm bg-fd-muted p-4 rounded-md max-w-xl w-full overflow-x-auto">
        <code>{`# Inside Claude Code
/plugin marketplace add 1aGh/md-claude
/plugin install design@md-claude
/plugin install flow@md-claude

# Optional: CLI for scaffolding + dev server
npm i -g @1agh/md-claude
mdcc init --name my-app`}</code>
      </pre>
    </main>
  );
}
