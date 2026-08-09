import './App.css';
import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom';

import PaymentUpdating from './pages/PaymentUpdating';
import HomePage from './pages/HomePage';
import UpgradePage from './pages/UpgradePage';
import ProfilePage from './pages/ProfilePage';
import DashBoard from './pages/AdminDashboard'

//fixing routing
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
        path="/profile"
        element={<ProfilePage />}
      />
      <Route
        path="/payment-updating"
        element={<PaymentUpdating />}
      />
      <Route
        path="/dashboard"
        element={<DashBoard />}
      />
    </Routes>
  );
} 

export default App;