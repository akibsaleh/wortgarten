import { Routes, Route } from 'react-router-dom';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Summary } from './screens/Summary';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/session" element={<Session />} />
      <Route path="/summary" element={<Summary />} />
    </Routes>
  );
}
