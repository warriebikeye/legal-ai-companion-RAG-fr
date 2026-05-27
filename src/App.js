import './App.css';
import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom';

import PaymentUpdating from './pages/PaymentUpdating';
import HomePage from './pages/HomePage';
import UpgradePage from './pages/UpgradePage';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage />}
      />

      <Route
        path="/upgrade"
        element={<UpgradePage />}
      />
      <Route
        path="/payment-updating"
        element={<PaymentUpdating />}
      />
    </Routes>
  );
}

export default App;