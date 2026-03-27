import { useState, useEffect } from 'react'

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
            // Try to get highest quality image available
            let image = null
            // 1. Try description/content for full-size images
            const content = item.content || item.description || ''
            const imgMatch = content.match(/<img[^>]+src="([^"]+)"/)
            if (imgMatch) image = imgMatch[1]
            // 2. Enclosure often has better quality than thumbnail
            if (!image && item.enclosure?.link) image = item.enclosure.link
            // 3. Fallback to thumbnail
            if (!image && item.thumbnail) image = item.thumbnail
            // 4. Try to upgrade known low-res patterns to high-res
            if (image) {
              // Marca: upgrade thumbnail to full size
              image = image.replace(/\/clipping\/\d+\/\d+\//, '/clipping/0/0/')
              image = image.replace(/_\d+x\d+\./, '.')
              // AS: remove resize params
              image = image.replace(/\?w=\d+.*$/, '')
              image = image.replace(/&w=\d+.*$/, '')
            }

            allArticles.push({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              source: feed.name,
              sourceIcon: feed.icon,
              image,
              description: stripHtml(item.description || '').slice(0, 200)
            })
          })
        }
      } catch (err) {
        console.warn(`Error fetching ${feed.name}:`, err)
      }
    }

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

  const heroArticle = filteredArticles.length > 0 ? filteredArticles[0] : null
  const gridArticles = filteredArticles.slice(1)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{
            fontSize: '18px', fontWeight: '700', color: '#e0e3ea',
            margin: '0 0 4px', letterSpacing: '0.3px'
          }}>
            Noticias del Mundial
          </h2>
          <p style={{ fontSize: '12px', color: '#4a4f5e', margin: 0 }}>
            Últimas noticias de fútbol internacional
          </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          style={{
            padding: '8px 14px', borderRadius: '8px', border: '0.5px solid #2a2d38',
            background: '#22252f', color: '#6b7080',
            fontSize: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            opacity: loading ? 0.5 : 1, flexShrink: 0
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none', fontSize: '16px' }}>🔄</span>
        </button>
      </div>

      {/* Source filter */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        padding: '3px', background: '#13151c', borderRadius: '8px',
        overflowX: 'auto'
      }}>
        {sources.map(source => (
          <button
            key={source}
            onClick={() => setActiveSource(source)}
            style={{
              padding: '8px 14px', borderRadius: '6px', border: 'none',
              background: activeSource === source ? '#22252f' : 'transparent',
              color: activeSource === source ? '#e0e3ea' : '#6b7080',
              fontSize: '12px', fontWeight: activeSource === source ? '600' : '400',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
          >
            {source === 'all' ? '📡 Todas' : `${FEEDS.find(f => f.name === source)?.icon || ''} ${source}`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#6b7080', fontSize: '14px'
        }}>
          Cargando noticias...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{
          padding: '24px', textAlign: 'center', color: '#4a4f5e',
          fontSize: '13px', background: '#22252f', borderRadius: '10px',
          border: '0.5px solid #2a2d38'
        }}>
          {error}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={fetchNews}
              style={{
                padding: '8px 20px', background: '#007a45', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Hero Article */}
      {!loading && heroArticle && (
        <a
          href={heroArticle.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: '#22252f',
            borderRadius: '12px',
            border: '0.5px solid #2a2d38',
            overflow: 'hidden',
            textDecoration: 'none',
            marginBottom: '16px',
            transition: 'border-color 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#007a45'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2d38'}
        >
          {heroArticle.image && (
            <div style={{
              width: '100%',
              aspectRatio: '16 / 9',
              overflow: 'hidden',
              background: '#13151c',
              position: 'relative'
            }}>
              <img
                src={heroArticle.image}
                alt=""
                loading="eager"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  display: 'block', imageRendering: 'auto'
                }}
                onError={e => { e.target.parentElement.style.display = 'none' }}
              />
              {/* Gradient overlay */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '50%',
                background: 'linear-gradient(transparent, rgba(26,29,38,0.9))',
                pointerEvents: 'none'
              }} />
            </div>
          )}

          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '10px'
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '700', color: '#007a45',
                textTransform: 'uppercase', letterSpacing: '0.8px'
              }}>
                {heroArticle.sourceIcon} {heroArticle.source}
              </span>
              <span style={{ fontSize: '11px', color: '#4a4f5e' }}>
                {formatDate(heroArticle.pubDate)}
              </span>
            </div>

            <h3 style={{
              fontSize: '20px', fontWeight: '700', color: '#e0e3ea',
              margin: '0 0 10px', lineHeight: '1.35'
            }}>
              {heroArticle.title}
            </h3>

            {heroArticle.description && (
              <p style={{
                fontSize: '14px', color: '#9da3b0',
                margin: 0, lineHeight: '1.6',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
              }}>
                {heroArticle.description}
              </p>
            )}
          </div>
        </a>
      )}

      {/* Grid Articles */}
      {!loading && gridArticles.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '12px'
        }}>
          {gridArticles.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                background: '#22252f',
                borderRadius: '10px',
                border: '0.5px solid #2a2d38',
                overflow: 'hidden',
                textDecoration: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#007a45'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2d38'}
            >
              {article.image && (
                <div style={{
                  width: '100%',
                  aspectRatio: '16 / 10',
                  overflow: 'hidden',
                  background: '#13151c'
                }}>
                  <img
                    src={article.image}
                    alt=""
                    loading="lazy"
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      display: 'block', imageRendering: 'auto'
                    }}
                    onError={e => { e.target.parentElement.style.display = 'none' }}
                  />
                </div>
              )}

              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '10px', fontWeight: '700', color: '#007a45',
                    textTransform: 'uppercase', letterSpacing: '0.6px'
                  }}>
                    {article.sourceIcon} {article.source}
                  </span>
                  <span style={{ fontSize: '10px', color: '#4a4f5e' }}>
                    {formatDate(article.pubDate)}
                  </span>
                </div>

                <h3 style={{
                  fontSize: '15px', fontWeight: '600', color: '#e0e3ea',
                  margin: '0 0 8px', lineHeight: '1.4'
                }}>
                  {article.title}
                </h3>

                {article.description && (
                  <p style={{
                    fontSize: '12px', color: '#6b7080',
                    margin: 0, lineHeight: '1.55',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                  }}>
                    {article.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredArticles.length === 0 && (
        <div style={{
          padding: '40px', textAlign: 'center', color: '#4a4f5e',
          fontSize: '14px', background: '#22252f', borderRadius: '10px',
          border: '0.5px solid #2a2d38'
        }}>
          No hay noticias de esta fuente
        </div>
      )}
    </div>
  )
}
