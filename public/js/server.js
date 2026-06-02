const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); // Importação correta para Node

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); 

// Configuração Supabase (backend)
const supabaseUrl = 'https://dafcvsozdpfoxmgvbhnr.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZmN2c296ZHBmb3htZ3ZiaG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjUyMzIsImV4cCI6MjA5NDM0MTIzMn0.CcVbntVyYFKANDfqjoXzg0Tn3WkMUX-jtXWE8z3R2mU'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Rota real buscando do Banco de Dados
app.get('/api/agendamentos', async (req, res) => {
    const { data, error } = await supabase
        .from('agendamentos')
        .select('*');
    
    if (error) return res.status(400).json(error);
    res.json(data);
});

// Rota para criar (POST) com Log de Rastreabilidade
app.post('/api/agendamentos', async (req, res) => {
    const { data, error } = await supabase
        .from('agendamentos')
        .insert([req.body]);

    if (error) return res.status(400).json(error);

    // Registro de Log (Rastreabilidade)
    console.log(`[LOG] Novo agendamento criado em ${new Date().toISOString()}`);
    
    res.status(201).json(data);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});