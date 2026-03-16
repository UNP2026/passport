import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./layout/AppShell";

import { SurveysStartPage } from "./pages/SurveysStartPage";
import { ExistingPointsPage } from "./pages/ExistingPointsPage";
import { PassportPage } from "./pages/PassportPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { MapPage } from "./pages/MapPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app/surveys/start" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="surveys/start" element={<SurveysStartPage />} />
          <Route path="surveys/existing" element={<ExistingPointsPage />} />
          <Route path="surveys/new" element={<PassportPage />} />

          {/* будущие страницы */}
          <Route path="map" element={<MapPage />} />
          <Route path="plan" element={<div style={{ padding: 20 }}>План (скоро)</div>} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route path="*" element={<Navigate to="/app/surveys/start" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/app/surveys/start" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
