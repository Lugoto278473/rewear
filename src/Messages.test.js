import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supabase } from './supabaseClient';
import Messages from './components/Messages';

jest.mock('./supabaseClient', () => {
  const { createMockClient } = require('./mockClient');
  return { isConfigured: false, isDemo: true, supabase: createMockClient() };
});

beforeEach(() => window.localStorage.clear());

test('a conversation opened from a listing can send a message', async () => {
  const { data } = await supabase.auth.signUp({ email: 'buyer@example.com', password: 'pw' });
  const draft = {
    listingId: 'seed-1',
    listingTitle: 'Levi 501',
    otherId: 'seed-ada',
    otherName: 'ada',
  };

  render(<Messages session={{ user: data.user }} draft={draft} />);
  expect(await screen.findByText(/say hi to ada/i)).toBeInTheDocument();

  const box = screen.getByPlaceholderText(/write a message/i);
  await userEvent.clear(box);
  await userEvent.type(box, 'Still available?');
  await userEvent.click(screen.getByRole('button', { name: /^send$/i }));

  await waitFor(() => expect(screen.getByText('Still available?')).toBeInTheDocument());
});
