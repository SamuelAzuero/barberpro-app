"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();

      // Si estamos en la página de login, no forzar redirección infinita
      if (pathname === "/admin/login") {
        if (session) {
          router.push("/admin");
        } else {
          setChecking(false);
        }
        return;
      }

      // Si no hay sesión y quiere ver el panel, mandarlo a loguearse
      if (!session) {
        router.push("/admin/login");
      } else {
        setAuthenticated(true);
        setChecking(false);
      }
    }

    checkUser();

    // Escuchar cambios de estado de autenticación (por si expira la sesión)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== "/admin/login") {
        router.push("/admin/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <p className="text-zinc-500 text-sm font-medium animate-pulse">Verificando credenciales de seguridad...</p>
      </div>
    );
  }

  // Si está en el login o está autenticado, renderizar el contenido correspondiente
  if (pathname === "/admin/login" || authenticated) {
    return <>{children}</>;
  }

  return null;
}