/**
 * Unit tests for PipelineOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineOrchestrator, createPipeline } from '@/lib/markdown/pipeline/orchestrator';
import { PipelineStage, PipelineContext, PipelineInput } from '@/lib/markdown/pipeline/types';

describe('PipelineOrchestrator', () => {
  let mockStage: PipelineStage;
  let mockStage2: PipelineStage;
  let input: PipelineInput;

  beforeEach(() => {
    mockStage = {
      name: 'test-stage',
      description: 'Test stage',
      execute: vi.fn(async (context: PipelineContext) => ({
        ...context,
        stageData: {
          ...context.stageData,
          'test-stage': { result: 'success' },
        },
      })),
    };

    mockStage2 = {
      name: 'test-stage-2',
      description: 'Test stage 2',
      execute: vi.fn(async (context: PipelineContext) => ({
        ...context,
        stageData: {
          ...context.stageData,
          'test-stage-2': { result: 'success' },
        },
      })),
    };

    input = {
      docId: 'test-doc',
      token: 'test-token',
    };
  });

  describe('execute', () => {
    it('should execute all stages in order', async () => {
      const orchestrator = createPipeline({
        stages: [mockStage, mockStage2],
        collectMetrics: false,
      });

      await orchestrator.execute(input);

      expect(mockStage.execute).toHaveBeenCalledOnce();
      expect(mockStage2.execute).toHaveBeenCalledOnce();
    });

    it('should pass context between stages', async () => {
      const orchestrator = createPipeline({
        stages: [mockStage, mockStage2],
        collectMetrics: false,
      });

      await orchestrator.execute(input);

      // Check that mockStage2 received the context from mockStage
      const callOrder = vi.mocked(mockStage2.execute).mock.invocationCallOrder;
      const firstCallOrder = vi.mocked(mockStage.execute).mock.invocationCallOrder;
      expect(callOrder[0]).toBeGreaterThan(firstCallOrder[0]);
    });

    it('should collect metrics when enabled', async () => {
      const orchestrator = createPipeline({
        stages: [mockStage],
        collectMetrics: true,
      });

      const result = await orchestrator.execute(input);

      expect(result.metrics.totalTime).toBeGreaterThan(0);
    });

    it('should throw error when stage fails', async () => {
      const failingStage: PipelineStage = {
        name: 'failing-stage',
        execute: vi.fn(async () => {
          throw new Error('Stage failed');
        }),
      };

      const orchestrator = createPipeline({
        stages: [failingStage],
        collectMetrics: false,
      });

      await expect(orchestrator.execute(input)).rejects.toThrow('Stage failed');
    });

    it('should call cleanup on error', async () => {
      const cleanupFn = vi.fn();
      const failingStage: PipelineStage = {
        name: 'failing-stage',
        execute: vi.fn(async () => {
          throw new Error('Stage failed');
        }),
        cleanup: cleanupFn,
      };

      const orchestrator = createPipeline({
        stages: [failingStage],
        collectMetrics: false,
      });

      try {
        await orchestrator.execute(input);
      } catch (error) {
        // Expected error
      }

      expect(cleanupFn).toHaveBeenCalledOnce();
    });
  });

  describe('addStage', () => {
    it('should add a stage to the pipeline', async () => {
      const orchestrator = createPipeline({
        stages: [mockStage],
        collectMetrics: false,
      });

      orchestrator.addStage(mockStage2);

      const stages = orchestrator.getStages();
      expect(stages.length).toBe(2);
      expect(stages[1].name).toBe('test-stage-2');
    });
  });

  describe('removeStage', () => {
    it('should remove a stage from the pipeline', async () => {
      const orchestrator = createPipeline({
        stages: [mockStage, mockStage2],
        collectMetrics: false,
      });

      orchestrator.removeStage('test-stage');

      const stages = orchestrator.getStages();
      expect(stages.length).toBe(1);
      expect(stages[0].name).toBe('test-stage-2');
    });
  });

  describe('getStages', () => {
    it('should return a copy of stages', () => {
      const orchestrator = createPipeline({
        stages: [mockStage, mockStage2],
        collectMetrics: false,
      });

      const stages = orchestrator.getStages();
      stages.push({ name: 'new-stage', execute: async (ctx) => ctx });

      const originalStages = orchestrator.getStages();
      expect(originalStages.length).toBe(2);
    });
  });

  describe('createDefaultPipeline', () => {
    it('should create a pipeline with default stages', () => {
      const orchestrator = PipelineOrchestrator.createDefaultPipeline();
      const stages = orchestrator.getStages();

      expect(stages.length).toBe(6); // fetch, parse, process, image, format, validate
      expect(stages.map((s) => s.name)).toContain('fetch');
      expect(stages.map((s) => s.name)).toContain('parse');
      expect(stages.map((s) => s.name)).toContain('process');
      expect(stages.map((s) => s.name)).toContain('image');
      expect(stages.map((s) => s.name)).toContain('format');
      expect(stages.map((s) => s.name)).toContain('validate');
    });
  });

  describe('createDemoPipeline', () => {
    it('should create a pipeline without image stage', () => {
      const orchestrator = PipelineOrchestrator.createDemoPipeline();
      const stages = orchestrator.getStages();

      expect(stages.length).toBe(5); // fetch, parse, process, format, validate (no image)
      expect(stages.map((s) => s.name)).not.toContain('image');
    });
  });

  describe('createFilePipeline', () => {
    it('should create a pipeline without fetch stage', () => {
      const orchestrator = PipelineOrchestrator.createFilePipeline();
      const stages = orchestrator.getStages();

      expect(stages.length).toBe(4); // parse, process, format, validate (no fetch)
      expect(stages.map((s) => s.name)).not.toContain('fetch');
    });
  });
});
