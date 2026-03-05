import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { motion } from "framer-motion";
import { LogIn, ShieldCheck } from "lucide-react";

export function LoginPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const MotionDiv = motion.div;
  const MotionButton = motion.button;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) nav("/app/surveys/start", { replace: true });
  }, [user, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) return setError(error.message);

    nav("/app/surveys/start", { replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#0b1220] text-[#e5e7eb] p-6 glow">
      <MotionDiv 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[420px] glass rounded-[2.5rem] p-8 space-y-8"
      >
        <div className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center text-primary mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Паспорт регіону</h1>
          <p className="text-sm text-muted-foreground">Вхід для співробітників</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground ml-1">Email</label>
            <input
              className="w-full h-12 px-4 rounded-2xl bg-white/[0.03] border border-white/10 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground ml-1">Пароль</label>
            <input
              className="w-full h-12 px-4 rounded-2xl bg-white/[0.03] border border-white/10 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <MotionDiv 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm text-center"
            >
              {error}
            </MotionDiv>
          )}

          <MotionButton
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Увійти
              </>
            )}
          </MotionButton>
        </form>
      </MotionDiv>
    </div>
  );
}
