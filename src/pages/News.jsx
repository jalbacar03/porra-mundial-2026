import { useState, useEffect } from 'react'

// RSS feeds about football / World Cup
const FEEDS = [
  {
    name: 'Marca',
    url: 'https://e00-marca.uecdn.es/rss/futbol/mundial.xml',
    icon: '📰'
  },
  {
    name: 'AS',
    url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/mundial/',
    icon: '⚽'
  },
  {
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    icon: '🌍'
  }
]

// Free RSS-to-JSON proxy (no signup needed)
const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url='

export default function News() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSource, setActiveSource] = useState('all')

  useEffect(() => {
    fetchNews()
  }, [])

  async function fetchNews() {
    setLoading(true)
    setError(null)
    const allArticles = []

    for (const feed of FEEDS) {
      try {
        const res = await fetch(`${RSS2JSON_BASE}${encodeURIComponent(feed.url)}`)
        if (!res.ok) continue
        const data = await res.json()

        if (data.status === 'ok' && data.items) {
          data.items.forEach(item => {
            // Extract image from content or enclosure
            let image = item.thumbnail || item.enclosure?.link || null
            if (!image && item.description) {
              const imgMatch = item.description.match(/<img[^>]+src="([^"]+)"/)
              if (imgMatch) image = imgMatch[1]
            }

            allArticles.push({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              source: feed.name,
              sourceIcon: feed.icon,
              image,
              description: stripHtml(item.description || '').slice(0, 150)
            })
          })
        }
      } catch (err) {
        console.warn(`Error fetching ${feed.name}:`, err)
      }
    }

    // Sort by date (newest first)
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    setArticles(allArticles)
    setLoading(false)

    if (allArticles.length === 0) {
      setError('No se pudieron cargar noticias. Inténtalo de nuevo más tarde.')
    }
  }

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    if (diffDays < 7) return `Hace ${diffDays}d`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  const filteredArticles = activeSource === 'all'
    ? articles
    : articles.filter(a => a.source === activeSource)

  const sources = ['all', ...FEEDS.map(f => f.name)]

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Noticias del Mundial
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Últimas noticias de fútbol internacional
        </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: 'none',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
            fontSize: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            opacity: loading ? 0.5 : 1, flexShrink: 0,
            border: '0.5px solid var(--border)'
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
          {loading ? '' : 'Actualizar'}
        </button>
      </div>

      {/* Source filter */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        padding: '3px', background: 'var(--bg-input)', borderRadius: '6px',
        overflowX: 'auto'
      }}>
        {sources.map(source => (
          <button
            key={source}
            onClick={() => setActiveSource(source)}
            style={{
              padding: '7px 12px', borderRadius: '4px', border: 'none',
              background: activeSource === source ? 'var(--bg-secondary)' : 'transparent',
              color: activeSource === source ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeSource === source ? '600' : '400',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            {source === 'all' ? '📡 Todas' : `${FEEDS.find(f => f.name === source)?.icon || ''} ${source}`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px'
        }}>
          Cargando noticias...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{
          padding: '20px', textAlign: 'center', color: 'var(--text-dim)',
          fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px',
          border: '0.5px solid var(--border)'
        }}>
          {error}
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={fetchNews}
              style={{
                padding: '8px 16px', background: 'var(--green)', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Articles */}
      {!loading && filteredArticles.map((article, i) => (
        <a
          key={i}
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            marginBottom: '10px',
            border: '0.5px solid var(--border)',
            overflow: 'hidden',
            textDecoration: 'none',
            transition: 'border-color 0.2s ease'
          }}
        >
          {/* Image */}
          {article.image && (
            <div style={{
              width: '100%', height: '160px', overflow: 'hidden',
              background: 'var(--bg-input)'
            }}>
              <img
                src={article.image}
                alt=""
                style={{
                  width: '100%', height: '100%', objectFit: 'cover'
                }}
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
          )}

          <div style={{ padding: '12px 14px' }}>
            {/* Source + date */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{
                fontSize: '10px', fontWeight: '600', color: 'var(--green)',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                {article.sourceIcon} {article.source}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                {formatDate(article.pubDate)}
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)',
              margin: '0 0 6px', lineHeight: '1.4'
            }}>
              {article.title}
            </h3>

            {/* Description */}
            {article.description && (
              <p style={{
                fontSize: '12px', color: 'var(--text-muted)',
                margin: 0, lineHeight: '1.5',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
              }}>
                {article.description}
              </p>
            )}
          </div>
        </a>
      ))}

      {/* Empty state */}
      {!loading && !error && filteredArticles.length === 0 && (
        <div style={{
          padding: '30px', textAlign: 'center', color: 'var(--text-dim)',
          fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px'
        }}>
          No hay noticias de esta fuente
        </div>
      )}
    </div>
  )
}
