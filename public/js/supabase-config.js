// public/js/supabase-config.js
const url = 'https://dafcvsozdpfoxmgvbhnr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZmN2c296ZHBmb3htZ3ZiaG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjUyMzIsImV4cCI6MjA5NDM0MTIzMn0.CcVbntVyYFKANDfqjoXzg0Tn3WkMUX-jtXWE8z3R2mU';

// Aqui está o segredo: mude o nome da variável para 'db' para evitar conflito com a biblioteca
const db = supabase.createClient(url, key);