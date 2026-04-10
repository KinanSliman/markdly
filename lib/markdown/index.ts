/**
 * Markdown Module Index
 *
 * Exports all markdown-related utilities and converters.
 */

// Unified converter (single source of truth)
export {
  convertGoogleDocToMarkdown,
  convertDocxToMarkdown,
  getConversionResultFromCache,
  setConversionResultInCache,
  type ConversionInput,
  type ConversionOutput,
  type ConversionWarning,
  type ConversionMetrics,
} from "./unified-converter";

// Front matter utilities
export { generateFrontMatter, type FrontmatterTemplate } from "./frontmatter";
