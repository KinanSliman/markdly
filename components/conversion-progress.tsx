/**
 * Conversion Progress Component
 *
 * Displays real-time progress updates during Web Worker conversion
 * Shows stage-by-stage progress with percentage and descriptive messages
 */

'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ConversionProgressProps {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current stage name */
  stage?: string;
  /** Descriptive message */
  message?: string;
  /** Error message if any */
  error?: string;
  /** Whether conversion is in progress */
  isProcessing: boolean;
  /** Whether conversion completed successfully */
  isComplete?: boolean;
  /** Whether to show detailed stage information */
  showStages?: boolean;
}

interface StageInfo {
  name: string;
  label: string;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const STAGES: StageInfo[] = [
  { name: 'init', label: 'Initializing', description: 'Setting up conversion environment' },
  { name: 'parse', label: 'Parsing', description: 'Reading and analyzing file content' },
  { name: 'process', label: 'Processing', description: 'Converting to Markdown format' },
  { name: 'format', label: 'Formatting', description: 'Structuring output' },
  { name: 'validate', label: 'Validating', description: 'Checking for issues' },
  { name: 'complete', label: 'Complete', description: 'Conversion finished successfully' },
  { name: 'cancel', label: 'Cancelled', description: 'Conversion was cancelled' },
];

// ============================================================================
// Component
// ============================================================================

export function ConversionProgress({
  progress,
  stage,
  message,
  error,
  isProcessing,
  isComplete = false,
  showStages = true,
}: ConversionProgressProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    if (stage) {
      const index = STAGES.findIndex(s => s.name === stage);
      if (index !== -1) {
        setCurrentStageIndex(index);
      }
    }
  }, [stage]);

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Conversion Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="w-full p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900">Conversion Complete!</p>
            <p className="text-sm text-green-700">Your Markdown is ready</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isProcessing && progress === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              {message || 'Converting...'}
            </span>
          </div>
          <span className="text-sm font-semibold text-blue-600">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-blue-500 transition-all duration-300 ease-out',
              'relative overflow-hidden'
            )}
            style={{ width: `${progress}%` }}
          >
            {/* Animated gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 opacity-50 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      {showStages && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Conversion Stages
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STAGES.slice(0, 6).map((stageInfo, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isFuture = index > currentStageIndex;

              return (
                <div
                  key={stageInfo.name}
                  className={cn(
                    'p-2 rounded-md border text-xs transition-all duration-200',
                    isCompleted && 'bg-green-50 border-green-200 text-green-700',
                    isCurrent && 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-300',
                    isFuture && 'bg-gray-50 border-gray-200 text-gray-400'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {isCompleted && (
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                    )}
                    {isCurrent && (
                      <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                    )}
                    {isFuture && (
                      <div className="h-3 w-3 rounded-full bg-gray-300 flex-shrink-0" />
                    )}
                    <span className="font-medium">{stageInfo.label}</span>
                  </div>
                  {isCurrent && (
                    <p className="mt-1 text-[10px] opacity-75">
                      {stageInfo.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Progress Info */}
      {stage && message && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium">{stage}:</span>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Hook for Progress Tracking
// ============================================================================

export interface UseConversionProgressOptions {
  onProgress?: (progress: number, stage: string, message: string) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export interface UseConversionProgressReturn {
  progress: number;
  stage?: string;
  message?: string;
  error?: string;
  isProcessing: boolean;
  isComplete: boolean;
  setProgress: (progress: number, stage: string, message: string) => void;
  setError: (error: string) => void;
  setComplete: () => void;
  reset: () => void;
}

export function useConversionProgress(
  options?: UseConversionProgressOptions
): UseConversionProgressReturn {
  const [progress, setProgressState] = useState(0);
  const [stage, setStage] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorState] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const setProgress = (newProgress: number, newStage: string, newMessage: string) => {
    setProgressState(newProgress);
    setStage(newStage);
    setMessage(newMessage);
    setIsProcessing(true);
    options?.onProgress?.(newProgress, newStage, newMessage);
  };

  const setError = (newError: string) => {
    setErrorState(newError);
    setIsProcessing(false);
    options?.onError?.(newError);
  };

  const setComplete = () => {
    setProgressState(100);
    setIsProcessing(false);
    setIsComplete(true);
    options?.onComplete?.({});
  };

  const reset = () => {
    setProgressState(0);
    setStage(undefined);
    setMessage(undefined);
    setErrorState(undefined);
    setIsProcessing(false);
    setIsComplete(false);
  };

  return {
    progress,
    stage,
    message,
    error,
    isProcessing,
    isComplete,
    setProgress,
    setError,
    setComplete,
    reset,
  };
}
