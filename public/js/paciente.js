// js/paciente.js

document.addEventListener('DOMContentLoaded', () => {
    verificarAcesso('paciente'); // Segurança do auth.js
    carregarDadosPaciente();
});

async function carregarDadosPaciente() {
    const nomeUser = localStorage.getItem('user_name');
    document.getElementById('welcomeName').innerText = `Bem-vinda, ${nomeUser}`;

    try {
        // 1. Buscar a próxima sessão no Supabase
        // Filtramos por paciente_nome (ou paciente_id se você já tiver o ID do Auth)
        const { data: sessao, error } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('paciente_nome', nomeUser)
            .eq('status', 'Confirmada')
            .order('data_hora', { ascending: true })
            .limit(1)
            .single();

        if (sessao) {
            const dataObj = new Date(sessao.data_hora);
            document.getElementById('sessionDateTime').innerText = dataObj.toLocaleString('pt-BR', {
                weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
            });
            document.getElementById('sessionType').innerText = sessao.tipo_sessao || "Sessão Online";
            document.getElementById('nextSessionAlert').innerText = "Sua próxima sessão está agendada.";
        } else {
            document.getElementById('sessionDateTime').innerText = "Nenhuma consulta agendada";
        }

        // 2. Simular busca de saldo (Pode estar na tabela de perfis)
        // Aqui apenas preenchemos para efeito visual do protótipo
        document.getElementById('sessionBalance').innerText = "04";

    } catch (err) {
        console.error("Erro ao carregar dados do paciente:", err);
    }
}

// Função de Rastreabilidade exigida pelo sistema
async function registrarLog(acao) {
    console.log(`[RASTREABILIDADE] Ação: ${acao} | Usuário: ${localStorage.getItem('user_name')} | Hora: ${new Date().toISOString()}`);
    
    // Opcional: Salvar no Supabase se você criou a tabela de logs
    /*
    await supabase.from('logs_sistema').insert([
        { usuario: localStorage.getItem('user_name'), acao: acao }
    ]);
    */
    alert("Ação registrada para auditoria!");
}