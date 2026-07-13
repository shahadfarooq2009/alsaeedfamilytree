import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { FamilyPage } from './pages/FamilyPage';
import { AssetPreviewV2Page } from './pages/AssetPreviewV2Page';
import { FamilyTreePage } from './pages/FamilyTreePage';
import { LoginPage } from './pages/LoginPage';
import { isAuthenticated } from './lib/api';
import './index.css';

function PublicLoginRoute() {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicLoginRoute />} />
      <Route path="/dev/asset-preview-v2" element={<AssetPreviewV2Page />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<FamilyPage />} />
        <Route path="/family-tree/:familyId?" element={<FamilyTreePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
