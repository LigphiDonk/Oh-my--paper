import { createRoot } from 'react-dom/client'
import 'xterm/css/xterm.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
