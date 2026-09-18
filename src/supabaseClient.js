import { createClient } from '@supabase/supabase-js';
import { createMockClient } from './mockClient';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

export const isConfigured = Boolean(supabaseUrl && supabaseKey);

/** True when running against the in-browser stand-in rather than Supabase. */
export const isDemo = !isConfigured;

// Falling back to a mock rather than throwing: a module-level throw kills the
// render before anything paints, leaving a blank page with the reason buried
// in the console. Add credentials to .env and this swaps to the real client.
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createMockClient();
