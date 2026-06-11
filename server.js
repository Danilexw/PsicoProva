const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// 1. Configurações essenciais de Parsing
app.use(express.json());

// Configuração Supabase (backend)
const supabaseUrl = 'https://dafcvsozdpfoxmgvbhnr.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZmN2c296ZHBmb3htZ3ZiaG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjUyMzIsImV4cCI6MjA5NDM0MTIzMn0.CcVbntVyYFKANDfqjoXzg0Tn3WkMUX-jtXWE8z3R2mU'; 
const supabase = createClient(supabaseUrl, supabaseKey);


// ==========================================
// 2. ROTAS DE API (DEVEM VIR ANTES DO STATIC!)
// ==========================================

// Rota de checagem do perfil logado REAL via Supabase
app.get('/api/auth/perfil', async (req, res) => {
    try {
        // Pega o token de autorização enviado pelo cabeçalho da requisição (Bearer Token)
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Sessão não encontrada. Faça login novamente." });
        }

        const token = authHeader.split(' ')[1];

        // Valida o token diretamente com o Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: "Sessão expirada ou inválida." });
        }

        // Busca os dados complementares (como o Nome e Tipo de Usuário) na sua tabela 'perfis'
        const { data: perfil, error: dbError } = await supabase
            .from('perfis')
            .select('nome, tipo')
            .eq('id', user.id)
            .single();

        if (dbError || !perfil) {
            // Se o perfil não estiver na tabela, usamos o e-mail/meta como contingência
            return res.json({
                id: user.id,
                nome: user.user_metadata?.nome || "Usuário Cadastrado",
                tipo: "paciente",
                email: user.email
            });
        }

        // Retorna a conta certa com os dados reais do banco!
        return res.json({
            id: user.id,
            nome: perfil.nome,
            tipo: perfil.tipo,
            email: user.email
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// Rota de Logout
app.post('/api/auth/logout', async (req, res) => {
    await supabase.auth.signOut();
    return res.status(200).json({ message: "Sessão encerrada." });
});

// Filtro específico para o histórico do Paciente
app.get('/api/paciente/agendamentos', async (req, res) => {
    const { nome } = req.query;
    if (!nome) return res.status(400).json({ error: "Nome obrigatório." });

    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('paciente_nome', nome)
        .order('data_hora', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
});

// Rota Geral de Agendamentos (Usada pelo Psicólogo)
app.get('/api/agendamentos', async (req, res) => {
    const { data, error } = await supabase.from('agendamentos').select('*');
    if (error) return res.status(400).json(error);
    return res.json(data);
});

// Criar Agendamento + LOG de Rastreabilidade
app.post('/api/agendamentos', async (req, res) => {
    const { data, error } = await supabase.from('agendamentos').insert([req.body]);
    if (error) return res.status(400).json(error);

    await supabase.from('logs_sistema').insert([{
        acao: `Criação de agendamento para o paciente: ${req.body.paciente_nome}`,
        tabela_afetada: 'agendamentos'
    }]);

    return res.status(201).json(data);
});


// ==========================================
// 3. ARQUIVOS ESTÁTICOS (DEIXE NO FINAL!)
// ==========================================
app.use(express.static('public'));

// Rota curinga para remover a necessidade de digitar ".html" na URL se quiser
app.get('/:pagina', (req, res, next) => {
    const filename = req.params.pagina;
    if (!filename.includes('.')) {
        res.sendFile(path.join(__dirname, 'public', `${filename}.html`), (err) => {
            if (err) next();
        });
    } else {
        next();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});