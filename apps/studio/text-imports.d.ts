// Ambient declarations for Bun text imports — `import x from './f.ext' with { type: 'text' }`.
// The dev-server runs under Bun (which honors the import attribute) and ships as
// a `bun --compile` binary (which inlines the text at build time). tsc only needs
// to know the module resolves to a string default export.

declare module '*.tsx.template' {
  const content: string;
  export default content;
}
