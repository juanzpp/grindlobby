import React from 'react'
import ReactDOM from 'react-dom/client'
import V3Shell from './V3Shell'
import './v3.css'
import './v3-fidelity-overrides.css'
import './v3-login-override.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <V3Shell />
  </React.StrictMode>,
)
