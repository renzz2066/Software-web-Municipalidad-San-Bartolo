import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { AccesosProvider } from './context/AccesosContext.tsx'
import { MuniProvider } from './muni/MuniContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MuniProvider>
      <BrowserRouter>
        <AuthProvider>
          <AccesosProvider>
            <App />
          </AccesosProvider>
        </AuthProvider>
      </BrowserRouter>
    </MuniProvider>
  </StrictMode>,
)
