/**
 * Pipeline Module Index
 *
 * Exports all pipeline-related types, stages, and orchestrator.
 */

// Types
export * from './types';

// Orchestrator
export {
  PipelineOrchestrator,
  createPipeline,
  createDefaultPipeline,
  createDemoPipeline,
  createFilePipeline,
} from './orchestrator';

// Stages
export { FetchStage, createFetchStage } from './stages/fetch-stage';
export { ParseStage, createParseStage } from './stages/parse-stage';
export { ProcessStage, createProcessStage } from './stages/process-stage';
export { ImageStage, createImageStage } from './stages/image-stage';
export { FormatStage, createFormatStage, type FrontmatterTemplate } from './stages/format-stage';
export { ValidateStage, createValidateStage, type ValidationResult, type ValidationError } from './stages/validate-stage';
