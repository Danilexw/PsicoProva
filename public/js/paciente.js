// js/paciente.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validação de Segurança básica do lado do cliente
    const role = localStorage.getItem('user_role');
    const nomePaciente = localStorage.getItem('user_name');

    if (!role || role !== 'paciente') {
        window.location.href = 'login.html';
        return;
    }

    // 2. Insere os dados básicos na tela
    document.getElementById('pacienteNomeBoasVindas').innerText = `Olá, ${nomePaciente}`;
    
    // Recupera os dados extras do usuário logado se precisar
    buscarDadosEConsultasDoPaciente(nomePaciente);
});

/**
 * FUNÇÃO: Carrega os agendamentos do banco cruzando o nome do paciente ativo
 */
async function buscarDadosEConsultasDoPaciente(nomePaciente) {
    try {
        // Busca os metadados do usuário para pegar o e-mail cadastrado no Auth
        const { data: { user } } = await db.auth.getUser();
        if(user) {
            document.getElementById('pacienteEmailTag').innerText = user.email;
        }

        // Puxa todos os agendamentos feitos para esse paciente
        const { data: agendamentos, error } = await db
            .from('agendamentos')
            .select('*')
            .eq('paciente_nome', nomePaciente)
            .order('data_hora', { ascending: true });

        if (error) throw error;

        alimentarPainelConsultas(agendamentos);
        alimentarPainelFinanceiro(agendamentos);

    } catch (err) {
        console.error("Erro ao carregar dados do paciente:", err);
    }
}

/**
 * FUNÇÃO: Distribui as consultas nas tabelas, badges e calcula a próxima sessão
 */
function alimentarPainelConsultas(agendamentos) {
    const tbody = document.getElementById('historicoConsultasBody');
    if (!tbody) return;

    if (!agendamentos || agendamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Você ainda não possui consultas agendadas.</td></tr>';
        document.getElementById('proximaConsultaData').innerText = "Nenhum agendamento";
        document.getElementById('proximaConsultaHora').innerText = "Fale com seu psicólogo";
        return;
    }

    tbody.innerHTML = '';
    let total = agendamentos.length;
    let confirmadas = 0;
    let proximaSessaoEncontrada = null;
    const agora = new Date();

    agendamentos.forEach(item => {
        const dataObjeto = new Date(item.data_hora);
        const dataFormatada = dataObjeto.toLocaleDateString('pt-BR');
        const horaFormatada = dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const statusColor = item.status === 'Confirmada' ? 'bg-success' : 'bg-warning';
        
        if (item.status === 'Confirmada') confirmadas++;

        // Descobre qual é a próxima consulta ativa (data futura mais próxima)
        if (dataObjeto >= agora && !proximaSessaoEncontrada) {
            proximaSessaoEncontrada = { data: dataFormatada, hora: horaFormatada };
        }

        // Alimenta a tabela de histórico
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${dataFormatada}</td>
                <td>${horaFormatada}</td>
                <td><span class="badge ${statusColor}">${item.status}</span></td>
            </tr>
        `;
    });

    // Atualiza os contadores numéricos do topo
    document.getElementById('totalConsultasBadge').innerText = total;
    document.getElementById('consultasConfirmadasBadge').innerText = confirmadas;

    // Atualiza o card de destaque da próxima consulta
    if (proximaSessaoEncontrada) {
        document.getElementById('proximaConsultaData').innerText = proximaSessaoEncontrada.data;
        document.getElementById('proximaConsultaHora').innerText = `${proximaSessaoEncontrada.hora}h - Presencial/Online`;
    } else {
        document.getElementById('proximaConsultaData').innerText = "Sem consultas futuras";
        document.getElementById('proximaConsultaHora').innerText = "Agende com o Dr.";
    }
}

/**
 * FUNÇÃO: Alimenta a aba financeira gerando faturas simuladas automáticas por consulta
 */
function alimentarPainelFinanceiro(agendamentos) {
    const tbody = document.getElementById('financeiroPacientesBody');
    if (!tbody) return;

    if (!agendamentos || agendamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum histórico financeiro lançado.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    agendamentos.forEach((item, index) => {
        const dataObjeto = new Date(item.data_hora);
        const dataFormatada = dataObjeto.toLocaleDateString('pt-BR');
        
        // Simula o valor da sessão (ex: R$ 150,00) e define o status com base na confirmação da sessão
        const valorSessao = "R$ 150,00";
        const statusPagamento = item.status === 'Confirmada' 
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Pago</span>' 
            : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill">Aguardando Sessão</span>';

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="fw-bold">Sessão de Psicoterapia Clínica</div>
                    <small class="text-muted">Realizada/Agendada em: ${dataFormatada}</small>
                </td>
                <td class="fw-semibold text-dark">${valorSessao}</td>
                <td>${statusPagamento}</td>
            </tr>
        `;
    });
}

/**
 * FUNÇÃO: Alternância de abas simples (SPA) do lado do paciente
 */
function trocarAbaPaciente(nomeAba) {
    document.getElementById('aba-paciente-consultas').classList.add('d-none');
    document.getElementById('aba-paciente-financeiro').classList.add('d-none');
    
    document.getElementById('btn-consultas').classList.remove('active');
    document.getElementById('btn-financeiro').classList.remove('active');

    if (nomeAba === 'consultas') {
        document.getElementById('aba-paciente-consultas').classList.remove('d-none');
        document.getElementById('btn-consultas').classList.add('active');
    } else if (nomeAba === 'financeiro') {
        document.getElementById('aba-paciente-financeiro').classList.remove('d-none');
        document.getElementById('btn-financeiro').classList.add('active');
    }
}

// ==========================================
// FLUXO DE ALTERAÇÃO DE SENHA DO PACIENTE
// ==========================================
const formAlterarSenha = document.getElementById('formAlterarSenha');

if (formAlterarSenha) {
    formAlterarSenha.addEventListener('submit', async (e) => {
        e.preventDefault();

        const novaSenha = document.getElementById('novaSenhaInput').value;
        const confirmarSenha = document.getElementById('confirmarNovaSenhaInput').value;

        // 1. Validação básica: as senhas precisam ser iguais
        if (novaSenha !== confirmarSenha) {
            alert("As senhas não coincidem! Por favor, verifique.");
            return;
        }

        try {
            // 2. Chama a função nativa do Supabase para atualizar o usuário logado
            const { data, error } = await db.auth.updateUser({
                password: novaSenha
            });

            if (error) throw error;

            // 3. Sucesso!
            alert("Senha atualizada com sucesso!");
            
            // Limpa o formulário e fecha o modal de forma limpa
            formAlterarSenha.reset();
            const modalEl = document.getElementById('modalAlterarSenha');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            }

        } catch (err) {
            console.error("Erro ao atualizar a senha:", err);
            alert("Erro ao alterar a senha: " + err.message);
        }
    });
}