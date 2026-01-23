import yaml from "js-yaml";

export interface FrontMatterData {
  [key: string]: any;
}

export interface TemplateVariables {
  title: string;
  date: string;
  author?: string;
  tags?: string[];
  description?: string;
  [key: string]: any;
}

/**
 * Generates front matter from a template and variables
 */
export function generateFrontMatter(
  template: string,
  variables: TemplateVariables
): string {
  // Replace template variables with actual values
  let processedTemplate = template;

  // Replace simple variables {{variable}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    const stringValue = Array.isArray(value) ? value.join(", ") : String(value);
    processedTemplate = processedTemplate.replace(regex, stringValue);
  }

  // Parse as YAML to ensure valid format
  try {
    const parsed = yaml.load(processedTemplate);
    return yaml.dump(parsed, { lineWidth: 100 });
  } catch (error) {
    console.error("Error parsing front matter template:", error);
    // Return the processed template as-is if parsing fails
    return processedTemplate;
  }
}

/**
 * Wraps content with front matter
 */
export function wrapWithFrontMatter(
  content: string,
  frontMatter: string
): string {
  return `---\n${frontMatter}---\n\n${content}`;
}

/**
 * Default front matter template for Next.js
 */
export const NEXTJS_TEMPLATE = `title: {{title}}
date: {{date}}
author: {{author}}
tags: {{tags}}
description: {{description}}
`;

/**
 * Default front matter template for Hugo
 */
export const HUGO_TEMPLATE = `title: {{title}}
date: {{date}}
author: {{author}}
tags: [{{tags}}]
description: {{description}}
draft: false
`;

/**
 * Default front matter template for Docusaurus
 */
export const DOCUSAURUS_TEMPLATE = `title: {{title}}
description: {{description}}
date: {{date}}
authors: {{author}}
tags: [{{tags}}]
`;

/**
 * Default front matter template for Astro
 */
export const ASTRO_TEMPLATE = `---
title: {{title}}
description: {{description}}
pubDate: {{date}}
author: {{author}}
tags: [{{tags}}]
---`;

/**
 * Get template by framework type
 */
export function getTemplateByFramework(framework: string): string {
  switch (framework.toLowerCase()) {
    case "nextjs":
      return NEXTJS_TEMPLATE;
    case "hugo":
      return HUGO_TEMPLATE;
    case "docusaurus":
      return DOCUSAURUS_TEMPLATE;
    case "astro":
      return ASTRO_TEMPLATE;
    default:
      return NEXTJS_TEMPLATE;
  }
}

/**
 * Extracts variables from content (for auto-detection)
 */
export function extractVariablesFromContent(
  content: string,
  docTitle: string
): TemplateVariables {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format

  return {
    title: docTitle,
    date: dateStr,
    author: "Markdly",
    tags: ["docs", "sync"],
    description: `Documentation for ${docTitle}`,
  };
}

/**
 * Validates front matter format
 */
export function validateFrontMatter(frontMatter: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    // Try to parse the YAML
    const parsed = yaml.load(frontMatter);

    // Check for required fields (optional, depends on use case)
    if (typeof parsed !== "object") {
      errors.push("Front matter must be an object");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`YAML parsing error: ${error}`],
    };
  }
}
