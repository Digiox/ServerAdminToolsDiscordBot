import './style.css'
import { useEffect, useMemo, useState } from 'react'
import { SERVER_EVENT_NAMES } from './sharedEvents'

interface GuildConfig {
  defaultChannelId: string | null
  eventChannelMap: Record<string, string>
  id: string
  apiToken?: string | null
}

interface GuildApiResponse {
  guilds: GuildConfig[]
  user?: { username: string }
}

const fetchJson = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (res.status === 401) {
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`Request failed ${res.status}`)
  return res.json() as Promise<T>
}

function App() {
  const [data, setData] = useState<GuildApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchJson<GuildApiResponse>('/api/guilds')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <div className="content"><p>Loading…</p></div>

  if (error === 'unauthorized') {
    return (
      <div className="content">
        <div className="card">
          <h2>Login required</h2>
          <p className="muted">Sign in with Discord to access the dashboard.</p>
          <button onClick={() => (window.location.href = '/auth/discord')}>Login with Discord</button>
        </div>
      </div>
    )
  }

  if (error) return <div className="content"><p>Error: {error}</p></div>
  if (!data) return null

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Server Admin Tools</h1>
        <div className="user">Logged in as {data.user?.username ?? 'unknown'}</div>
        <nav>
          <a className="active" href="#">Dashboard</a>
          <a href="/auth/discord">Re-login</a>
          <a href="/logout">Logout</a>
        </nav>
      </aside>
      <main className="content">
        <h2 style={{ marginTop: 0 }}>Guilds</h2>
        <div className="grid">
          {data.guilds.map((g) => (
            <GuildCard key={g.id} guild={g} onRefresh={load} />
          ))}
        </div>
      </main>
    </div>
  )
}

function GuildCard({ guild, onRefresh }: { guild: GuildConfig; onRefresh: () => void }) {
  const [channelId, setChannelId] = useState('')
  const [eventChannelId, setEventChannelId] = useState('')
  const [eventName, setEventName] = useState<(typeof SERVER_EVENT_NAMES)[number]>(SERVER_EVENT_NAMES[0])

  const mappedEvents = useMemo(() => Object.entries(guild.eventChannelMap || {}), [guild])

  const regenToken = async () => {
    await fetch('/web/guild/' + guild.id + '/token', { method: 'POST', credentials: 'include' })
    // refetch to display token if backend includes it (currently not returned); just refresh UI
    onRefresh()
  }

  const saveDefault = async () => {
    await fetch('/web/guild/' + guild.id + '/default-channel', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    })
    onRefresh()
  }

  const saveEvent = async () => {
    await fetch('/web/guild/' + guild.id + '/event-channel', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, channelId: eventChannelId }),
    })
    onRefresh()
  }

  return (
    <div className="card">
      <h2>Guild {guild.id}</h2>
      <p className="muted">Default channel: {guild.defaultChannelId ?? 'not set'}</p>

      <details>
        <summary>Event channel map</summary>
        <ul>
          {mappedEvents.length === 0 && <li className="muted">Empty</li>}
          {mappedEvents.map(([evt, chan]) => (
            <li key={evt}>
              <code>{evt}</code> → <code>{chan}</code>
            </li>
          ))}
        </ul>
      </details>

      <div style={{ marginTop: '0.75rem' }}>
        <div className="muted">Set default channel</div>
        <div className="row">
          <input
            placeholder="channel ID"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          />
          <button onClick={saveDefault}>Save</button>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <div className="muted">Map event → channel</div>
        <div className="row">
          <select value={eventName} onChange={(e) => setEventName(e.target.value as (typeof SERVER_EVENT_NAMES)[number])}>
            {SERVER_EVENT_NAMES.map((evt) => (
              <option key={evt} value={evt}>
                {evt}
              </option>
            ))}
          </select>
          <input
            placeholder="channel ID"
            value={eventChannelId}
            onChange={(e) => setEventChannelId(e.target.value)}
          />
          <button onClick={saveEvent}>Save</button>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={regenToken}>Generate new API token</button>
      </div>
    </div>
  )
}

export default App
