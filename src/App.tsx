import { Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Wortgarten</h1>
        <p>A zen-style German vocabulary app.</p>
      </main>} />
    </Routes>
  );
}
