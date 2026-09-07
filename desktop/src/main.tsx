import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import BillingPortal from './BillingPortal'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <BillingPortal />
  </React.StrictMode>,
)
