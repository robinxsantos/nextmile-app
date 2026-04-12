import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, Truck, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }
    try {
      await login(username.trim(), password);
      toast.success('Welcome back!');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-600/20 mb-4">
            <Truck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">NEXTMILE</h1>
          <p className="text-sm text-slate-500 mt-1">Trucking Management System</p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-[28px] border border-slate-200/80 dark:border-slate-700/80 shadow-xl p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Sign In</h2>
          <p className="text-sm text-slate-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
                className="w-full min-h-[48px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full min-h-[48px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 pr-12 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <LogIn size={18} /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} NextMile Trucking Services
        </p>
      </div>
    </div>
  );
}
