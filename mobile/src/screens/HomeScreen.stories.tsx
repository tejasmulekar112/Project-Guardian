import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { HomeScreen } from './HomeScreen';

const meta: Meta<typeof HomeScreen> = {
  title: 'Screens/HomeScreen',
  component: HomeScreen,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof HomeScreen>;

export const Default: Story = {};
