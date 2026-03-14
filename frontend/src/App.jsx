// ════════════════════════════════════════
// frontend/src/App.jsx  — REPLACE ENTIRELY
// ════════════════════════════════════════

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider }    from "./context/AuthContext";
import Navbar              from "./components/Navbar";
import ProtectedRoute      from "./components/ProtectedRoute";
import Login               from "./pages/Login";
import Register            from "./pages/Register";
import HackerDashboard     from "./pages/HackerDashboard";
import OrgDashboard        from "./pages/OrgDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ background: "#050810", minHeight: "100vh" }}>
          <Navbar />
          <Routes>
            <Route path="/"         element={<Navigate to="/login" />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/hacker"   element={
              <ProtectedRoute role="hacker">
                <HackerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/org"      element={
              <ProtectedRoute role="organization">
                <OrgDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
