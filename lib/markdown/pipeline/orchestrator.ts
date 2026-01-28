/**
 * Pipeline Orchestrator
 *
 * Coordinates the execution of pipeline stages.
 * Handles stage execution, error handling, and performance tracking.
 */

import {
  PipelineInput,
  PipelineOutput,
  PipelineContext,
  PipelineStage,
  PipelineConfig,
  PipelineError,
  StageValidationError,
  PipelineMetrics,
  PipelineMetadata,
} from './types';

export class PipelineOrchestrator {
  private stages: PipelineStage[];
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.stages = config.stages;
    this.config = config;
  }

  /**
   * Executes the pipeline with the given input
   */
  async execute(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = performance.now();

    // Initialize context
    const context: PipelineContext = {
      input,
      warnings: [],
      stageData: {},
      metrics: {
        totalTime: 0,
        fetchTime: 0,
        parseTime: 0,
        processTime: 0,
        imageUploadTime: 0,
        formatTime: 0,
        validateTime: 0,
      },
    };

    try {
      // Execute each stage in order
      for (const stage of this.stages) {
        await this.executeStage(stage, context);
      }

      // Calculate total time
      context.metrics.totalTime = performance.now() - startTime;

      // Build output
      return this.buildOutput(context);
    } catch (error: any) {
      // Calculate total time even on error
      context.metrics.totalTime = performance.now() - startTime;

      // Re-throw with context
      if (error instanceof PipelineError) {
        throw error;
      }

      throw new PipelineError(
        `Pipeline execution failed: ${error.message}`,
        'unknown',
        context,
        error
      );
    }
  }

  /**
   * Executes a single stage with validation and error handling
   */
  private async executeStage(stage: PipelineStage, context: PipelineContext): Promise<void> {
    const stageStartTime = performance.now();

    try {
      // Validate stage input if validation is enabled
      if (!this.config.skipValidation && stage.validate) {
        const isValid = await stage.validate(context);
        if (!isValid) {
          throw new StageValidationError(
            stage.name,
            context,
            'Stage validation returned false'
          );
        }
      }

      // Execute stage
      const updatedContext = await stage.execute(context);

      // Update context with stage output
      Object.assign(context, updatedContext);

      // Record stage success
      if (this.config.collectMetrics) {
        const stageTime = performance.now() - stageStartTime;
        context.metrics[`${stage.name}Time` as keyof PipelineMetrics] = stageTime as any;
      }
    } catch (error: any) {
      // Cleanup on error
      if (stage.cleanup) {
        try {
          await stage.cleanup(context);
        } catch (cleanupError) {
          console.warn(`Stage cleanup failed for ${stage.name}:`, cleanupError);
        }
      }

      // Re-throw with stage context
      if (error instanceof PipelineError) {
        throw error;
      }

      throw new PipelineError(
        `Stage "${stage.name}" failed: ${error.message}`,
        stage.name,
        context,
        error
      );
    }
  }

  /**
   * Builds the final output from the context
   */
  private buildOutput(context: PipelineContext): PipelineOutput {
    if (!context.markdown) {
      throw new PipelineError(
        'Pipeline completed but no markdown was generated',
        'build',
        context
      );
    }

    // Build metadata
    const metadata: PipelineMetadata = {
      title: context.stageData['fetch']?.documentTitle || 'Untitled',
      paragraphCount: context.paragraphs?.length || 0,
      tableCount: context.stageData['process']?.tables?.length || 0,
      imageCount: context.images?.length || 0,
      codeBlockCount: (context.contentBlocks || []).filter((b) => b.type === 'code').length,
      headingCount: (context.contentBlocks || []).filter((b) => b.type === 'heading').length,
      characterCount: context.markdown.length,
      timestamp: Date.now(),
    };

    return {
      content: context.markdown,
      metadata,
      warnings: context.warnings,
      metrics: context.metrics,
    };
  }

  /**
   * Adds a stage to the pipeline
   */
  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  /**
   * Removes a stage from the pipeline by name
   */
  removeStage(stageName: string): void {
    this.stages = this.stages.filter((s) => s.name !== stageName);
  }

  /**
   * Gets the current stages in the pipeline
   */
  getStages(): PipelineStage[] {
    return [...this.stages];
  }

  /**
   * Creates a pipeline with default stages
   */
  static createDefaultPipeline(): PipelineOrchestrator {
    // Import stage creators
    const { createFetchStage } = require('./stages/fetch-stage');
    const { createParseStage } = require('./stages/parse-stage');
    const { createProcessStage } = require('./stages/process-stage');
    const { createImageStage } = require('./stages/image-stage');
    const { createFormatStage } = require('./stages/format-stage');
    const { createValidateStage } = require('./stages/validate-stage');

    const stages = [
      createFetchStage(),
      createParseStage(),
      createProcessStage(),
      createImageStage(),
      createFormatStage(),
      createValidateStage(),
    ];

    return new PipelineOrchestrator({
      stages,
      collectMetrics: true,
      skipValidation: false,
      timeout: 60000, // 60 seconds
    });
  }

  /**
   * Creates a pipeline for demo mode (without image processing)
   */
  static createDemoPipeline(): PipelineOrchestrator {
    const { createFetchStage } = require('./stages/fetch-stage');
    const { createParseStage } = require('./stages/parse-stage');
    const { createProcessStage } = require('./stages/process-stage');
    const { createFormatStage } = require('./stages/format-stage');
    const { createValidateStage } = require('./stages/validate-stage');

    const stages = [
      createFetchStage(),
      createParseStage(),
      createProcessStage(),
      // Skip image stage for demo
      createFormatStage(),
      createValidateStage(),
    ];

    return new PipelineOrchestrator({
      stages,
      collectMetrics: true,
      skipValidation: false,
      timeout: 30000, // 30 seconds for demo
    });
  }

  /**
   * Creates a pipeline for file-based conversion (no Google Docs API)
   */
  static createFilePipeline(): PipelineOrchestrator {
    const { createParseStage } = require('./stages/parse-stage');
    const { createProcessStage } = require('./stages/process-stage');
    const { createFormatStage } = require('./stages/format-stage');
    const { createValidateStage } = require('./stages/validate-stage');

    const stages = [
      // Skip fetch stage - document content is provided directly
      createParseStage(),
      createProcessStage(),
      createFormatStage(),
      createValidateStage(),
    ];

    return new PipelineOrchestrator({
      stages,
      collectMetrics: true,
      skipValidation: false,
      timeout: 30000,
    });
  }
}

// Factory function for easy instantiation
export function createPipeline(config?: Partial<PipelineConfig>): PipelineOrchestrator {
  const defaultConfig: PipelineConfig = {
    stages: [],
    collectMetrics: true,
    skipValidation: false,
    timeout: 60000,
  };

  return new PipelineOrchestrator({ ...defaultConfig, ...config });
}

// Export default pipeline creator
export const createDefaultPipeline = () => PipelineOrchestrator.createDefaultPipeline();
export const createDemoPipeline = () => PipelineOrchestrator.createDemoPipeline();
export const createFilePipeline = () => PipelineOrchestrator.createFilePipeline();
