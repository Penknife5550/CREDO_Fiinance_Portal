import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { Startseite } from './pages/Startseite';
import { ReisekostenFormular } from './pages/ReisekostenFormular';
import { ErstattungFormular } from './pages/ErstattungFormular';
import { SammelfahrtFormular } from './pages/SammelfahrtFormular';
import { Erfolg } from './pages/Erfolg';
import { AdminCenter } from './pages/AdminCenter';
import { NotFound } from './pages/NotFound';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Startseite />} />
            <Route path="/reisekosten" element={<ReisekostenFormular />} />
            <Route path="/erstattung" element={<ErstattungFormular />} />
            <Route path="/sammelfahrt" element={<SammelfahrtFormular />} />
            <Route path="/erfolg/:belegNr" element={<Erfolg />} />
            <Route path="/admin/*" element={<AdminCenter />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
