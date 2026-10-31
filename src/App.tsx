import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { db } from './db/db';
import { ensureDefaults } from './db/repo';
import ConditionForm from './pages/ConditionForm';
import Home from './pages/Home';
import { LivestockDetail, LivestockForm } from './pages/Livestock';
import MaintenanceForm from './pages/MaintenanceForm';
import { PlantDetail, PlantForm } from './pages/Plant';
import QuickRecord from './pages/QuickRecord';
import Records from './pages/Records';
import Settings from './pages/Settings';
import TankDetail from './pages/TankDetail';
import TankForm from './pages/TankForm';
import WaterForm from './pages/WaterForm';

const navClass = ({ isActive }: { isActive: boolean }) => `py-3 ${isActive ? 'font-bold text-teal-700' : ''}`;

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    ensureDefaults(db);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="bg-teal-700 px-4 py-3 text-lg font-bold text-white">アクアリウム記録</header>
      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/record" element={<QuickRecord />} />
          <Route path="/records" element={<Records />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tanks/new" element={<TankForm />} />
          <Route path="/tanks/:id" element={<TankDetail />} />
          <Route path="/tanks/:id/edit" element={<TankForm />} />
          <Route path="/tanks/:tankId/livestock/new" element={<LivestockForm />} />
          <Route path="/livestock/:id" element={<LivestockDetail />} />
          <Route path="/livestock/:id/edit" element={<LivestockForm />} />
          <Route path="/tanks/:tankId/plants/new" element={<PlantForm />} />
          <Route path="/plants/:id" element={<PlantDetail />} />
          <Route path="/plants/:id/edit" element={<PlantForm />} />
          <Route path="/condition/:targetType/:targetId/new" element={<ConditionForm />} />
          <Route path="/condition/:id/edit" element={<ConditionForm />} />
          <Route path="/tanks/:tankId/water/new" element={<WaterForm />} />
          <Route path="/water/:id/edit" element={<WaterForm />} />
          <Route path="/tanks/:tankId/maintenance/new" element={<MaintenanceForm />} />
          <Route path="/maintenance/:id/edit" element={<MaintenanceForm />} />
        </Routes>
      </main>
      {/* 片手操作のため主要ナビは画面下部に置く */}
      <nav className="sticky bottom-0 z-10 grid grid-cols-4 items-center border-t bg-white pb-[env(safe-area-inset-bottom)] text-center text-sm">
        <NavLink to="/" end className={navClass}>
          ホーム
        </NavLink>
        <NavLink to="/record" className="mx-auto -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-3xl text-white shadow-lg" aria-label="記録する">
          ＋
        </NavLink>
        <NavLink to="/records" className={navClass}>
          記録一覧
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          設定
        </NavLink>
      </nav>
    </div>
  );
}
