import { Routes, Route } from 'react-router-dom';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Summary } from './screens/Summary';
import { Dashboard } from './screens/Dashboard';
import { Settings } from './screens/Settings';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/session" element={<Session />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
