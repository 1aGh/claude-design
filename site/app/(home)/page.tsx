import { CopyButton } from "@/components/mdcc/copy-button";
import { SkuLabel } from "@/components/mdcc/sku-label";
import stats from "@/lib/stats.json";
import Link from "next/link";

const INSTALL_SNIPPET = `# 1 — add the marketplace
/plugin marketplace add 1aGh/md-claude

# 2 — install plugins
/plugin install design@md-claude
/plugin install flow@md-claude

# optional — scaffold a project from CLI
npm i -g @1agh/md-claude
mdcc init --name my-app`;

const CATALOG = [
	{
		sku: "MDCC-DSN/01",
		slug: "design",
		title: "Canvas iteration",
		description:
			"Canvas-first iteration on HTML/JSX mocks. Zero-dep Node dev-server. Cmd+Click element inspector. Snapshot stack per canvas.",
		tags: [
			`commands · ${stats.plugins.design.commands}`,
			`skills · ${stats.plugins.design.skills}`,
			`critics · ${stats.plugins.design.agents}`,
		],
		install: "/plugin install design@md-claude",
		docs: "/docs/design",
	},
	{
		sku: "MDCC-FLW/02",
		slug: "flow",
		title: "Agentic loop",
		description:
			"Plan → execute → done → validate. Second-brain .ai/ workspace. Project-agnostic via per-repo workflows.config.json. Same plugin runs in Next.js, Expo, Go, anything.",
		tags: [
			`commands · ${stats.plugins.flow.commands}`,
			`skills · ${stats.plugins.flow.skills}`,
			`agents · ${stats.plugins.flow.agents}`,
		],
		install: "/plugin install flow@md-claude",
		docs: "/docs/flow",
	},
	{
		sku: "MDCC-CLI/03",
		slug: "mdcc",
		title: "The CLI",
		description:
			"Scaffolds the .ai/ workspace. Reads / writes config. Boots the design dev server. Pure ESM, zero runtime deps beyond Node 20+.",
		tags: [
			`subcommands · ${stats.plugins.mdcc.subcommands}`,
			`node ${stats.nodeRange.replace(">=", "≥ ")}`,
			"zero deps",
		],
		install: "npm i -g @1agh/md-claude",
		docs: "/docs/cli",
	},
];

const CATALOG_SIZE = String(CATALOG.length).padStart(2, "0");

export default function HomePage() {
	return (
		<main className="mdcc-landing" id="plugins">
			<section className="mdcc-hero" aria-labelledby="land-h1">
				<div className="mdcc-hero-copy">
					<div className="mdcc-hero-sku">
						<SkuLabel>MDCC-MKT/00</SkuLabel>
						<span aria-hidden="true">·</span>
						<span>THE CATALOG</span>
						<span aria-hidden="true">·</span>
						<span>{stats.version}</span>
						<span aria-hidden="true">·</span>
						<span>PUBLISHED {stats.publishedDate}</span>
					</div>
					<h1 id="land-h1">Plugins & vibes</h1>
					<p className="mdcc-hero-punchline">
						A Claude Code marketplace with <code>opinions</code> · zero webinars.
					</p>
					<p>
						Two plugins, one CLI, zero feelings about your CSS framework. <code>design</code> iterates on HTML
						mocks. <code>flow</code> runs the agentic loop until the feature actually ships. <code>mdcc</code>{" "}
						scaffolds the second-brain <code>.ai/</code> workspace they both pretend they could live without.
					</p>
					<p className="mdcc-hero-fineprint">
						Open-source. Catalog-graded. No telemetry, no signup, no <em className="mdcc-strike">book a demo</em>{" "}
						button. If it crashes, <code>git pull</code> and try again — that&apos;s the entire support contract.
					</p>
					<div className="flex flex-wrap items-center gap-3 mt-4">
						<Link href="/docs" className="mdcc-cta-primary">
							Read the docs →
						</Link>
						<a
							href="https://www.buymeacoffee.com/mdovrtelm"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Buy me a coffee"
							className="inline-flex"
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="https://cdn.buymeacoffee.com/buttons/v2/default-white.png"
								alt="Buy me a coffee"
								style={{ height: 40, width: 'auto' }}
							/>
						</a>
					</div>
				</div>

				<section className="mdcc-install" aria-label="Install snippet">
					<div className="mdcc-install-head">
						<span>
							<strong>install.sh</strong> · inside Claude Code
						</span>
						<CopyButton text={INSTALL_SNIPPET} className="mdcc-install-copy" ariaLabel="Copy install snippet">
							COPY
						</CopyButton>
					</div>
					<pre>{INSTALL_SNIPPET}</pre>
				</section>
			</section>

			<section aria-labelledby="cat-h">
				<div className="mdcc-section-head">
					<h2 id="cat-h">The catalog.</h2>
					<span className="mdcc-eyebrow">
						{CATALOG_SIZE} shipping units · all · {stats.version}
					</span>
				</div>
				<div className="mdcc-cat-grid">
					{CATALOG.map((item) => (
						<Link key={item.sku} href={item.docs} className="mdcc-cat-card">
							<div className="mdcc-cat-card-head">
								<SkuLabel>
									{item.sku} · {item.slug}
								</SkuLabel>
								<span className="text-xs" style={{ color: "var(--fg-2)" }}>
									{stats.version}
								</span>
							</div>
							<h3>
								<code>{item.slug}</code> — {item.title}
							</h3>
							<p>{item.description}</p>
							<div className="flex flex-wrap gap-2" style={{ fontSize: "var(--type-xs)", color: "var(--fg-2)" }}>
								{item.tags.map((tag) => (
									<span key={tag}>{tag}</span>
								))}
							</div>
							<div className="mdcc-cat-card-foot">
								<span>read docs →</span>
							</div>
						</Link>
					))}
				</div>
			</section>

			<footer>
				<dl className="mdcc-meta-footer">
					<div>
						<dt>Published</dt>
						<dd>{stats.publishedDate}</dd>
					</div>
					<div>
						<dt>Source</dt>
						<dd>
							<a href="https://github.com/1aGh/md-claude">github.com/1aGh/md-claude</a>
						</dd>
					</div>
					<div>
						<dt>License</dt>
						<dd>MIT</dd>
					</div>
					<div>
						<dt>Contributors</dt>
						<dd>{stats.contributors}</dd>
					</div>
				</dl>
			</footer>
		</main>
	);
}
