import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import TopNavBar from '../components/TopNavBar'
import Sidebar from '../components/Sidebar'

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return (
    <div className="d-flex flex-column" style={{ height: '100%', width: '100%', overflow: 'hidden', minHeight: '100%' }}>
      {/* Top Navigation Bar */}
      <TopNavBar />

      <div className="d-flex flex-fill position-relative" style={{ overflow: 'hidden', flex: '1 1 auto', minHeight: 0 }}>
        {/* Sidebar (desktop/tablet) */}
        <Sidebar open={open} onClose={() => setOpen(false)} />

        {/* Mobile overlay */}
        {open && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-30 d-md-none"
            style={{ zIndex: 1040 }}
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main Content */}
        <div 
          className="flex-fill d-flex flex-column" 
          style={{ 
            marginLeft: isDesktop ? '208px' : '0', 
            width: '100%',
            maxWidth: '100%',
            transition: 'margin-left 0.3s ease-in-out',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: 0
          }}
        >
          {/* Mobile menu button */}
          <div className="d-md-none d-flex align-items-center justify-content-between bg-white border-bottom px-3 py-2">
            <button
              type="button"
              className="btn btn-link p-2 d-flex align-items-center justify-content-center"
              aria-label="Toggle Navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              style={{ 
                textDecoration: 'none',
                border: 'none',
                backgroundColor: 'transparent !important',
                color: '#333 !important',
                minWidth: '40px',
                minHeight: '40px'
              }}
            >
              <Menu size={24} strokeWidth={2} color="#333333" />
            </button>
          </div>

          <main className="flex-fill bg-light" style={{ overflowY: 'auto', overflowX: 'hidden', maxWidth: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}