// ✅ frontend/src/hooks/useSyncUser.js
import { useEffect } from "react";
import { supabase } from "../supabaseClient"; // 🔹 use the shared instance

export default function useSyncUser() {
  useEffect(() => {
    const syncUser = async (session) => {
      if (!session?.user) return;

      const user = session.user;
      const { id: sso_user_id, email, user_metadata } = user;

      const full_name =
        user_metadata.full_name ||
        user_metadata.name ||
        user_metadata.display_name ||
        email.split("@")[0];

      const profile_pic_url =
        user_metadata.avatar_url || user_metadata.picture || null;

      // ✅ Call your backend RPC to sync user
      // ✅ Directly insert or update user record in Supabase
const { data, error } = await supabase
  .from("users")
  .upsert(
    [
      {
        sso_provider: "microsoft",
        sso_user_id,
        email,
        full_name,
        profile_pic_url,
        last_login: new Date().toISOString(),
        first_login: new Date().toISOString(),
        login_count: 1,
      },
    ],
    { onConflict: ["sso_provider", "sso_user_id"] } // 👈 important unique constraint
  );

if (error) console.error("❌ User insert/update failed:", error.message);
else console.log("✅ User synced:", email);

      if (error) console.error("❌ User sync failed:", error.message);
      else console.log("✅ User sync completed for:", email);
    };

    const handleSession = async () => {
    const { data } = await supabase.auth.getSession();
      if (data.session) await syncUser(data.session);
    };

    handleSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN") await syncUser(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return null;
}
