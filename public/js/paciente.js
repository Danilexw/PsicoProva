// Garante o carregamento do perfil assim que a página abrir
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessaoPaciente();
});

async function verificarSessaoPaciente() {
    try {
        // Usamos 'db' que é a instância padrão do seu auth.js
        const { data: { session }, error: sessionError } = await db.auth.getSession();

        if (sessionError || !session) {
            console.log("Nenhuma sessão ativa encontrada. Redirecionando...");
            window.location.href = 'login.html';
            return;
        }

        const user = session.user;

        // Busca o perfil na tabela complementar para pegar o nome real (Ex: Ana luisa)
        const { data: perfil, error: perfilError } = await db
            .from('perfis')
            .select('nome, tipo')
            .eq('id', user.id)
            .single();

        if (perfilError || !perfil) {
            console.error("Perfil complementar não encontrado:", perfilError);
            configurarCamposTela(user.email, user.email);
            return;
        }

        // Alimenta a tela com os dados vindos direto do seu Supabase
        configurarCamposTela(perfil.nome, user.email);

    } catch (err) {
        console.error("Erro no controle de acesso:", err);
        window.location.href = 'login.html';
    }
}

function configurarCamposTela(nomeReal, emailReal) {
    // Vinculação exata com os IDs presentes no seu arquivo HTML
    const campoNome = document.getElementById('pacienteNomeBoasVindas');
    const campoEmail = document.getElementById('pacienteEmailTag');

    if (campoNome) campoNome.textContent = `Olá, ${nomeReal}`;
    if (campoEmail) campoEmail.textContent = emailReal;

    // Dispara a busca do histórico de consultas e dados financeiros
    carregarDadosClinicosEFinanceiros(nomeReal);
}

async function carregarDadosClinicosEFinanceiros(nomePaciente) {
    try {
        // 1. Puxa as sessões reais da tabela 'agendamentos'
        const { data: agendamentos, error: errorAgendamentos } = await db
            .from('agendamentos')
            .select('*')
            .eq('paciente_nome', nomePaciente)
            .order('data_hora', { ascending: true });

        if (errorAgendamentos) throw errorAgendamentos;

        // 2. BUSCA OS LANÇAMENTOS REAIS DA TABELA FINANCEIRO
        // Buscamos os lançamentos onde a descrição contenha o nome do paciente
        const { data: lancamentosFinanceiros, error: errorFinanceiro } = await db
            .from('financeiro')
            .select('*')
            .ilike('descricao', `%${nomePaciente}%`)
            .order('data_competencia', { ascending: false });

        if (errorFinanceiro) throw errorFinanceiro;

        // Seleção dos corpos das tabelas com base no seu HTML
        const tabelaConsultas = document.getElementById('historicoConsultasBody');
        const tabelaFinanceiro = document.getElementById('financeiroPacientesBody');
        
        if (tabelaConsultas) tabelaConsultas.innerHTML = '';
        if (tabelaFinanceiro) tabelaFinanceiro.innerHTML = '';

        // Contadores para os Badges e cards da Dashboard
        let totalSessoes = agendamentos.length;
        let confirmadas = 0;
        let pendentes = 0;
        let proximaConsultaDefinida = false;

        // --- RENDERIZAÇÃO DA ABA DE CONSULTAS ---
        agendamentos.forEach(sessao => {
            const objData = new Date(sessao.data_hora);
            const dataFormatada = objData.toLocaleDateString('pt-BR');
            const horaFormatada = objData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            if (sessao.status === 'Confirmada') confirmadas++;
            if (sessao.status === 'Pendente') pendentes++;

            // Preenche o bloco de Próxima Consulta (Primeiro agendamento futuro encontrado)
            if (!proximaConsultaDefinida && sessao.status === 'Pendente' && objData > new Date()) {
                const pData = document.getElementById('proximaConsultaData');
                const pHora = document.getElementById('proximaConsultaHora');
                if (pData) pData.textContent = dataFormatada;
                if (pHora) pHora.textContent = horaFormatada;
                proximaConsultaDefinida = true;
            }

            // Alimenta a tabela: Histórico Completo de Sessões
            if (tabelaConsultas) {
                const badgeStyle = sessao.status === 'Confirmada' ? 'bg-success' : (sessao.status === 'Cancelada' ? 'bg-danger' : 'bg-warning');
                tabelaConsultas.innerHTML += `
                    <tr>
                        <td>${dataFormatada}</td>
                        <td>${horaFormatada}</td>
                        <td><span class="badge ${badgeStyle}">${sessao.status}</span></td>
                    </tr>
                `;
            }
        });

        // --- RENDERIZAÇÃO DA ABA FINANCEIRA (DADOS REAIS DO BANCO) ---
        if (tabelaFinanceiro) {
            if (!lancamentosFinanceiros || lancamentosFinanceiros.length === 0) {
                tabelaFinanceiro.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Nenhum histórico financeiro lançado.</td></tr>`;
            } else {
                lancamentosFinanceiros.forEach(lancamento => {
                    // Pega o valor real digitado pelo psicólogo
                    const valorReal = parseFloat(lancamento.valor || 0);
                    
                    // Formata a data de competência para exibir ao lado do serviço se quiser, ou usa a descrição direto
                    const statusFin = '<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> Lançado / Pago</span>';
                    
                    tabelaFinanceiro.innerHTML += `
                        <tr>
                            <td class="fw-semibold">${lancamento.descricao || 'Sessão de Psicoterapia'}</td>
                            <td class="fw-bold text-dark">R$ ${valorReal.toFixed(2).replace('.', ',')}</td>
                            <td>${statusFin}</td>
                        </tr>
                    `;
                });
            }
        }

        // Trata o estado caso não possua nenhuma consulta futura agendada
        if (!proximaConsultaDefinida) {
            const pData = document.getElementById('proximaConsultaData');
            if (pData) pData.textContent = "Sem agendamentos";
        }

        // Atualiza os Badges numéricos superiores da Dashboard
        const badgeTotal = document.getElementById('totalConsultasBadge');
        const badgeConfirmadas = document.getElementById('consultasConfirmadasBadge');

        if (badgeTotal) badgeTotal.textContent = totalSessoes;
        if (badgeConfirmadas) badgeConfirmadas.textContent = confirmadas;

    } catch (err) {
        console.error("Erro ao renderizar dados clínicos/financeiros:", err.message);
    }
}
// Função para chaveamento visual entre as abas de Consulta e Financeiro
function trocarAbaPaciente(aba) {
    const secaoConsultas = document.getElementById('aba-paciente-consultas');
    const secaoFinanceiro = document.getElementById('aba-paciente-financeiro');
    const btnConsultas = document.getElementById('btn-consultas');
    const btnFinanceiro = document.getElementById('btn-financeiro');

    if (aba === 'consultas') {
        if (secaoConsultas) secaoConsultas.classList.remove('d-none');
        if (secaoFinanceiro) secaoFinanceiro.classList.add('d-none');
        if (btnConsultas) btnConsultas.classList.add('active');
        if (btnFinanceiro) btnFinanceiro.classList.remove('active');
    } else if (aba === 'financeiro') {
        if (secaoConsultas) secaoConsultas.classList.add('d-none');
        if (secaoFinanceiro) secaoFinanceiro.classList.remove('d-none');
        if (btnConsultas) btnConsultas.classList.remove('active');
        if (btnFinanceiro) btnFinanceiro.classList.add('active');
    }
}

// Expõe a função de troca de abas globalmente para os cliques do HTML funcionarem
window.trocarAbaPaciente = trocarAbaPaciente;