"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Muestra el error real devuelto por Supabase para facilitar el diagnóstico
        setErrorMsg(`Acceso denegado: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Forzamos un refresco para que el middleware lea las nuevas cookies de sesión al instante
        router.refresh();
        router.push("/admin");
      }
    } catch (err: any) {
      console.error("Error crítico en login:", err);
      setErrorMsg("Error de conexión. Verifica tu red o la configuración de Supabase.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 relative overflow-hidden text-zinc-100 font-sans">
      
      {/* Efecto de luz de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-sm bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-10 rounded-[2rem] shadow-2xl relative z-10">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner">
            <span className="text-2xl">💈</span>
          </div>
          <h2 className="text-xl font-black tracking-widest uppercase text-white">
            YHC <span className="text-amber-500">Workspace</span>
          </h2>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-2">
            Terminal de Administración
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-4 rounded-xl mb-6 text-center font-bold animate-fadeIn">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">
              Identificación
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-700"
              placeholder="admin@yeisonhc.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">
              Código de Seguridad
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-700"
              placeholder="••••••••"
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(217,119,6,0.15)] disabled:opacity-50 mt-4"
          >
            {loading ? "Desencriptando..." : "Desbloquear Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}