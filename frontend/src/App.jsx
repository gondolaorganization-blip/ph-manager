import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import LoginPage from './pages/LoginPage';
import BootstrapPage from './pages/BootstrapPage';
import PortalLoginPage from './pages/PortalLoginPage';
import EdificiosPage from './pages/EdificiosPage';
import DashboardPage from './pages/DashboardPage';
import UnidadesPage from './pages/UnidadesPage';
import CuotasPage from './pages/CuotasPage';
import CuotasExtPage from './pages/CuotasExtPage';
import PagosExtPage from './pages/PagosExtPage';
import PagosPage from './pages/PagosPage';
import MorososPage from './pages/MorososPage';
import ProveedoresPage from './pages/ProveedoresPage';
import OrdenesPage from './pages/OrdenesPage';
import GastosPage from './pages/GastosPage';
import ActasPage from './pages/ActasPage';
import ActasJDPage from './pages/ActasJDPage';
import AvisosPage from './pages/AvisosPage';
import ReservasPage from './pages/ReservasPage';
import UsuariosEdificioPage from './pages/UsuariosEdificioPage';
import PropietariosPage from './pages/PropietariosPage';
import BalancePage from './pages/BalancePage';
import PresupuestoPage from './pages/PresupuestoPage';
import IngresosPage from './pages/IngresosPage';
import GaritaPage from './pages/GaritaPage';
import PortalDashboardPage   from './pages/portal/PortalDashboardPage';
import PortalVisitasPage     from './pages/portal/PortalVisitasPage';
import PortalAvisosPage      from './pages/portal/PortalAvisosPage';
import PortalEstadoCuentaPage from './pages/portal/PortalEstadoCuentaPage';
import PortalPerfilPage      from './pages/portal/PortalPerfilPage';
import PortalReservasPage    from './pages/portal/PortalReservasPage';
import PortalActasPage       from './pages/portal/PortalActasPage';
import PortalOrdenesPage     from './pages/portal/PortalOrdenesPage';
import VisitasPage           from './pages/VisitasPage';
import UsuariosSuperAdminPage    from './pages/UsuariosSuperAdminPage';
import SuperAdminDashboardPage   from './pages/SuperAdminDashboardPage';

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Admin */}
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/edificios" replace />} />
        <Route path="edificios"          element={<EdificiosPage />} />
        <Route path="usuarios"           element={<UsuariosSuperAdminPage />} />
        <Route path="super-dashboard"    element={<SuperAdminDashboardPage />} />
        <Route path="edificios/:edificioId/dashboard"  element={<DashboardPage />} />
        <Route path="edificios/:edificioId/unidades"   element={<UnidadesPage />} />
        <Route path="edificios/:edificioId/cuotas"                       element={<CuotasPage />} />
        <Route path="edificios/:edificioId/cuotas/:cuotaId/pagos"        element={<PagosPage />} />
        <Route path="edificios/:edificioId/cuotas-ext"                   element={<CuotasExtPage />} />
        <Route path="edificios/:edificioId/cuotas-ext/:cuotaExtId/pagos" element={<PagosExtPage />} />
        <Route path="edificios/:edificioId/morosos"      element={<MorososPage />} />
        <Route path="edificios/:edificioId/proveedores" element={<ProveedoresPage />} />
        <Route path="edificios/:edificioId/ordenes"  element={<OrdenesPage />} />
        <Route path="edificios/:edificioId/gastos"   element={<GastosPage />} />
        <Route path="edificios/:edificioId/actas"    element={<ActasPage />} />
        <Route path="edificios/:edificioId/actas-jd" element={<ActasJDPage />} />
        <Route path="edificios/:edificioId/avisos"    element={<AvisosPage />} />
        <Route path="edificios/:edificioId/reservas" element={<ReservasPage />} />
        <Route path="edificios/:edificioId/usuarios" element={<UsuariosEdificioPage />} />
        <Route path="edificios/:edificioId/propietarios" element={<PropietariosPage />} />
        <Route path="edificios/:edificioId/visitas"     element={<VisitasPage />} />
        <Route path="edificios/:edificioId/ingresos"    element={<IngresosPage />} />
        <Route path="edificios/:edificioId/balance"     element={<BalancePage />} />
        <Route path="edificios/:edificioId/presupuesto" element={<PresupuestoPage />} />
      </Route>

      {/* Portal propietarios */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalLayout />}>
        <Route index element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="dashboard"     element={<PortalDashboardPage />} />
        <Route path="visitas"       element={<PortalVisitasPage />} />
        <Route path="reservas"      element={<PortalReservasPage />} />
        <Route path="avisos"        element={<PortalAvisosPage />} />
        <Route path="actas"         element={<PortalActasPage />} />
        <Route path="mantenimiento" element={<PortalOrdenesPage />} />
        <Route path="estado-cuenta" element={<PortalEstadoCuentaPage />} />
        <Route path="perfil"        element={<PortalPerfilPage />} />
      </Route>

      {/* Garita (pública) */}
      <Route path="/garita/:edificioId" element={<GaritaPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
