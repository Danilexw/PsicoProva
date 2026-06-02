// js/psicologo.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de Segurança
    const role = localStorage.getItem('user_role');
    if (!role || role !== 'psicologo') {
        window.location.href = 'login.html';
        return;
    }

    // 2. Nome do Usuário
    const nome = localStorage.getItem('user_name');
    document.getElementById('userName').innerText = `Olá, ${nome}`;

    // 3. Carrega a agenda inicial
    carregarAgenda();
});

// FUNÇÃO: Carregar Agenda do Supabase
async function carregarAgenda() {
    const tbody = document.getElementById('agendaBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Buscando...</td></tr>';

    try {
        const { data, error } = await db
            .from('agendamentos')
            .select('*')
            .order('data_hora', { ascending: true });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma sessão encontrada.</td></tr>';
            return;
        }

        data.forEach(item => {
            const dataObj = new Date(item.data_hora);
            const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const statusColor = item.status === 'Confirmada' ? 'bg-success' : 'bg-warning';

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${hora}</td>
                    <td>${item.paciente_nome}</td>
                    <td><span class="badge ${statusColor}">${item.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="atender('${item.id}', '${item.paciente_nome}')">
                            Atender
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

// FUNÇÃO: Trocar Abas Laterais
function trocarAba(nomeAba) {
    document.querySelectorAll('.secao-dashboard').forEach(sec => sec.classList.add('d-none'));
    document.querySelectorAll('.nav-link-custom').forEach(link => link.classList.remove('active'));

    if (nomeAba === 'agenda') {
        document.getElementById('aba-agenda').classList.remove('d-none');
        document.getElementById('btn-agenda').classList.add('active');
        carregarAgenda();
    } else {
        const secaoGenerica = document.getElementById('aba-conteudo');
        document.getElementById('tituloAba').innerText = nomeAba.charAt(0).toUpperCase() + nomeAba.slice(1);
        document.getElementById('descricaoAba').innerText = `Módulo de ${nomeAba} em desenvolvimento.`;
        document.getElementById(`btn-${nomeAba}`).classList.add('active');
        secaoGenerica.classList.remove('d-none');
    }
}

// FUNÇÃO: Abrir Modal
function novaSessao() {
    const meuModal = new bootstrap.Modal(document.getElementById('modalSessao'));
    meuModal.show();
}

// EVENTO: Salvar Nova Sessão
document.getElementById('formNovaSessao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('pacienteNome').value;
    const data = document.getElementById('sessaoData').value;

    try {
        const { error } = await db.from('agendamentos').insert([
            { paciente_nome: nome, data_hora: data, status: 'Confirmada' }
        ]);

        if (error) throw error;

        // Fecha o modal usando a instância correta do Bootstrap
        const modalEl = document.getElementById('modalSessao');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();

        alert("Sessão agendada com sucesso!");
        carregarAgenda(); // Atualiza a tabela sem dar F5
        e.target.reset(); // Limpa o formulário
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
});

// FUNÇÃO: Log de Auditoria ao Atender
async function atender(idSessao, nomePaciente) {
    alert(`Iniciando atendimento de: ${nomePaciente}`);
    try {
        const { data: { user } } = await db.auth.getUser();
        await db.from('logs_sistema').insert([{
            usuario_id: user.id,
            acao: `Atendimento iniciado`,
            detalhes: `Paciente: ${nomePaciente}`
        }]);
    } catch (logErr) {
        console.error("Erro no log:", logErr);
    }
}