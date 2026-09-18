import React from 'react';
import '../styles/SetupNotice.css';

export default function SetupNotice({ onDismiss }) {
  return (
    <div className="setup-container">
      <div className="setup-box">
        <span className="setup-badge">Go live</span>
        <h1>Connect ReWear to Supabase</h1>
        <p className="setup-lead">
          The app is running on in-browser demo data. Three steps to put it on
          a real database.
        </p>

        <ol className="setup-steps">
          <li>
            <strong>Create the tables.</strong> In your Supabase project, open
            the SQL editor and run <code>supabase/schema.sql</code>.
          </li>
          <li>
            <strong>Add your keys.</strong> Copy <code>.env.example</code> to{' '}
            <code>.env</code> in the project root and fill in the values from
            Supabase → Project Settings → API:
            <pre>
              REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
              {'\n'}REACT_APP_SUPABASE_KEY=your-anon-public-key
            </pre>
            Use the <strong>anon public</strong> key, not the service role key.
          </li>
          <li>
            <strong>Restart the dev server.</strong> Stop <code>npm start</code>{' '}
            and run it again — environment variables are only read at startup,
            so hot reload won't pick them up.
          </li>
        </ol>

        {onDismiss && (
          <button className="setup-back" onClick={onDismiss}>
            ← Back to the demo
          </button>
        )}
      </div>
    </div>
  );
}
