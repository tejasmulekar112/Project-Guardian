import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/users', label: 'Users' },
];

export function NavLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <span className="text-white font-bold text-lg">Guardian</span>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm ${
                    location.pathname === item.path
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  } transition-colors`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => void signOut()}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
