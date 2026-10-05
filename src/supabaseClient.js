import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zccslgozucbqmwpvbzde.supabase.co'

// PASTIKAN KEY DI BAWAH ADALAH ANON PUBLIC KEY DARI DASHBOARD SUPABASE Anda
// Buka Supabase -> Settings -> API Keys -> anon public
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjY3NsZ296dWNicW13cHZiemRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTY5MjEsImV4cCI6MjEwNjY5MjkyMX0.1tcwjTwXbOHvjwghZbs4VqXk7VUvgoFAe5Ui4OJlGtA'

// Mencegah error 'Multiple GoTrueClient instances' dengan Singleton Pattern
if (!globalThis.supabaseInstance) {
  globalThis.supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false // Mengodekan agar tidak ada konflik session storage saat testing
    }
  })
}

export const supabase = globalThis.supabaseInstance