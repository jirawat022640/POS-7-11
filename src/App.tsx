import { BrowserRouter, Routes, Route } from 'react-router-dom';
import POSScreen from './pages/POSScreen';
import AdminScreen from './pages/AdminScreen';
import SettingsScreen from './pages/SettingsScreen';
import StockScreen from './pages/StockScreen';
import DashboardScreen from './pages/DashboardScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<POSScreen />} />
        <Route path="/admin"     element={<AdminScreen />} />
        <Route path="/settings"  element={<SettingsScreen />} />
        <Route path="/stock"     element={<StockScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;