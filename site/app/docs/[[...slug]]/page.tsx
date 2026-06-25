import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageMetaFooter } from '@/components/mdcc/page-meta-footer';
import { type Crumb, SkuBreadcrumb } from '@/components/mdcc/sku-breadcrumb';
import { getMDXComponents } from '@/components/mdx';
import { gitConfig, siteUrl } from '@/lib/shared';
import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source';
import stats from '@/lib/stats.json';

const SECTION_SKU: Record<string, string> = {
  design: 'MDCC-DSN/01',
  flow: 'MDCC-FLW/02',
  cli: 'MDCC-CLI/03',
  reference: 'MDCC-REF/04',
  recipes: 'MDCC-RCP/05',
};

function buildCrumbs(slug: readonly string[] | undefined): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Docs', href: '/docs' }];
  if (!slug || slug.length === 0) return crumbs;
  let href = '/docs';
  for (const seg of slug) {
    href += `/${seg}`;
    crumbs.push({ label: seg.replace(/-/g, ' '), href });
  }
  return crumbs;
}

function skuFor(slug: readonly string[] | undefined): string | undefined {
  if (!slug || slug.length === 0) return 'MDCC-DOC/00';
  const head = slug[0];
  const sku = SECTION_SKU[head];
  if (!sku) return undefined;
  if (slug.length > 1) {
    return `${sku}.${slug.slice(1).join('-')}`;
  }
  return sku;
}

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const editUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`;
  const crumbs = buildCrumbs(params.slug);
  const sku = skuFor(params.slug);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      ...(crumb.href ? { item: new URL(crumb.href, siteUrl).href } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static, build-time JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <SkuBreadcrumb crumbs={crumbs} sku={sku} />
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pb-6">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={editUrl} />
        </div>
        <DocsBody>
          <MDX
            components={getMDXComponents({
              a: createRelativeLink(source, page),
            })}
          />
        </DocsBody>
        <PageMetaFooter
          editUrl={editUrl}
          sku={sku}
          updated={(stats.pageUpdated as Record<string, string>)[page.path]}
        />
      </DocsPage>
    </>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
