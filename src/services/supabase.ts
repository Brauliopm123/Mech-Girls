import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Expo expone las variables EXPO_PUBLIC_* en tiempo de compilación.
// Usamos acceso por índice para evitar el error de TypeScript con process.env
const SUPABASE_URL = (process.env['EXPO_PUBLIC_SUPABASE_URL'] as string) ?? '';
const SUPABASE_ANON_KEY = (process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] as string) ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(' Faltan variables de entorno de Supabase en el archivo .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});