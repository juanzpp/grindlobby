import React from 'react'
import ReactDOM from 'react-dom/client'
import V3Shell from './V3Shell'
import { installRealMode } from './real-mode'
import { installPolishMode } from './polish-mode'
import './v3.css'
import './v3-fidelity-overrides.css'
import './v3-login-override.css'
import './real-mode.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <V3Shell />
  </React.StrictMode>,
)

const stopRealMode = installRealMode()
const stopPolishMode = installPolishMode()
window.addEventListener('beforeunload', () => {
  stopRealMode()
  stopPolishMode()
}, { once: true })
