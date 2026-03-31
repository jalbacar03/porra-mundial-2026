import { useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'

/**
 * Wraps page content with a fade+slide-up animation on route change.
 */
export default function PageTransition({ children }) {
  const location = useLocation()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [animClass, setAnimClass] = useState('page-enter')
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname
      setAnimClass('page-enter')
      setDisplayChildren(children)
    } else {
      setDisplayChildren(children)
    }
  }, [children, location.pathname])

  return (
    <div className={animClass} onAnimationEnd={() => setAnimClass('')}>
      {displayChildren}
    </div>
  )
}
