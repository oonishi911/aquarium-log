import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="bg-teal-700 px-4 py-3 text-lg font-bold text-white">アクアリウム記録</header>
      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      {/* 片手操作のため主要ナビは画面下部に置く */}
      <nav className="sticky bottom-0 grid grid-cols-2 border-t bg-white pb-[env(safe-area-inset-bottom)] text-center">
        <NavLink to="/" end className={({ isActive }) => `py-3 ${isActive ? 'font-bold text-teal-700' : ''}`}>
          ホーム
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `py-3 ${isActive ? 'font-bold text-teal-700' : ''}`}>
          設定
        </NavLink>
      </nav>
    </div>
  );
}
