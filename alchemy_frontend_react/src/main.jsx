import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@material-tailwind/react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SessionProvider } from './contexts/SessionContext'
import { PermissionsProvider } from './contexts/PermissionsContext'
import { ToastProvider } from './contexts/ToastContext'
import { LoadingProvider } from './contexts/LoadingContext'
import './index.css'
import './bootstrap-custom.css'
import App from './App.jsx'

// Create a QueryClient instance with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  {
    path: '/*',
    element: <App />,
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <PermissionsProvider>
          <ToastProvider>
            <LoadingProvider>
              <ThemeProvider>
                <RouterProvider
                  router={router}
                  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
                />
              </ThemeProvider>
            </LoadingProvider>
          </ToastProvider>
        </PermissionsProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
