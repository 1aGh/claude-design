/**
 * Docs diagram primitives — barrel. Eight SVG/CSS diagrams in the maude DS, the visual
 * spec for which lives in .design/ui/Docs Infographics.tsx (phase-17 Task 0). Registered
 * into the MDX namespace from site/components/mdx.tsx so any .mdx can drop one inline.
 */

export { DiagramFrame } from './_frame';
export { ArchitectureMap } from './architecture-map';
export { CommandFlow } from './command-flow';
export { CommandTree } from './command-tree';
export { DevServerSchema } from './dev-server-schema';
export { FileTree } from './file-tree';
export { InspectorDiagram } from './inspector-diagram';
export { LoopDiagram } from './loop-diagram';
export { StatPanel } from './stat-panel';
