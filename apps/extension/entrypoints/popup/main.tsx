import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'

function Popup() {
  return (
    <main>
      <h2>Today</h2>
      <p>No tasks synced yet.</p>
      <button>+ Add task</button>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />)
