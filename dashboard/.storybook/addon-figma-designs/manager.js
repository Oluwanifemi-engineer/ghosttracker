/**
 * Storybook Addon: Figma Design References
 *
 * Adds a panel showing Figma design links for each story.
 * Helps designers and developers cross-reference implementation vs design.
 *
 * Usage in stories:
 * ```tsx
 * export default {
 *   title: 'UI/Button',
 *   component: Button,
 *   parameters: {
 *     design: {
 *       type: 'figma',
 *       url: 'https://www.figma.com/file/abc123/Button?node-id=1-2',
 *     },
 *   },
 * };
 * ```
 */

import React from 'react';
import { addons, types } from '@storybook/manager-api';
import { useParameter } from '@storybook/api';

// Panel component
const FigmaDesignPanel = () => {
  const design = useParameter('design', null);

  if (!design) {
    return React.createElement('div', { style: { padding: '16px' } },
      React.createElement('p', { style: { color: '#999' } },
        'No Figma design link configured for this story.'
      )
    );
  }

  if (design.type === 'figma' && design.url) {
    return React.createElement('div', { style: { padding: '16px' } },
      React.createElement('h3', { style: { marginBottom: '8px', fontSize: '14px' } },
        '🎨 Figma Design'
      ),
      React.createElement('p', { style: { marginBottom: '12px', fontSize: '12px', color: '#666' } },
        'Click the link below to view the design in Figma.'
      ),
      React.createElement('a', {
        href: design.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: {
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: '#1ea7fd',
          color: 'white',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
        },
      }, 'Open in Figma ↗'),
      design.url.includes('node-id') && React.createElement('p', {
        style: { marginTop: '12px', fontSize: '12px', color: '#666' },
      }, 'Node ID: ', design.url.split('node-id=')[1])
    );
  }

  if (design.type === 'link') {
    return React.createElement('div', { style: { padding: '16px' } },
      React.createElement('h3', { style: { marginBottom: '8px', fontSize: '14px' } },
        '🎨 Design Reference'
      ),
      React.createElement('a', {
        href: design.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: {
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: '#1ea7fd',
          color: 'white',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
        },
      }, 'Open Design ↗')
    );
  }

  return null;
};

// Register the addon
addons.register('magneetar/figma-designs', (api) => {
  // Add panel
  addons.addPanel('magneetar/figma-designs/panel', {
    title: 'Design',
    type: types.PANEL,
    render: ({ active, key }) => React.createElement(FigmaDesignPanel, { key, active }),
    paramKey: 'design',
  });
});
