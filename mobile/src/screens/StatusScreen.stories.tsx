import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { StatusScreen } from './StatusScreen';

const meta: Meta<typeof StatusScreen> = {
  title: 'Screens/StatusScreen',
  component: StatusScreen,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof StatusScreen>;

export const Default: Story = {};
