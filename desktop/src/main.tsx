import React from 'react'
import ReactDOM from 'react-dom/client'
import V3App from './V3App'
import './v3.css'
import './v3-fidelity-overrides.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <V3App />
  </React.StrictMode>,
)
