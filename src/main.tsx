import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { captureKeyFromUrl } from './access'
import App from './App'

captureKeyFromUrl() // must run before the first request so the shared-link key is available

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
