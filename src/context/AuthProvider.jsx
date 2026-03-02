import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);

  const currentUserId = useRef(null);

  async function fetchProfile(userId) {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Profile load error:", error.message);
        setProfile(null);
      } else {
        setProfile(data ?? null);
      }
    } catch (e) {
      console.warn("Profile load exception:", e?.message ?? e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    // 1) Инициализация: получить текущую сессию и СРАЗУ снять authLoading
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("getSession error:", error.message);
        if (cancelled) return;

        const s = data?.session ?? null;
        setSession(s);

        // Критично: authLoading выключаем независимо от профиля
        setAuthLoading(false);

        if (s?.user?.id) {
          currentUserId.current = s.user.id;
          // профиль грузим фоном, НЕ блокируя
          fetchProfile(s.user.id);
        } else {
          currentUserId.current = null;
          setProfile(null);
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("getSession exception:", e?.message ?? e);
        setSession(null);
        setProfile(null);
        currentUserId.current = null;
        setAuthLoading(false);
      }
    })();

    // 2) Подписка: обновления сессии (refresh токена и т.п.)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;

      setSession(newSession ?? null);

      const newId = newSession?.user?.id ?? null;

      // если user не изменился — профиль не трогаем
      if (newId && newId === currentUserId.current) return;

      currentUserId.current = newId;

      if (!newId) {
        setProfile(null);
        return;
      }

      fetchProfile(newId);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      authLoading,
      signOut,
    }),
    [session, profile, profileLoading, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
