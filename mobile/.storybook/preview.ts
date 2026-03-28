import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#111827' },
        { name: 'light', value: '#FFFFFF' },
      ],
    },
  },
};

export default preview;
