import { render, screen } from '@testing-library/react';
import { createMockClient } from './mockClient';
import App from './components/App';

// No credentials in the test env, so exercise the demo path end to end.
jest.mock('./supabaseClient', () => {
  const { createMockClient: create } = require('./mockClient');
  return { isConfigured: false, isDemo: true, supabase: create() };
});

beforeEach(() => window.localStorage.clear());

test('falls back to demo mode instead of a blank page', async () => {
  render(<App />);
  expect(await screen.findByText(/demo mode/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

describe('mock client', () => {
  test('lists active listings newest first, with seller joined', async () => {
    const { data, error } = await createMockClient()
      .from('listings')
      .select('*, users(username, rating)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    expect(data[0].title).toMatch(/wool overcoat/i);
    expect(data[0].users.username).toBe('ada');
  });

  test('sign-up creates a profile and an active session', async () => {
    const client = createMockClient();

    const { error } = await client.auth.signUp({
      email: 'new@example.com',
      password: 'hunter2',
      options: { data: { username: 'newbie' } },
    });
    expect(error).toBeNull();

    const { data } = await client.auth.getSession();
    expect(data.session.user.email).toBe('new@example.com');

    const profile = await client
      .from('users')
      .select('*')
      .eq('id', data.session.user.id)
      .single();
    expect(profile.data.username).toBe('newbie');
  });

  test('rejects a wrong password for a registered account', async () => {
    const client = createMockClient();
    await client.auth.signUp({ email: 'a@b.com', password: 'right' });
    await client.auth.signOut();

    const { error } = await client.auth.signInWithPassword({
      email: 'a@b.com',
      password: 'wrong',
    });
    expect(error).not.toBeNull();
  });
});
