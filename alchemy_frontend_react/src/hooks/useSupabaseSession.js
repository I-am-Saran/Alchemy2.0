import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const useSupabaseSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;
    // Fallback: ensure UI never hangs on loading indefinitely
    const fallbackTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
        setRestored(true);
      }
    }, 1500);

    const init = async () => {
      // ✅ Wait for Supabase to rehydrate session from localStorage
      const { data, error } = await supabase.auth.getSession();

      if (error) console.error("❌ getSession error:", error);

      if (active) {
        setSession(data?.session ?? null);
        setLoading(false);
        setRestored(true);
        clearTimeout(fallbackTimer);
      }
    };

    init();

    // ✅ Listen to auth events (login/logout/refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setLoading(false);
      setRestored(true);
      clearTimeout(fallbackTimer);
    });

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, restored };
};
