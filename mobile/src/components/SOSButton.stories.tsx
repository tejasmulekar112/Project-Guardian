import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SOSButton } from './SOSButton';

const meta: Meta<typeof SOSButton> = {
  title: 'Components/SOSButton',
  component: SOSButton,
  argTypes: {
    onPress: { action: 'pressed' },
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SOSButton>;

export const Default: Story = {
  args: {
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
