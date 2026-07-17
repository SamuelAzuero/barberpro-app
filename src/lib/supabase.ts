import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Exportamos el cliente de navegador configurado para compartir cookies con el middleware
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);