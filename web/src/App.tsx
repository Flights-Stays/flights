import { initPro } from '@proappstore/sdk'
import { useProAuth } from '@proappstore/sdk/hooks'

const app = initPro({ appId: 'flights' })

export default function App() {
  const { user, loading, signIn, signOut } = useProAuth(app)

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-[var(--muted)]">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="text-center">
        <h1 className="display-font text-3xl font-bold text-[var(--ink)]">flights</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Edit <code className="rounded bg-[var(--line)] px-1.5 py-0.5 text-xs">web/src/App.tsx</code> to start building.
        </p>

        <div className="mt-6">
          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--ink)]">
                Signed in as <strong>{user.login}</strong>
              </p>
              <button
                onClick={signOut}
                className="rounded-full border border-[var(--line-strong)] px-4 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="rounded-2xl bg-[var(--ink)] px-6 py-2.5 text-sm font-semibold text-[var(--paper)] hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </div>

        <p className="mt-8 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          Part of{' '}
          <a href="https://proappstore.online" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--ink)]">
            ProAppStore
          </a>
        </p>
      </div>
    </div>
  )
}
