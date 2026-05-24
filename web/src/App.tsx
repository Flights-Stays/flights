import { initPro } from '@proappstore/sdk'
import { useProAuth, useTheme, useProNotifications } from '@proappstore/sdk/hooks'
import { useState, useCallback, useEffect, useRef } from 'react'

const app = initPro({ appId: 'flights' })

type Tab = 'flights' | 'hotels' | 'trips'
type FlightResult = {
  id: string
  airline: string
  departure: string
  arrival: string
  origin: string
  destination: string
  price: number
  duration: string
  stops: number
}
type HotelResult = {
  id: string
  name: string
  location: string
  price: number
  rating: number
  image: string
  amenities: string[]
}
type SavedTrip = {
  id: string
  destination: string
  dates: string
  flights: FlightResult[]
  hotels: HotelResult[]
  createdAt: number
}

const MIGRATIONS = [
  {
    name: '0001_trips',
    sql: `CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      destination TEXT NOT NULL,
      dates TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  },
  {
    name: '0002_favorites',
    sql: `CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  },
]

export default function App() {
  const { user, loading, signIn, signOut } = useProAuth(app)
  const { theme, setPreference } = useTheme()
  const { permission, isSubscribed, subscribe, unsubscribe } = useProNotifications(app)
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState('')
  const migratedRef = useRef(false)
  const [tab, setTab] = useState<Tab>('flights')
  const [trips, setTrips] = useState<SavedTrip[]>([])
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Flight search state
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [travelers, setTravelers] = useState(1)
  const [flightResults, setFlightResults] = useState<FlightResult[]>([])
  const [searchingFlights, setSearchingFlights] = useState(false)

  // Hotel search state
  const [hotelCity, setHotelCity] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [guests, setGuests] = useState(1)
  const [hotelResults, setHotelResults] = useState<HotelResult[]>([])
  const [searchingHotels, setSearchingHotels] = useState(false)
  const [mapUrl, setMapUrl] = useState('')

  // Geocode hotel city for map display
  const showMap = useCallback(async (city: string) => {
    try {
      const results = await app.maps.geocode(city, 1)
      if (results.length > 0) {
        const { lat, lng } = results[0]
        setMapUrl(app.maps.embedUrl(lat, lng, 12))
      }
    } catch (e) {
      console.error('Geocode failed:', e)
    }
  }, [])

  // Run migrations once on sign-in + load preferences
  useEffect(() => {
    if (!user || migratedRef.current) return
    migratedRef.current = true
    app.db.migrate(MIGRATIONS)
      .then(result => {
        console.log('Migrations:', result)
        setDbReady(true)
      })
      .catch(e => {
        console.error('Migration failed:', e)
        setDbError(e instanceof Error ? e.message : 'DB migration failed')
      })
    // Load saved preferences from KV
    app.kv.get<{ lastOrigin?: string; lastDestination?: string }>('prefs')
      .then(prefs => {
        if (prefs?.lastOrigin) setOrigin(prefs.lastOrigin)
        if (prefs?.lastDestination) setDestination(prefs.lastDestination)
      })
      .catch(() => {}) // KV may not have prefs yet
  }, [user])

  const searchFlights = useCallback(async () => {
    if (!origin || !destination || !departDate) return
    setSearchingFlights(true)
    // Save preferences
    app.kv.set('prefs', { lastOrigin: origin, lastDestination: destination }).catch(() => {})
    try {
      const { text } = await app.ai.generate(
        `Generate 5 realistic flight search results as JSON array for a flight from ${origin} to ${destination} on ${departDate}${returnDate ? ` returning ${returnDate}` : ''} for ${travelers} traveler(s). Each result: {"id":"f1","airline":"...","departure":"HH:MM","arrival":"HH:MM","origin":"${origin}","destination":"${destination}","price":number,"duration":"Xh Ym","stops":0|1|2}. Return ONLY the JSON array, no explanation.`
      )
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      setFlightResults(parsed)
    } catch (e) {
      console.error('Flight search failed:', e)
      setFlightResults([])
    } finally {
      setSearchingFlights(false)
    }
  }, [origin, destination, departDate, returnDate, travelers])

  const searchHotels = useCallback(async () => {
    if (!hotelCity || !checkin) return
    setSearchingHotels(true)
    try {
      const { text } = await app.ai.generate(
        `Generate 5 realistic hotel search results as JSON array for hotels in ${hotelCity} checking in ${checkin}${checkout ? ` checking out ${checkout}` : ''} for ${guests} guest(s). Each result: {"id":"h1","name":"...","location":"${hotelCity}","price":number_per_night,"rating":4.5,"image":"","amenities":["WiFi","Pool",...]}. Return ONLY the JSON array, no explanation.`
      )
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      setHotelResults(parsed)
    } catch (e) {
      console.error('Hotel search failed:', e)
      setHotelResults([])
    } finally {
      setSearchingHotels(false)
    }
  }, [hotelCity, checkin, checkout, guests])

  const askAI = useCallback(async () => {
    if (!aiQuery.trim()) return
    setAiLoading(true)
    try {
      const { text } = await app.ai.generate(
        `You are a travel assistant for a flights & hotels booking app. The user asks: "${aiQuery}". Give a helpful, concise response about travel recommendations, tips, or help with their booking. Keep it under 150 words.`
      )
      setAiResponse(text)
    } catch (e) {
      setAiResponse(`Error: ${e instanceof Error ? e.message : 'AI unavailable'}`)
    } finally {
      setAiLoading(false)
    }
  }, [aiQuery])

  const saveTrip = useCallback(async (flight?: FlightResult, hotel?: HotelResult) => {
    const trip: SavedTrip = {
      id: crypto.randomUUID(),
      destination: flight?.destination || hotel?.location || 'Unknown',
      dates: departDate || checkin || new Date().toISOString().slice(0, 10),
      flights: flight ? [flight] : [],
      hotels: hotel ? [hotel] : [],
      createdAt: Date.now(),
    }
    setTrips(prev => [trip, ...prev])
    // Persist to D1
    try {
      await app.db.execute(
        'INSERT INTO trips (id, destination, dates, data, created_at) VALUES (?, ?, ?, ?, ?)',
        [trip.id, trip.destination, trip.dates, JSON.stringify({ flights: trip.flights, hotels: trip.hotels }), trip.createdAt]
      )
    } catch (e) {
      console.error('Failed to save trip:', e)
    }
  }, [departDate, checkin])

  const loadTrips = useCallback(async () => {
    try {
      const { rows } = await app.db.query<{ id: string; destination: string; dates: string; data: string; created_at: number }>(
        'SELECT * FROM trips ORDER BY created_at DESC LIMIT 20'
      )
      setTrips(rows.map(r => {
        const data = JSON.parse(r.data)
        return { id: r.id, destination: r.destination, dates: r.dates, flights: data.flights, hotels: data.hotels, createdAt: r.created_at }
      }))
    } catch (e) {
      console.error('Failed to load trips:', e)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-[var(--muted)]">
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="display-font text-4xl font-bold text-[var(--ink)]">Flights & Hotels</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            AI-powered travel booking. Search flights, find hotels, plan your next trip.
          </p>
          <button
            onClick={signIn}
            className="mt-8 rounded-2xl bg-[var(--ink)] px-8 py-3 text-sm font-semibold text-[var(--paper)] hover:opacity-90"
          >
            Sign in to get started
          </button>
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

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <h1 className="display-font text-xl font-bold text-[var(--ink)]">Flights & Hotels</h1>
          <div className="flex items-center gap-3">
            {dbError && <span className="text-[0.6rem] text-[var(--error)]">DB: {dbError}</span>}
            {dbReady && <span className="text-[0.6rem] text-[var(--success)]">DB ready</span>}
            {permission !== 'denied' && (
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                className="rounded-full border border-[var(--line-strong)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                title={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
              >
                {isSubscribed ? 'Notif On' : 'Notif Off'}
              </button>
            )}
            <button
              onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full border border-[var(--line-strong)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              title="Toggle theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <span className="text-xs text-[var(--muted)]">{user.login}</span>
            <button
              onClick={signOut}
              className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-[var(--line)] bg-[var(--panel-quiet)] px-4">
        <div className="mx-auto max-w-4xl flex gap-1">
          {(['flights', 'hotels', 'trips'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'trips') loadTrips() }}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-[var(--accent)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* AI Assistant */}
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs font-medium text-[var(--muted)] mb-2">AI Travel Assistant</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI()}
                placeholder="Ask anything about travel..."
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={askAI}
                disabled={aiLoading}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {aiLoading ? '...' : 'Ask'}
              </button>
            </div>
            {aiResponse && (
              <p className="mt-3 text-sm text-[var(--ink)] leading-relaxed bg-[var(--paper-deep)] rounded-lg p-3">
                {aiResponse}
              </p>
            )}
          </section>

          {/* Flights Tab */}
          {tab === 'flights' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">From</label>
                    <input
                      type="text"
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                      placeholder="City or airport"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">To</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      placeholder="City or airport"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Depart</label>
                    <input
                      type="date"
                      value={departDate}
                      onChange={e => setDepartDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Return</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Travelers</label>
                    <input
                      type="number"
                      min={1}
                      max={9}
                      value={travelers}
                      onChange={e => setTravelers(Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <button
                  onClick={searchFlights}
                  disabled={searchingFlights || !origin || !destination || !departDate}
                  className="w-full rounded-xl bg-[var(--ink)] py-3 text-sm font-semibold text-[var(--paper)] hover:opacity-90 disabled:opacity-40"
                >
                  {searchingFlights ? 'Searching...' : 'Search Flights'}
                </button>
              </div>

              {/* Flight Results */}
              {flightResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[var(--muted)]">{flightResults.length} flights found</h3>
                  {flightResults.map(flight => (
                    <div key={flight.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--ink)]">{flight.airline}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {flight.departure} - {flight.arrival} &middot; {flight.duration}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {flight.origin} → {flight.destination} &middot; {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-lg font-bold text-[var(--ink)]">${flight.price}</p>
                        <button
                          onClick={() => saveTrip(flight)}
                          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Hotels Tab */}
          {tab === 'hotels' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Destination</label>
                    <input
                      type="text"
                      value={hotelCity}
                      onChange={e => setHotelCity(e.target.value)}
                      placeholder="City or region"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkin}
                      onChange={e => setCheckin(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Check-out</label>
                    <input
                      type="date"
                      value={checkout}
                      onChange={e => setCheckout(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1">Guests</label>
                    <input
                      type="number"
                      min={1}
                      max={9}
                      value={guests}
                      onChange={e => setGuests(Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { searchHotels(); if (hotelCity) showMap(hotelCity) }}
                  disabled={searchingHotels || !hotelCity || !checkin}
                  className="w-full rounded-xl bg-[var(--ink)] py-3 text-sm font-semibold text-[var(--paper)] hover:opacity-90 disabled:opacity-40"
                >
                  {searchingHotels ? 'Searching...' : 'Search Hotels'}
                </button>
              </div>

              {/* Map */}
              {mapUrl && (
                <div className="rounded-xl overflow-hidden border border-[var(--line)]">
                  <iframe
                    src={mapUrl}
                    className="w-full h-48"
                    title="Hotel area map"
                  />
                </div>
              )}

              {/* Hotel Results */}
              {hotelResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[var(--muted)]">{hotelResults.length} hotels found</h3>
                  {hotelResults.map(hotel => (
                    <div key={hotel.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[var(--ink)]">{hotel.name}</p>
                          <p className="text-xs text-[var(--muted)]">{hotel.location}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-medium text-[var(--accent)]">{'*'.repeat(Math.round(hotel.rating))}</span>
                            <span className="text-xs text-[var(--muted)]">{hotel.rating}/5</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hotel.amenities.slice(0, 4).map(a => (
                              <span key={a} className="rounded-full bg-[var(--paper-deep)] px-2 py-0.5 text-[0.6rem] text-[var(--muted)]">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <p className="text-lg font-bold text-[var(--ink)]">${hotel.price}</p>
                          <p className="text-[0.6rem] text-[var(--muted)]">per night</p>
                          <button
                            onClick={() => saveTrip(undefined, hotel)}
                            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Trips Tab */}
          {tab === 'trips' && (
            <section className="space-y-3">
              {trips.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)] text-sm">
                  No saved trips yet. Search for flights or hotels and save them.
                </div>
              ) : (
                trips.map(trip => (
                  <div key={trip.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">{trip.destination}</p>
                        <p className="text-xs text-[var(--muted)]">{trip.dates}</p>
                      </div>
                      <span className="text-[0.6rem] text-[var(--muted)]">
                        {new Date(trip.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {trip.flights.length > 0 && (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        {trip.flights.map(f => `${f.airline}: ${f.origin}→${f.destination} $${f.price}`).join(', ')}
                      </div>
                    )}
                    {trip.hotels.length > 0 && (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {trip.hotels.map(h => `${h.name} $${h.price}/night`).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] px-4 py-3 text-center">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          Part of{' '}
          <a href="https://proappstore.online" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--ink)]">
            ProAppStore
          </a>
        </p>
      </footer>
    </div>
  )
}
