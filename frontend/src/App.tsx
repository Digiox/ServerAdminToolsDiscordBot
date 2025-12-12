import './style.css'
import { useEffect, useMemo, useState } from 'react'
import { SERVER_EVENT_NAMES } from './sharedEvents'

type EventName = (typeof SERVER_EVENT_NAMES)[number]

interface ServerConfig {
  id: number
  label: string
  defaultChannelId: string | null
  categoryId?: string | null
  eventChannelMap: Record<string, string>
  token?: string | null
}

interface GuildConfig {
  id: string
  name?: string
  servers: ServerConfig[]
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
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`Request failed ${res.status}`)
  return res.json() as Promise<T>
}

function App() {
  const [data, setData] = useState<GuildApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null)

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

  useEffect(() => {
    if (data?.guilds?.length) {
      setSelectedGuildId((prev) => (prev && data.guilds.some((g) => g.id === prev) ? prev : data.guilds[0].id))
    } else {
      setSelectedGuildId(null)
    }
  }, [data])

  if (loading) return <div className="content"><p>Loading...</p></div>

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

  const selectedGuild = data.guilds.find((g) => g.id === selectedGuildId) || null

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Server Admin Tools</h1>
        <div className="user">Logged in as {data.user?.username ?? 'unknown'}</div>
        <nav>
          <a href="/auth/discord">Re-login</a>
          <a href="/logout">Logout</a>
        </nav>
        <div className="muted" style={{ marginTop: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Guilds</div>
        <div className="guild-list">
          {data.guilds.map((g) => (
            <button
              key={g.id}
              className={selectedGuildId === g.id ? 'active' : ''}
              onClick={() => setSelectedGuildId(g.id)}
            >
              {g.name ?? g.id}
            </button>
          ))}
          {data.guilds.length === 0 && <div className="muted">Aucune guilde autorisee</div>}
        </div>
        <div className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
          &gt; Create/link server &gt; set channels &gt; copy token into Arma mod config.
        </div>
      </aside>
      <main className="content">
        <h2 style={{ marginTop: 0 }}>Guilds & Servers</h2>
        {data.guilds.length === 0 && <p className="muted">Aucune guilde autorisee.</p>}
        {data.guilds.length > 0 && !selectedGuild && <p className="muted">Selectionnez une guilde.</p>}
        {selectedGuild && (
          <div className="grid">
            <GuildCard key={selectedGuild.id} guild={selectedGuild} onRefresh={load} />
          </div>
        )}
      </main>
    </div>
  )
}

function GuildCard({ guild, onRefresh }: { guild: GuildConfig; onRefresh: () => void }) {
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const servers = guild.servers ?? []

  const registerServer = async () => {
    setMessage(null)
    const body = { label, token }
    const res = await fetch(`/web/guild/${guild.id}/server`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || `Failed (${res.status})`)
    }
    const txt = await res.text()
    if (txt && !txt.startsWith('<')) setMessage(txt)
    onRefresh()
  }

  return (
    <div className="card">
      <h2>{guild.name ?? guild.id}</h2>
      <p className="muted" style={{ marginTop: -8 }}>ID: {guild.id}</p>

      <div className="muted" style={{ marginBottom: '0.5rem' }}>Create or link a server</div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <input placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input placeholder="token (optional/new)" value={token} onChange={(e) => setToken(e.target.value)} />
        <button onClick={registerServer}>Register</button>
      </div>
      {message && <div className="token">{message}</div>}

      {servers.length === 0 && <p className="muted">No servers linked yet.</p>}
      {servers.map((s) => (
        <ServerCard key={s.id} guildId={guild.id} server={s} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

function ServerCard({ guildId, server, onRefresh }: { guildId: string; server: ServerConfig; onRefresh: () => void }) {
  const [defaultChannel, setDefaultChannel] = useState('')
  const [eventChannelId, setEventChannelId] = useState('')
  const [eventName, setEventName] = useState<EventName>(SERVER_EVENT_NAMES[0])

  const mappedEvents = useMemo(() => Object.entries(server.eventChannelMap || {}), [server])

  const setDefault = async () => {
    await fetch(`/web/guild/${guildId}/default-channel`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: server.label, channelId: defaultChannel }),
    })
    onRefresh()
  }

  const setEvent = async () => {
    await fetch(`/web/guild/${guildId}/event-channel`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: server.label, event: eventName, channelId: eventChannelId }),
    })
    onRefresh()
  }

  return (
    <div className="card" style={{ marginTop: '0.75rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Server {server.label}</h3>
        <span className="pill">ID {server.id}</span>
      </div>
      {server.token && (
        <div style={{ margin: '0.35rem 0' }}>
          <div className="muted">Token</div>
          <div className="token">{server.token}</div>
        </div>
      )}
      <p className="muted">Default channel: {server.defaultChannelId ?? 'not set'}</p>
      {server.categoryId && <p className="muted">Category: {server.categoryId}</p>}

      <details>
        <summary>Event channel map</summary>
        <ul>
          {mappedEvents.length === 0 && <li className="muted">Empty</li>}
          {mappedEvents.map(([evt, chan]) => (
            <li key={evt}>
              <code>{evt}</code> -&gt; <code>{chan}</code>
            </li>
          ))}
        </ul>
      </details>

      <div style={{ marginTop: '0.75rem' }}>
        <div className="muted">Set default channel</div>
        <div className="row">
          <input
            placeholder="channel ID"
            value={defaultChannel}
            onChange={(e) => setDefaultChannel(e.target.value)}
          />
          <button onClick={setDefault}>Save</button>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <div className="muted">Map event -&gt; channel</div>
        <div className="row">
          <select value={eventName} onChange={(e) => setEventName(e.target.value as EventName)}>
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
          <button onClick={setEvent}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default App
