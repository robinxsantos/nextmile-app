import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import Logo from "../assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuthStore } from "../store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        <section className="flex items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-sm">
            {/* Brand */}
            <div className="mb-10 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <img src={Logo} alt="Nextmile Logo" className="h-5 w-auto" />
              </div>

              <div>
                <p className="text-sm font-semibold leading-none">
                  Nextmile Fleet Management
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by Nextmile Trucking Services
                </p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-xl font-semibold">Sign in to your account</h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Enter your credentials to access your account.
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>

                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              {/* Sign in */}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn data-icon="inline-start" />
                    Sign in
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />

              <span className="text-xs text-muted-foreground">
                Or continue with
              </span>

              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Google */}
            <Button type="button" variant="outline" className="w-full">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
                />
              </svg>
              Google
            </Button>

            {/* Copyright */}
            <p className="mt-10 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Robin Santos
            </p>
          </div>
        </section>

        {/* RIGHT: Brand / visual panel */}
        <section className="hidden items-center justify-center bg-background p-6 lg:flex">
          <Card className="flex h-full w-full flex-col justify-center bg-muted/30 p-10">
            <Badge
              variant="outline"
              className="mb-10 w-fit gap-2 bg-background px-3 py-1.5 font-normal"
            >
              <span className="size-2 rounded-full bg-green-500" />
              Online
            </Badge>

            <h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight">
              Stay ahead.
              <br />
              Make smarter decisions.
            </h2>

            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
              Stay ahead with real-time insights and analytics.
              <br />
              Track your trips, manage your fleet, monitor your expenses,
              oversee employees, and generate detailed reports.
              <br />
              All in one place!
            </p>

            <div className="mt-10">
              <Card size="sm" className="!gap-0 overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Overview</CardTitle>
                      <p className="text-xs text-muted-foreground">This week</p>
                    </div>

                    <Badge variant="secondary">Active</Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="grid grid-cols-12 items-end gap-2 rounded-md border bg-muted/30 p-4">
                    {[28, 44, 36, 58, 40, 66, 52, 72, 48, 61, 38, 55].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="col-span-1 flex items-end justify-center"
                        >
                          <div
                            className="w-full rounded-t-sm bg-primary"
                            style={{ height: `${h}px` }}
                          />
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Card size="sm">
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Expenses
                        </div>
                        <div className="mt-2 text-lg font-semibold">3,333</div>
                      </CardContent>
                    </Card>

                    <Card size="sm">
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Monthly Trips
                        </div>
                        <div className="mt-2 text-lg font-semibold">24</div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
