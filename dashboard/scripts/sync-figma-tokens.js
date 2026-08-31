#!/usr/bin/env node

/**
 * Sync Figma Design Tokens to Tailwind CSS
 *
 * This script reads the Figma tokens JSON and updates the Tailwind config
 * with the latest design decisions from Figma.
 *
 * Usage:
 *   node scripts/sync-figma-tokens.js
 *
 * Workflow:
 *   1. Export tokens from Figma (using Tokens Studio plugin)
 *   2. Save to src/styles/tokens/figma-tokens.json
 *   3. Run this script
 *   4. Tailwind config is updated automatically
 */

const fs = require('fs');
const path = require('path');

// Paths
const TOKENS_PATH = path.join(__dirname, '../src/styles/tokens/figma-tokens.json');
const TAILWIND_CONFIG_PATH = path.join(__dirname, '../tailwind.config.ts');

// Read tokens
function readTokens() {
  try {
    const tokensRaw = fs.readFileSync(TOKENS_PATH, 'utf-8');
    return JSON.parse(tokensRaw);
  } catch (error) {
    console.error('❌ Error reading tokens:', error.message);
    process.exit(1);
  }
}

// Convert token path to Tailwind color key
function tokenPathToTailwindKey(path) {
  return path.join('/');
}

// Extract colors from tokens
function extractColors(tokens) {
  const colors = {};

  // Brand colors
  if (tokens.color?.brand) {
    colors['brand-primary'] = tokens.color.brand.primary?.$value || '#3b82f6';
    colors['brand-primary-hover'] = tokens.color.brand['primary-hover']?.$value || '#2563eb';
  }

  // Semantic colors
  if (tokens.color?.semantic) {
    colors['success'] = tokens.color.semantic.success?.$value || '#22c55e';
    colors['warning'] = tokens.color.semantic.warning?.$value || '#f59e0b';
    colors['danger'] = tokens.color.semantic.danger?.$value || '#ef4444';
    colors['info'] = tokens.color.semantic.info?.$value || '#0ea5e9';
  }

  // Background colors
  if (tokens.color?.background) {
    colors['bg-default'] = tokens.color.background.default?.$value || '#0a0a0a';
    colors['bg-card'] = tokens.color.background.card?.$value || '#1a1a2e';
    colors['bg-muted'] = tokens.color.background.muted?.$value || '#262626';
    colors['bg-elevated'] = tokens.color.background.elevated?.$value || '#27272a';
  }

  // Foreground colors
  if (tokens.color?.foreground) {
    colors['fg-default'] = tokens.color.foreground.default?.$value || '#fafafa';
    colors['fg-muted'] = tokens.color.foreground.muted?.$value || '#a3a3a3';
    colors['fg-subtle'] = tokens.color.foreground.subtle?.$value || '#737373';
  }

  // Neutral colors
  if (tokens.color?.neutral) {
    for (const [key, value] of Object.entries(tokens.color.neutral)) {
      if (value?.$value) {
        colors[`neutral-${key}`] = value.$value;
      }
    }
  }

  return colors;
}

// Extract spacing from tokens
function extractSpacing(tokens) {
  const spacing = {};

  if (tokens.spacing) {
    for (const [key, value] of Object.entries(tokens.spacing)) {
      if (value?.$value) {
        spacing[key] = value.$value;
      }
    }
  }

  return spacing;
}

// Generate Tailwind config addition
function generateTailwindAddition(colors, spacing) {
  const lines = [];

  lines.push('// Auto-synced from Figma design tokens');
  lines.push('// Run: node scripts/sync-figma-tokens.js');
  lines.push('');

  if (Object.keys(colors).length > 0) {
    lines.push('colors: {');
    for (const [key, value] of Object.entries(colors)) {
      lines.push(`  '${key}': '${value}',`);
    }
    lines.push('},');
  }

  if (Object.keys(spacing).length > 0) {
    lines.push('');
    lines.push('spacing: {');
    for (const [key, value] of Object.entries(spacing)) {
      lines.push(`  '${key}': '${value}',`);
    }
    lines.push('},');
  }

  return lines.join('\n');
}

// Main
function main() {
  console.log('🎨 Syncing Figma design tokens to Tailwind...\n');

  // Read tokens
  const tokens = readTokens();
  console.log('✅ Read tokens from:', TOKENS_PATH);

  // Extract values
  const colors = extractColors(tokens);
  const spacing = extractSpacing(tokens);

  console.log(`   Found ${Object.keys(colors).length} colors`);
  console.log(`   Found ${Object.keys(spacing).length} spacing values`);

  // Generate config addition
  const configAddition = generateTailwindAddition(colors, spacing);

  // Write to separate file for manual merge
  const outputPath = path.join(__dirname, '../src/styles/generated/tailwind-sync.ts');
  fs.writeFileSync(outputPath, `// Auto-generated - merge into tailwind.config.ts\n\nexport const figmaTokens = {\n${configAddition}\n};\n`);

  console.log('\n✅ Generated Tailwind sync file:', outputPath);
  console.log('\n📋 Next steps:');
  console.log('   1. Review the generated file');
  console.log('   2. Merge into tailwind.config.ts');
  console.log('   3. Run: npm run build');

  // Also update CSS variables
  console.log('\n🎨 Generating CSS variables...');
  const cssContent = generateCSSVariables(tokens);
  const cssPath = path.join(__dirname, '../src/styles/generated/figma-variables.css');
  fs.writeFileSync(cssPath, cssContent);
  console.log('✅ Generated CSS variables:', cssPath);
}

function generateCSSVariables(tokens) {
  const lines = ['/**', ' * Auto-generated from Figma design tokens', ' */', ':root {'];

  // Flatten tokens into CSS variables
  function flattenTokens(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const varName = prefix ? `${prefix}-${key}` : key;

      if (value?.$value) {
        lines.push(`  --${varName}: ${value.$value};`);
      } else if (typeof value === 'object' && !value.$value) {
        flattenTokens(value, varName);
      }
    }
  }

  flattenTokens(tokens);
  lines.push('}');

  return lines.join('\n');
}

main();
