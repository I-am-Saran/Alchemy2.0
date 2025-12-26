// src/components/MicrosoftLogin.jsx
import React from "react";
import { supabase } from "../supabaseClient"; // Use shared client configured via .env

export default function MicrosoftLogin() {
  const login = async () => {
    // Request email scope so Supabase gets an email back from MS
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure", // 'azure' is the provider name Supabase expects
      options: {
        scopes: "email", // request email scope
        // redirectTo: "http://localhost:5173/auth/callback" // optional: use if you want direct callback to your app
      },
    });
    if (error) console.error("Azure sign in error:", error.message);
    // In browser flow, user will be redirected away; Supabase manages callback automatically.
  };

  return (
    <button
      onClick={login}
      className="bg-blue-600 text-white px-3 py-1 rounded"
    >
      Sign in with Microsoft
    </button>
  );
}
