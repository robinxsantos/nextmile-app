import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import Logo from "../assets/logo.png";

import { useAuthStore } from "../store/useAuthStore";

export default function LoginPage() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("Enter username and password");
      return;
    }

    try {
      const user = await login(username.trim(), password);
      toast.success(`Welcome, ${user.displayName}!`);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* LEFT: Login */}
        <section className="flex items-center justify-center bg-background px-4 py-6 sm:px-6 lg:px-10">
          <div className="w-full max-w-sm sm:max-w-md">
            <div className="mb-8 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                <img src={Logo} alt="Nextmile Logo" className="h-5 w-auto" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Nextmile Fleet Management App
                </p>
                <p className="text-xs text-slate-500">
                  by Nextmile Trucking Services
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Log in to access your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  className="w-full h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 sm:h-10 w-full rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Robin Santos
            </p>
          </div>
        </section>

        {/* RIGHT: Brand / visual panel */}
        <section className="hidden items-center justify-center bg-white p-6 lg:flex">
          <div className="w-full h-full rounded-xl border border-border bg-muted/40 shadow-sm p-10 flex flex-col justify-center">
            <div className="mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Online
            </div>

            <h2 className="max-w-lg text-4xl font-semibold tracking-tight leading-tight xl:text-4xl">
              Stay ahead.
              <br />
              Make smarter decisions.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-foreground">
              Stay ahead with real-time insights and analytics. <br />
              Track your trips, expenses, and generate detailed reports.
            </p>

            <div className="mt-10 rounded-[28px] bg-background p-5 backdrop-blur-md">
              <div className="rounded-[22px] bg-white p-4 text-slate-900 shadow-xl shadow-slate-900/10">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Overview</div>
                    <div className="text-xs text-slate-500">This week</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Active
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Trips", "124"],
                    ["Payable", "1,247"],
                    ["Cash Outflow", "₱28,407"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="mt-2 text-lg font-semibold">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-12 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {[28, 44, 36, 58, 40, 66, 52, 72, 48, 61, 38, 55].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="col-span-1 flex items-end justify-center"
                      >
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-500"
                          style={{ height: `${h}px` }}
                        />
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Expenses</div>
                    <div className="mt-2 text-lg font-semibold">3,333</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Monthly Trips</div>
                    <div className="mt-2 text-lg font-semibold">24</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
