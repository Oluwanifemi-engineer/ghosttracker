/**
 * Style Dictionary Configuration for Magneetar
 *
 * Transforms Figma design tokens (W3C DTCG format) into:
 * - CSS custom properties
 * - Tailwind CSS theme
 * - TypeScript constants
 *
 * Usage:
 *   node config/style-dictionary.js
 *
 * Input: src/styles/tokens/figma-tokens.json
 * Output: src/styles/generated/
 */

const StyleDictionary = require('style-dictionary');

// Custom transforms
StyleDictionary.registerTransform({
  name: 'name/cti/kebab',
  type: 'name',
  transformer: (token) => {
    return token.path.join('-').toLowerCase();
  }
});

// Custom format for Tailwind config
StyleDictionary.registerFormat({
  name: 'json/tailwind',
  formatter: (dictionary) => {
    const theme = {};
    dictionary.allTokens.forEach((token) => {
      const path = token.path;
      let current = theme;

      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }

      current[path[path.length - 1]] = token.value;
    });

    return JSON.stringify(theme, null, 2);
  }
});

// Custom format for TypeScript constants
StyleDictionary.registerFormat({
  name: 'typescript/constants',
  formatter: (dictionary) => {
    const lines = ['// Auto-generated from Figma design tokens', '// Do not edit manually', ''];

    dictionary.allTokens.forEach((token) => {
      const name = token.path.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
      lines.push(`export const ${name} = '${token.value}';`);
    });

    return lines.join('\n');
  }
});

// Configuration
const config = {
  source: ['src/styles/tokens/figma-tokens.json'],
  platforms: {
    // CSS custom properties
    css: {
      transformGroup: 'css',
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: true
          }
        }
      ]
    },

    // Tailwind CSS theme
    tailwind: {
      transformGroup: 'css',
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: 'tailwind-theme.json',
          format: 'json/tailwind'
        }
      ]
    },

    // TypeScript constants
    typescript: {
      transformGroup: 'js',
      buildPath: 'src/styles/generated/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'typescript/constants'
        }
      ]
    }
  }
};

// Build
const dictionary = StyleDictionary.extend(config);
dictionary.buildAllPlatforms();

console.log('✅ Design tokens generated successfully!');
console.log('   - src/styles/generated/tokens.css');
console.log('   - src/styles/generated/tailwind-theme.json');
console.log('   - src/styles/generated/tokens.ts');
