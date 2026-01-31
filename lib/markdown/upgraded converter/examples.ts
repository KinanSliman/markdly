/**
 * Example Usage - Unified Converter
 * Real-world examples and common patterns
 */

import {
  convertGoogleDocToMarkdown,
  convertDocxToMarkdown,
  getConversionResultFromCache,
  setConversionResultInCache,
} from './unified-converter';
import fs from 'fs';

// ============================================================================
// Example 1: Basic Google Doc Conversion
// ============================================================================

async function example1_BasicGoogleDoc() {
  console.log('Example 1: Basic Google Doc Conversion');
  
  const result = await convertGoogleDocToMarkdown(
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', // Sample doc ID
    process.env.GOOGLE_ACCESS_TOKEN!,
    true, // It's an access token (not refresh token)
    'my-app/documents', // Cloudinary folder
    false // Not demo mode - upload images
  );

  console.log('Title:', result.title);
  console.log('Headings:', result.headings.length);
  console.log('Images:', result.images.length);
  console.log('Tables:', result.tables.length);
  console.log('Warnings:', result.warnings.length);
  console.log('Processing time:', result.metrics?.totalTime, 'ms');
  
  // Save to file
  fs.writeFileSync('output.md', result.content);
  console.log('Saved to output.md');
}

// ============================================================================
// Example 2: .docx File Conversion with Caching
// ============================================================================

async function example2_DocxWithCaching() {
  console.log('Example 2: .docx with Caching');
  
  const fileBuffer = fs.readFileSync('./sample.docx');
  const fileContent = fileBuffer.toString('base64');
  
  // Check cache first
  let result = await getConversionResultFromCache(fileContent, 'docx');
  
  if (result) {
    console.log('✓ Using cached result');
    console.log('Cache hit! Saved', result.metrics?.totalTime, 'ms');
  } else {
    console.log('✗ Cache miss, converting...');
    
    result = await convertDocxToMarkdown(
      fileBuffer,
      'sample.docx',
      'my-app/uploads',
      false
    );
    
    // Store in cache for next time
    await setConversionResultInCache(fileContent, 'docx', result);
    console.log('✓ Cached for future use');
  }
  
  // Display original vs converted
  console.log('\n--- Original Text (first 200 chars) ---');
  console.log(result.originalContent?.substring(0, 200));
  
  console.log('\n--- Markdown (first 200 chars) ---');
  console.log(result.content.substring(0, 200));
}

// ============================================================================
// Example 3: Batch Processing with Progress
// ============================================================================

async function example3_BatchProcessing() {
  console.log('Example 3: Batch Processing');
  
  const files = [
    'document1.docx',
    'document2.docx',
    'document3.docx',
    'document4.docx',
    'document5.docx',
  ];
  
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    console.log(`Processing ${i + 1}/${files.length}: ${fileName}`);
    
    try {
      const buffer = fs.readFileSync(`./${fileName}`);
      const result = await convertDocxToMarkdown(
        buffer,
        fileName,
        `batch-${Date.now()}`,
        false
      );
      
      results.push({
        fileName,
        success: true,
        headings: result.headings.length,
        images: result.images.length,
        warnings: result.warnings.length,
        time: result.metrics?.totalTime,
      });
      
      // Save output
      const outputName = fileName.replace('.docx', '.md');
      fs.writeFileSync(`./output/${outputName}`, result.content);
      
    } catch (error: any) {
      console.error(`Failed to process ${fileName}:`, error.message);
      results.push({
        fileName,
        success: false,
        error: error.message,
      });
    }
  }
  
  // Summary
  console.log('\n--- Batch Summary ---');
  console.log('Total:', files.length);
  console.log('Success:', results.filter(r => r.success).length);
  console.log('Failed:', results.filter(r => !r.success).length);
  
  const avgTime = results
    .filter(r => r.success && r.time)
    .reduce((sum, r) => sum + (r.time || 0), 0) / results.length;
  console.log('Average time:', avgTime.toFixed(0), 'ms');
}

// ============================================================================
// Example 4: Error Handling and Retry
// ============================================================================

async function example4_ErrorHandling() {
  console.log('Example 4: Error Handling');
  
  const maxRetries = 3;
  let attempt = 0;
  let result = null;
  
  while (attempt < maxRetries && !result) {
    attempt++;
    console.log(`Attempt ${attempt}/${maxRetries}...`);
    
    try {
      const buffer = fs.readFileSync('./problematic.docx');
      result = await convertDocxToMarkdown(
        buffer,
        'problematic.docx',
        'retry-test',
        false
      );
      
      console.log('✓ Success on attempt', attempt);
      
    } catch (error: any) {
      console.error(`✗ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Max retries exceeded. Giving up.');
        throw error;
      }
    }
  }
  
  if (result) {
    // Check for warnings
    if (result.warnings.length > 0) {
      console.log('\n⚠ Warnings found:');
      result.warnings.forEach(w => {
        const icon = w.severity === 'high' ? '🔴' : w.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${icon} [${w.type}] ${w.message}`);
        console.log(`   Suggestion: ${w.suggestion}`);
        if (w.context) {
          console.log(`   Context: ${w.context}`);
        }
      });
    }
  }
}

// ============================================================================
// Example 5: Demo Mode for Testing
// ============================================================================

async function example5_DemoMode() {
  console.log('Example 5: Demo Mode (No Image Upload)');
  
  const buffer = fs.readFileSync('./sample.docx');
  
  // Demo mode: Fast testing without Cloudinary
  const result = await convertDocxToMarkdown(
    buffer,
    'sample.docx',
    undefined,
    true // Demo mode enabled
  );
  
  console.log('Conversion completed in', result.metrics?.totalTime, 'ms');
  console.log('Images found but not uploaded:', result.images.length);
  
  // Images will have original URLs (not Cloudinary)
  result.images.forEach((img, i) => {
    console.log(`Image ${i + 1}: ${img.url.substring(0, 50)}...`);
  });
  
  // Perfect for CI/CD testing without cloud dependencies
  console.log('\nDemo mode is great for:');
  console.log('- Unit tests');
  console.log('- CI/CD pipelines');
  console.log('- Local development');
  console.log('- Quick validation');
}

// ============================================================================
// Example 6: Extracting Specific Content
// ============================================================================

async function example6_ExtractContent() {
  console.log('Example 6: Extract Specific Content');
  
  const buffer = fs.readFileSync('./sample.docx');
  const result = await convertDocxToMarkdown(buffer, 'sample.docx', undefined, true);
  
  // Extract all headings
  console.log('\n--- Document Structure ---');
  result.headings.forEach(h => {
    const indent = '  '.repeat(h.level - 1);
    console.log(`${indent}${'#'.repeat(h.level)} ${h.text}`);
  });
  
  // Extract all tables
  console.log('\n--- Tables ---');
  result.tables.forEach((table, i) => {
    console.log(`\nTable ${i + 1}: ${table.rows.length} rows x ${table.rows[0]?.length || 0} cols`);
    console.log('Headers:', table.rows[0]?.join(', '));
  });
  
  // Extract all images
  console.log('\n--- Images ---');
  result.images.forEach((img, i) => {
    console.log(`${i + 1}. ${img.alt || 'Untitled'}`);
    console.log(`   URL: ${img.url}`);
  });
  
  // Extract code blocks
  const codeBlocks = result.content.match(/```[\s\S]*?```/g) || [];
  console.log('\n--- Code Blocks ---');
  console.log('Found', codeBlocks.length, 'code block(s)');
  codeBlocks.forEach((block, i) => {
    const lang = block.match(/```(\w+)/)?.[1] || 'plain';
    const lines = block.split('\n').length - 2; // Exclude fence lines
    console.log(`${i + 1}. Language: ${lang}, Lines: ${lines}`);
  });
}

// ============================================================================
// Example 7: Quality Control and Validation
// ============================================================================

async function example7_QualityControl() {
  console.log('Example 7: Quality Control');
  
  const buffer = fs.readFileSync('./sample.docx');
  const result = await convertDocxToMarkdown(buffer, 'sample.docx', undefined, true);
  
  // Quality metrics
  const quality = {
    hasTitle: !!result.title && result.title !== 'Document',
    hasHeadings: result.headings.length > 0,
    hasImages: result.images.length > 0,
    hasTables: result.tables.length > 0,
    hasWarnings: result.warnings.length > 0,
    highSeverityWarnings: result.warnings.filter(w => w.severity === 'high').length,
    mediumSeverityWarnings: result.warnings.filter(w => w.severity === 'medium').length,
    processingTime: result.metrics?.totalTime || 0,
  };
  
  console.log('\n--- Quality Report ---');
  console.log('Title:', quality.hasTitle ? '✓' : '✗');
  console.log('Structure:', quality.hasHeadings ? `✓ (${result.headings.length} headings)` : '✗');
  console.log('Images:', quality.hasImages ? `✓ (${result.images.length})` : '✗');
  console.log('Tables:', quality.hasTables ? `✓ (${result.tables.length})` : '✗');
  console.log('Processing Time:', quality.processingTime, 'ms');
  
  console.log('\n--- Issues ---');
  if (quality.highSeverityWarnings > 0) {
    console.log('🔴 High severity:', quality.highSeverityWarnings);
  }
  if (quality.mediumSeverityWarnings > 0) {
    console.log('🟡 Medium severity:', quality.mediumSeverityWarnings);
  }
  if (!quality.hasWarnings) {
    console.log('✓ No issues found');
  }
  
  // Pass/Fail criteria
  const passed = 
    quality.hasTitle &&
    quality.highSeverityWarnings === 0 &&
    quality.processingTime < 10000;
  
  console.log('\n--- Overall ---');
  console.log(passed ? '✓ PASSED' : '✗ FAILED');
  
  return passed;
}

// ============================================================================
// Example 8: Performance Monitoring
// ============================================================================

async function example8_PerformanceMonitoring() {
  console.log('Example 8: Performance Monitoring');
  
  const buffer = fs.readFileSync('./sample.docx');
  const result = await convertDocxToMarkdown(buffer, 'sample.docx', undefined, true);
  
  if (!result.metrics) {
    console.log('No metrics available');
    return;
  }
  
  console.log('\n--- Performance Breakdown ---');
  console.log('Total Time:', result.metrics.totalTime, 'ms');
  console.log('\nStages:');
  
  const stages = result.metrics.stages;
  const stageNames = Object.keys(stages);
  const maxNameLength = Math.max(...stageNames.map(n => n.length));
  
  stageNames.forEach(stage => {
    const time = stages[stage];
    const percentage = ((time / result.metrics!.totalTime) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(Number(percentage) / 2));
    
    console.log(
      `  ${stage.padEnd(maxNameLength)} : ${time.toString().padStart(5)}ms (${percentage.padStart(5)}%) ${bar}`
    );
  });
  
  // Identify bottlenecks
  const slowestStage = stageNames.reduce((a, b) => 
    stages[a] > stages[b] ? a : b
  );
  
  console.log('\n--- Analysis ---');
  console.log('Slowest stage:', slowestStage, `(${stages[slowestStage]}ms)`);
  
  if (result.metrics.parallelProcessing) {
    console.log('Parallel processing: ✓ Enabled');
    console.log('Images processed:', result.metrics.imageCount);
  } else {
    console.log('Parallel processing: ✗ Not used');
  }
  
  if (result.metrics.cached) {
    console.log('Cache: ✓ Hit (instant result)');
  } else {
    console.log('Cache: ✗ Miss (full conversion)');
  }
}

// ============================================================================
// Example 9: Webhook/API Endpoint Usage
// ============================================================================

async function example9_WebhookHandler(request: {
  body: {
    docId?: string;
    token?: string;
    fileData?: string;
    fileName?: string;
  }
}) {
  console.log('Example 9: Webhook Handler');
  
  try {
    let result;
    
    // Handle Google Doc
    if (request.body.docId && request.body.token) {
      result = await convertGoogleDocToMarkdown(
        request.body.docId,
        request.body.token,
        true,
        'webhooks/gdocs',
        false
      );
    }
    // Handle .docx upload
    else if (request.body.fileData && request.body.fileName) {
      const buffer = Buffer.from(request.body.fileData, 'base64');
      result = await convertDocxToMarkdown(
        buffer,
        request.body.fileName,
        'webhooks/uploads',
        false
      );
    }
    else {
      throw new Error('Invalid request: missing required fields');
    }
    
    // Prepare response
    const response = {
      success: true,
      data: {
        title: result.title,
        markdown: result.content,
        metadata: {
          headings: result.headings.length,
          images: result.images.length,
          tables: result.tables.length,
          processingTime: result.metrics?.totalTime,
        },
        warnings: result.warnings.map(w => ({
          type: w.type,
          message: w.message,
          severity: w.severity,
        })),
      },
    };
    
    console.log('✓ Webhook processed successfully');
    return response;
    
  } catch (error: any) {
    console.error('✗ Webhook processing failed:', error.message);
    
    return {
      success: false,
      error: {
        message: error.message,
        type: 'conversion_error',
      },
    };
  }
}

// ============================================================================
// Example 10: Custom Warning Handler
// ============================================================================

async function example10_CustomWarningHandler() {
  console.log('Example 10: Custom Warning Handler');
  
  const buffer = fs.readFileSync('./sample.docx');
  const result = await convertDocxToMarkdown(buffer, 'sample.docx', undefined, true);
  
  // Group warnings by severity
  const grouped = {
    high: result.warnings.filter(w => w.severity === 'high'),
    medium: result.warnings.filter(w => w.severity === 'medium'),
    low: result.warnings.filter(w => w.severity === 'low'),
  };
  
  // Custom handling based on severity
  if (grouped.high.length > 0) {
    console.error('🔴 CRITICAL ISSUES - Manual review required');
    grouped.high.forEach(w => {
      console.error(`  [${w.type}] ${w.message}`);
      console.error(`  Fix: ${w.suggestion}`);
      if (w.context) console.error(`  At: ${w.context}`);
    });
    
    // Send alert email/slack
    // await sendAlert('Critical conversion issues', grouped.high);
  }
  
  if (grouped.medium.length > 0) {
    console.warn('🟡 WARNINGS - Review recommended');
    grouped.medium.forEach(w => {
      console.warn(`  [${w.type}] ${w.message}`);
    });
  }
  
  if (grouped.low.length > 0) {
    console.log('🟢 MINOR ISSUES - Safe to ignore');
    console.log(`  ${grouped.low.length} low-priority warning(s)`);
  }
  
  // Log to monitoring system
  const warningStats = {
    timestamp: Date.now(),
    fileName: 'sample.docx',
    high: grouped.high.length,
    medium: grouped.medium.length,
    low: grouped.low.length,
    total: result.warnings.length,
  };
  
  console.log('\n--- Warning Statistics ---');
  console.log(JSON.stringify(warningStats, null, 2));
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  const examples = [
    // Uncomment to run specific examples
    // example1_BasicGoogleDoc,
    // example2_DocxWithCaching,
    // example3_BatchProcessing,
    // example4_ErrorHandling,
    example5_DemoMode,
    example6_ExtractContent,
    example7_QualityControl,
    example8_PerformanceMonitoring,
    // example9_WebhookHandler,
    example10_CustomWarningHandler,
  ];
  
  for (const example of examples) {
    try {
      console.log('\n' + '='.repeat(80));
      await example();
      console.log('='.repeat(80) + '\n');
    } catch (error: any) {
      console.error('Example failed:', error.message);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  example1_BasicGoogleDoc,
  example2_DocxWithCaching,
  example3_BatchProcessing,
  example4_ErrorHandling,
  example5_DemoMode,
  example6_ExtractContent,
  example7_QualityControl,
  example8_PerformanceMonitoring,
  example9_WebhookHandler,
  example10_CustomWarningHandler,
};
