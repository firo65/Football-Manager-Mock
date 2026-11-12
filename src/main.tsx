import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GameStateProvider } from './GameStateContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameStateProvider>
      <App />
    </GameStateProvider>
  </React.StrictMode>,
)
