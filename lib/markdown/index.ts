/**
 * Markdown Module Index
 *
 * Exports all markdown-related utilities and converters.
 */

// Main converter (legacy - monolithic architecture)
export {
  convertGoogleDocToMarkdown,
  processGoogleDocImage,
  processCodeBlocks,
  fixHeadingHierarchy,
  extractImagesFromDoc,
  stripComments,
  cleanupWhitespace,
  validateMarkdown,
  normalizeListMarkers,
  type GoogleDocContent,
  type ConversionWarning,
} from './converter';

// Pipeline-based converter (new - modular architecture)
export {
  convertGoogleDocToMarkdownWithPipeline,
  convertGoogleDocToMarkdownDemo,
  getConversionMetrics,
  validateGoogleDocId,
  extractDocIdFromUrl,
} from './pipeline-converter';

// Front matter utilities
export { generateFrontmatter, type FrontmatterTemplate } from './frontmatter';

// Pipeline module (full exports)
export * from './pipeline';
