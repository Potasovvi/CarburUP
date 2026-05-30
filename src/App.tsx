import React, { useEffect, useMemo, useState } from 'react'

interface Impianto {
  id: string
  Gestore: string
  Bandiera: string
  Comune: string
  Provincia: string
  Indirizzo: string
}

interface Prezzo {
  idImpianto: string
  descCarburante: string
  prezzo: number
  isSelf: boolean
  dtComu: string
}

type FuelColors = Record<string, string>
const FUEL_TYPES = ['Benzina', 'Gasolio', 'GPL', 'Metano'] as const
const FUEL_COLORS: FuelColors = {
  Benzina: '#1a6b3a',
  Gasolio: '#1a3f6b',
  GPL: '#8e44ad',
  Metano: '#f39c12',
}

export default function App() {
  const [impianti, setImpianti] = useState<Impianto[]>([])
  const [prezzi, setPrezzi] = useState<Prezzo[]>([])
  const [textFilter, setTextFilter] = useState('')
  const [selectedFuel, setSelectedFuel] = useState('Benzina')
  const [selectedComune, setSelectedComune] = useState('')
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/impianti').then(r => r.json()),
      fetch('/api/prezzi').then(r => r.json()),
    ])
      .then(([impiantiData, prezziData]) => {
        setImpianti(impiantiData)
        setPrezzi(prezziData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setReportOpen(false)
    setReportMessage('')
    setReportStatus('idle')
  }, [selectedStation])

  const impiantiMap = useMemo(
    () => new Map(impianti.map(i => [i.id, i])),
    [impianti],
  )

  const comuni = useMemo(
    () => [...new Set(impianti.map(i => i.Comune).filter(Boolean))].sort(),
    [impianti],
  )

  const stationPrices = useMemo(
    () =>
      prezzi
        .filter(p => p.descCarburante === selectedFuel)
        .reduce<Map<string, number>>((acc, p) => {
          const current = acc.get(p.idImpianto)
          if (current === undefined || p.prezzo < current) {
            acc.set(p.idImpianto, p.prezzo)
          }
          return acc
        }, new Map()),
    [prezzi, selectedFuel],
  )

  const list = useMemo(() => {
    return Array.from(stationPrices.entries())
      .map(([id, price]) => {
        const imp = impiantiMap.get(id)
        if (!imp) return null
        return { ...imp, price }
      })
      .filter((s): s is Impianto & { price: number } => s !== null)
      .filter(s => {
        if (selectedComune && s.Comune !== selectedComune) return false
        if (textFilter) {
          const q = textFilter.toLowerCase()
          return (
            s.Gestore.toLowerCase().includes(q) ||
            s.Indirizzo.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => a.price - b.price)
  }, [stationPrices, impiantiMap, selectedComune, textFilter])

  const stats = useMemo(() => {
    if (list.length === 0) return null
    const prices = list.map(s => s.price)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    }
  }, [list])

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <img src="/icon.svg" alt="" className="app-logo" />
            <div>
              <h1 className="app-title">CarburUP</h1>
              <p className="app-subtitle">Prezzi carburanti Torino</p>
            </div>
          </div>
          <div className="meta-badge">
            <a
              className="meta-source"
              href="https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fonte: MIMIT Open Data
            </a>
            <span className="meta-source">
              Volutamente copiato da{' '}
              <a
                href="https://benzup.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline', color: 'inherit' }}
              >
                BenzUP
              </a>
            </span>
            <a
              className="meta-source"
              href="/infoutili"
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Come funziona CarburUP
            </a>
          </div>
        </div>

        <div className="header-selectors">
          <select
            value={selectedComune}
            onChange={e => setSelectedComune(e.target.value)}
            className="comune-select"
          >
            <option value="">Tutti i comuni</option>
            {comuni.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="fuel-toggle">
          {FUEL_TYPES.map(fuel => (
            <button
              key={fuel}
              className={`toggle-btn${selectedFuel === fuel ? ' active' : ''}`}
              style={
                selectedFuel === fuel
                  ? { background: FUEL_COLORS[fuel], color: '#fff' }
                  : undefined
              }
              onClick={() => setSelectedFuel(fuel)}
            >
              {fuel}
            </button>
          ))}
        </div>
      </header>

      <main>
        {loading ? (
          <div className="loading">
            <p className="loading-text">Caricamento prezzi…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="no-data">
            Nessun dato disponibile per {selectedFuel}.
          </div>
        ) : (
          <>
            {stats && (
              <div className="stats-bar">
                <div className="stat-chip best">
                  <div className="val">{stats.min.toFixed(3)}</div>
                  <div className="lbl">Min €/L</div>
                </div>
                <div className="stat-chip">
                  <div className="val">{stats.avg.toFixed(3)}</div>
                  <div className="lbl">Media €/L</div>
                </div>
                <div className="stat-chip worst">
                  <div className="val">{stats.max.toFixed(3)}</div>
                  <div className="lbl">Max €/L</div>
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="Cerca per gestore o indirizzo…"
              value={textFilter}
              onChange={e => setTextFilter(e.target.value)}
              className="search-input"
            />

            <div className="list">
              {list.map((s, i) => {
                const rankSymbol =
                  i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
                const rankClass =
                  i === 0
                    ? 'rank-1'
                    : i === 1
                      ? 'rank-2'
                      : i === 2
                        ? 'rank-3'
                        : ''

                return (
                  <div
                    key={s.id}
                    className="card"
                    onClick={() => setSelectedStation(s.id)}
                  >
                    <div className={`rank ${rankClass}`}>{rankSymbol}</div>
                    <div className="card-body">
                      <div className="card-name">{s.Gestore}</div>
                      <div className="card-bandiera">{s.Bandiera}</div>
                      <div className="card-info">{s.Indirizzo}</div>
                      <span className="card-comune">{s.Comune}</span>
                    </div>
                    <div className="card-price">
                      <div className="price-val">{s.price.toFixed(3)}</div>
                      <div className="price-unit">€/L</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

          {selectedStation && (() => {
        const s = impiantiMap.get(selectedStation)
        if (!s) return null
        const stationPrezzi = prezzi.filter(p => p.idImpianto === selectedStation)
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${s.Indirizzo}, ${s.Comune}`)}`

        const handleReportSend = async () => {
          if (!reportMessage.trim()) return
          setReportStatus('sending')
          try {
            const res = await fetch('/api/segnala', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idImpianto: s.id,
                gestore: s.Gestore,
                bandiera: s.Bandiera,
                comune: s.Comune,
                indirizzo: s.Indirizzo,
                messaggio: reportMessage.trim(),
              }),
            })
            if (!res.ok) throw new Error('HTTP ' + res.status)
            setReportStatus('success')
          } catch {
            setReportStatus('error')
          }
        }
        return (
          <>
            <div className="overlay" onClick={() => setSelectedStation(null)} />
            <div className="detail-panel">
              <div className="detail-handle" />
              <div className="detail-bandiera">{s.Bandiera}</div>
              <div className="detail-name">{s.Gestore}</div>
              <div className="detail-addr">
                {s.Indirizzo}<br />{s.Comune}
              </div>

              <div className="detail-section-title">Prezzi praticati</div>
              <div className="price-grid">
                {FUEL_TYPES.map(fuel => {
                  const self = stationPrezzi.find(p => p.descCarburante === fuel && p.isSelf)
                  const servito = stationPrezzi.find(p => p.descCarburante === fuel && !p.isSelf)
                  return (
                    <React.Fragment key={fuel}>
                      {self && (
                        <div className="price-cell">
                          <div className="fuel-mode">Self</div>
                          <div className="fuel-name">{fuel}</div>
                          <div className="fuel-val">{self.prezzo.toFixed(3)}</div>
                        </div>
                      )}
                      {servito && (
                        <div className="price-cell">
                          <div className="fuel-mode">Servito</div>
                          <div className="fuel-name">{fuel}</div>
                          <div className="fuel-val">{servito.prezzo.toFixed(3)}</div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>

              <div className="detail-section-title">Dettagli impianto</div>
              <div className="detail-info-row">
                <span className="detail-info-label">Gestore</span>
                <span className="detail-info-val">{s.Gestore}</span>
              </div>
              <div className="detail-info-row">
                <span className="detail-info-label">Bandiera</span>
                <span className="detail-info-val">{s.Bandiera}</span>
              </div>
              <div className="detail-info-row">
                <span className="detail-info-label">Comune</span>
                <span className="detail-info-val">{s.Comune}</span>
              </div>

              <button className="maps-btn" onClick={() => { setReportOpen(false); setReportMessage(''); setReportStatus('idle'); window.open(mapsUrl, '_blank') }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Apri in Maps
              </button>

              {reportStatus === 'success' ? (
                <div className="report-success">
                  Segnalazione inviata, grazie!
                </div>
              ) : (
                <>
                  <button className="report-btn" onClick={() => setReportOpen(!reportOpen)}>
                    Segnala un problema
                  </button>

                  {reportOpen && (
                    <div className="report-form-container">
                      <textarea
                        className="report-textarea"
                        placeholder="Descrivi il problema (es. prezzo non aggiornato, impianto chiuso...)"
                        value={reportMessage}
                        onChange={e => setReportMessage(e.target.value)}
                        required
                      />
                      <button
                        className="submit-btn"
                        disabled={!reportMessage.trim() || reportStatus === 'sending'}
                        onClick={handleReportSend}
                      >
                        {reportStatus === 'sending' ? (
                          <span className="spinner" />
                        ) : (
                          'Invia'
                        )}
                      </button>
                      {reportStatus === 'error' && (
                        <div className="form-status error">Errore nell'invio, riprova.</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )
      })()}

      <footer className="footer">
        Dati aggiornati quotidianamente tra le 8.00 e le 11.00
        <br />
        Ministero delle Imprese e del Made in Italy
      </footer>
    </div>
  )
}
