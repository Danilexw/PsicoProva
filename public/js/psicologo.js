// js/psicologo.js

let modalNovaSessao = null;
let modalEditarSessao = null;
let listaPacientesGlobais = []; // Guarda a lista de pacientes temporariamente para agilizar consultas

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de Segurança
    const role = localStorage.getItem('user_role');
    if (!role || role !== 'psicologo') {
        window.location.href = 'login.html';
        return;
    }

    // 2. Nome do Usuário
    const nome = localStorage.getItem('user_name');
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.innerText = `Olá, ${nome}`;

    // Inicializa os modais do Bootstrap
    const modalSessaoEl = document.getElementById('modalSessao');
    const modalEditarSessaoEl = document.getElementById('modalEditarSessao');
    
    if (modalSessaoEl) modalNovaSessao = new bootstrap.Modal(modalSessaoEl);
    if (modalEditarSessaoEl) modalEditarSessao = new bootstrap.Modal(modalEditarSessaoEl);

    // Ouvinte do formulário de novos pacientes
    const formNovoPaciente = document.getElementById('formNovoPaciente');
    if (formNovoPaciente) formNovoPaciente.addEventListener('submit', cadastrarPaciente);

    // 3. Inicializa os dados chamando a função
    inicializarSistema();
});

// FUNÇÃO: Inicializar Sistema
async function inicializarSistema() {
    await carregarPacientesNosSelects(); 
    await listarPacientesNaAba(); 
    await carregarAgenda();
}

// FUNÇÃO: Carregar Agenda
async function carregarAgenda() {
    const tbody = document.getElementById('agendaBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Buscando agendamentos...</td></tr>';

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
            const dataObjeto = new Date(item.data_hora);
            const horaFormatada = dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const statusColor = item.status === 'Confirmada' ? 'bg-success' : 'bg-warning';
            const nomeEscapado = item.paciente_nome ? item.paciente_nome.replace(/'/g, "\\'") : 'Paciente Sem Nome';

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${horaFormatada}</td>
                    <td>${item.paciente_nome || '-'}</td>
                    <td>
                        <span class="badge ${statusColor}" style="cursor: pointer; user-select: none;" onclick="alternarStatus('${item.id}', '${item.status}')" title="Clique para alterar o status">
                            ${item.status}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="atender('${item.id}', '${nomeEscapado}')">
                                Atender
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="prepararEdicao('${item.id}', '${nomeEscapado}', '${item.data_hora}')" title="Editar Agendamento">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirSessao('${item.id}', '${nomeEscapado}')" title="Excluir Agendamento">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar dados do banco.</td></tr>';
    }
}

// FUNÇÃO: Alternar o Status
async function alternarStatus(idSessao, statusAtual) {
    const novoStatus = statusAtual === 'Confirmada' ? 'Pendente' : 'Confirmada';
    
    try {
        const { error } = await db
            .from('agendamentos')
            .update({ status: novoStatus })
            .eq('id', idSessao);

        if (error) throw error;
        carregarAgenda(); 
    } catch (err) {
        alert("Erro ao atualizar status: " + err.message);
    }
}

// FUNÇÃO: Preparar e abrir o modal de edição
function prepararEdicao(id, nome, dataHoraISO) {
    document.getElementById('editarSessaoId').value = id;
    document.getElementById('editarPacienteNome').value = nome;
    
    const dataLocal = new Date(dataHoraISO);
    const tzOffset = dataLocal.getTimezoneOffset() * 60000; 
    const dataFormatada = (new Date(dataLocal.getTime() - tzOffset)).toISOString().substring(0, 16);
    
    document.getElementById('editarSessaoData').value = dataFormatada;
    if (modalEditarSessao) modalEditarSessao.show();
}

// EVENTO: Salvar dados editados
const formEditarSessao = document.getElementById('formEditarSessao');
if (formEditarSessao) {
    formEditarSessao.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editarSessaoId').value;
        const nome = document.getElementById('editarPacienteNome').value;
        const dataInput = document.getElementById('editarSessaoData').value; 

        const dataParaBanco = new Date(dataInput).toISOString();

        try {
            const { error } = await db
                .from('agendamentos')
                .update({ paciente_nome: nome, data_hora: dataParaBanco })
                .eq('id', id);

            if (error) throw error;

            if (modalEditarSessao) modalEditarSessao.hide();
            carregarAgenda();
        } catch (err) {
            alert("Erro ao salvar alterações: " + err.message);
        }
    });
}

// FUNÇÃO: Deletar Sessão do Banco
async function excluirSessao(idSessao, nomePaciente) {
    if (confirm(`Deseja realmente excluir o agendamento de ${nomePaciente}?`)) {
        try {
            const { error } = await db
                .from('agendamentos')
                .delete()
                .eq('id', idSessao);

            if (error) throw error;
            carregarAgenda();
        } catch (err) {
            alert("Erro ao excluir: " + err.message);
        }
    }
}

// FUNÇÃO: Abrir Modal de Nova Sessão
function novaSessao() {
    if (modalNovaSessao) modalNovaSessao.show();
}

// EVENTO: Gravar nova sessão
const formNovaSessao = document.getElementById('formNovaSessao');
if (formNovaSessao) {
    formNovaSessao.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectPaciente = document.getElementById('pacienteNome');
        const nome = selectPaciente.value; 
        const dataInput = document.getElementById('sessaoData').value; 
        const statusInput = document.getElementById('sessaoStatus').value;

        const dataParaBanco = new Date(dataInput).toISOString();

        try {
            const { error } = await db.from('agendamentos').insert([
                { 
                    paciente_nome: nome, 
                    data_hora: dataParaBanco, 
                    status: statusInput
                }
            ]);

            if (error) throw error;

            if (modalNovaSessao) modalNovaSessao.hide();
            e.target.reset(); 
            carregarAgenda();
        } catch (err) {
            alert("Erro ao salvar agendamento: " + err.message);
        }
    });
}

// FUNÇÃO: Rastreabilidade / Atender
async function atender(idSessao, nomePaciente) {
    alert(`Iniciando atendimento de: ${nomePaciente}`);
    
    try {
        const { error: errorStatus } = await db
            .from('agendamentos')
            .update({ status: 'Confirmada' })
            .eq('id', idSessao);

        if (errorStatus) throw errorStatus;

        const { data: { user } } = await db.auth.getUser();
        await db.from('logs_sistema').insert([{
            usuario_id: user.id,
            acao: `Atendimento iniciado`,
            detalhes: `Paciente: ${nomePaciente} - Status alterado para Confirmada`
        }]);

        carregarAgenda();

    } catch (err) {
        console.error("Erro ao iniciar atendimento:", err);
        alert("Erro ao atualizar o atendimento: " + err.message);
    }
}

// FUNÇÃO COMPLETA: Cria o usuário no Auth, perfil e salva dados cadastrais clínicos
async function cadastrarPaciente(e) {
    e.preventDefault();
    
    const nomePaciente = document.getElementById('novoPacienteNome').value;
    const emailInstitucional = document.getElementById('novoPacienteEmail').value;
    const aniversario = document.getElementById('novoPacienteAniversario').value;
    const idade = document.getElementById('novoPacienteIdade').value;
    const telefone = document.getElementById('novoPacienteTelefone').value;
    const senhaPadrao = 'Mudar@123';

    try {
        const { data: authData, error: authError } = await db.auth.signUp({
            email: emailInstitucional,
            password: senhaPadrao,
            options: {
                data: {
                    user_name: nomePaciente,
                    user_role: 'paciente'
                }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Não foi possível gerar as credenciais do usuário.");

        const novoUsuarioId = authData.user.id;

        const { error: clinicaError } = await db
            .from('pacientes_clinica')
            .insert([
                { 
                    id: novoUsuarioId, 
                    nome: nomePaciente,
                    email_institucional: emailInstitucional,
                    aniversario: aniversario ? aniversario : null, 
                    idade: idade ? parseInt(idade) : null,
                    telefone: telefone,
                    senha: senhaPadrao
                }
            ]);

        if (clinicaError) throw clinicaError;

        const { error: perfilError } = await db
            .from('perfis')
            .insert([
                {
                    id: novoUsuarioId,
                    nome: nomePaciente,
                    tipo: 'paciente'
                }
            ]);

        if (perfilError) throw perfilError;

        alert(`Paciente cadastrado e usuário criado!\nLogin: ${emailInstitucional}\nSenha: ${senhaPadrao}`);
        
        document.getElementById('formNovoPaciente').reset();
        const collapseEl = document.getElementById('collapseCadastroPaciente');
        if (collapseEl) {
            const collapseInstance = bootstrap.Collapse.getInstance(collapseEl);
            if (collapseInstance) collapseInstance.hide();
        }
        
        await carregarPacientesNosSelects();
        await listarPacientesNaAba();

    } catch (err) {
        alert('Erro ao realizar o cadastro completo: ' + err.message);
        console.error("Erro no fluxo de criação do usuário:", err);
    }
}

// FUNÇÃO: Listar Pacientes na Aba do Painel
async function listarPacientesNaAba() {
    const tbody = document.getElementById('pacientesTableBody');
    if (!tbody) return;

    if (listaPacientesGlobais.length === 0) {
        await carregarPacientesNosSelects();
    }

    if (listaPacientesGlobais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum paciente cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    listaPacientesGlobais.forEach(paciente => {
        const email = paciente.email_institucional || '-';
        const telefone = paciente.telefone || '-';
        const idade = paciente.idade ? `${paciente.idade} anos` : '-';
        const nomeEscapado = paciente.nome ? paciente.nome.replace(/'/g, "\\'") : 'Paciente';

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${paciente.nome}</td>
                <td class="text-muted">${email}</td>
                <td>${telefone}</td>
                <td>${idade}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirPaciente('${paciente.id}', '${nomeEscapado}')">
                        <i class="bi bi-trash"></i> Excluir
                    </button>
                </td>
            </tr>
        `;
    });
}

// FUNÇÃO: Trocar Abas da Sidebar (SPA)
function trocarAba(aba) {
    // 1. Esconder todas as abas adicionando 'd-none'
    document.getElementById('aba-agenda')?.classList.add('d-none');
    document.getElementById('aba-pacientes')?.classList.add('d-none');
    document.getElementById('aba-financeiro')?.classList.add('d-none');
    document.getElementById('aba-prontuarios')?.classList.add('d-none'); // Garante que a de prontuários some se trocar de aba

    // 2. Remover a classe 'active' de todos os links da sidebar
    document.getElementById('btn-agenda')?.classList.remove('active');
    document.getElementById('btn-pacientes')?.classList.remove('active');
    document.getElementById('btn-financeiro')?.classList.remove('active');
    document.getElementById('btn-prontuarios')?.classList.remove('active');

    // 3. Mostrar a aba clicada e ativar o respectivo botão
    const abaAlvo = document.getElementById(`aba-${aba}`);
    const btnAlvo = document.getElementById(`btn-${aba}`);

    if (abaAlvo && btnAlvo) {
        abaAlvo.classList.remove('d-none');
        btnAlvo.classList.add('active');
    }

    // 4. Executar funções específicas de cada aba ao entrar nelas
    if (aba === 'prontuarios') {
        buscarProntuarios(); // Executa a busca no banco de dados
    }
}

// FUNÇÃO: Deleta o registro do paciente
async function excluirPaciente(id, nome) {
    if (confirm(`Deseja realmente excluir o cadastro de ${nome}?`)) {
        try {
            const { error } = await db
                .from('pacientes_clinica')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            await carregarPacientesNosSelects();
            await listarPacientesNaAba();
        } catch (err) {
            alert("Erro ao excluir paciente: " + err.message);
        }
    }
}

// FUNÇÃO: Puxa do banco e alimenta as listas e caches globais
async function carregarPacientesNosSelects() {
    try {
        const { data, error } = await db
            .from('pacientes_clinica')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;

        listaPacientesGlobais = data || [];

        const selectNovaSessao = document.getElementById('pacienteNome');
        const selectEditarSessao = document.getElementById('editarPacienteNome');

        if (!selectNovaSessao || !selectEditarSessao) return;

        let optionsHTML = '<option value="" disabled selected>Selecione um paciente...</option>';
        
        listaPacientesGlobais.forEach(paciente => {
            optionsHTML += `<option value="${paciente.nome}" data-id="${paciente.id}">${paciente.nome}</option>`;
        });

        selectNovaSessao.innerHTML = optionsHTML;
        selectEditarSessao.innerHTML = optionsHTML;

    } catch (err) {
        console.error("Erro geral na função carregarPacientesNosSelects:", err);
    }
}

// FUNÇÃO: Gera o e-mail institucional dinamicamente
function gerarEmailInstitucional(nomeCompleto) {
    const emailInput = document.getElementById('novoPacienteEmail');
    if (!emailInput) return;

    const partes = nomeCompleto.trim().toLowerCase().split(/\s+/);
    
    if (partes.length === 0 || partes[0] === "") {
        emailInput.value = "";
        return;
    }

    const primeiroNome = partes[0];

    if (partes.length > 1) {
        const primeiraLetraSobrenome = partes[1].charAt(0);
        emailInput.value = `${primeiroNome}.${primeiraLetraSobrenome}@psico.com`;
    } else {
        emailInput.value = `${primeiroNome}@psico.com`;
    }
}

// FUNÇÃO: Calcula a idade automaticamente
function calcularIdade(dataNascimento) {
    const idadeInput = document.getElementById('novoPacienteIdade');
    if (!idadeInput || !dataNascimento) return;

    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();

    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
        idade--;
    }

    idadeInput.value = idade >= 0 ? Math.floor(idade) : 0;
}

// ==========================================================
// MÓDULO DE PRONTUÁRIOS E EVOLUÇÃO CLÍNICA (AJUSTADO AO BANCO)
// ==========================================================
// ==========================================================
// MÓDULO DE PRONTUÁRIOS, EVOLUÇÃO, EDIÇÃO E EXCLUSÃO
// ==========================================================

// ==========================================================
// MÓDULO DE PRONTUÁRIOS - PADRÃO CLÍNICO ANAMNESE
// ==========================================================
let cacheProntuarios = [];

async function buscarProntuarios() {
    try {
        const tbody = document.getElementById('prontuariosTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Buscando prontuários...</td></tr>';
        const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);

        const { data: prontuarios, error } = await conexaoDb
            .from('prontuarios')
            .select('*')
            .order('data_sessao', { ascending: false });

        if (error) throw error;
        cacheProntuarios = prontuarios || [];

        if (cacheProntuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum prontuário registrado até o momento.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        cacheProntuarios.forEach((item, index) => {
            const dataObjeto = new Date(item.data_sessao);
            const dataFormatada = dataObjeto.toLocaleDateString('pt-BR') + ' às ' + dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-dark">${item.paciente_nome}</td>
                    <td class="text-muted">${dataFormatada}</td>
                    <td>
                        <div class="text-truncate" style="max-width: 320px;">
                            ${item.evolucao_clinica}
                        </div>
                    </td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary px-2" onclick="verProntuarioDetalhado(${index})">
                                <i class="bi bi-eye"></i> Ver Ficha
                            </button>
                            <button class="btn btn-sm btn-outline-danger px-2" onclick="excluirProntuarioDoBanco('${item.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

function verProntuarioDetalhado(index) {
    const p = cacheProntuarios[index];
    if (!p) return;

    const dataObjeto = new Date(p.data_sessao);
    const dataFormatada = dataObjeto.toLocaleDateString('pt-BR') + ' ' + dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Injeção de valores na folha corrida estruturada do modal
    document.getElementById('visNome').innerText = p.paciente_nome;
    document.getElementById('visData').innerText = dataFormatada;
    document.getElementById('visSexo').innerText = p.sexo || '[ ] M  [ ] F';
    document.getElementById('visEndereco').innerText = p.endereco || 'Não informado';
    document.getElementById('visTelefone').innerText = p.telefone || 'Não informado';
    document.getElementById('visEmail').innerText = p.email || 'Não informado';
    document.getElementById('visResponsavel').innerText = p.responsavel_contato || 'Não aplicável';
    document.getElementById('visMedico').innerText = p.medico_responsavel || 'Não informado';
    document.getElementById('visEscolaridade').innerText = p.escolaridade || 'Não informado';
    document.getElementById('visOcupacao').innerText = p.ocupacao || 'Não informado';
    document.getElementById('visAlergia').innerText = p.alergia || 'Nenhuma declarada';

    // Formatação de checkboxes salvos
    let limites = [];
    if (p.limitacao_cognitiva) limites.push('[X] Cognitiva');
    if (p.limitacao_locomocao) limites.push('[X] Locomoção');
    if (p.limitacao_visao) limites.push('[X] Visão');
    if (p.limitacao_audicao) limites.push('[X] Audição');
    if (p.limitacao_outras) limites.push(`Outras: ${p.limitacao_outras}`);
    
    document.getElementById('visLimitacoes').innerText = limites.length > 0 ? limites.join('  ') : 'Nenhuma limitação declarada';
    document.getElementById('visEvolucao').innerText = p.evolucao_clinica;

    const modal = new bootstrap.Modal(document.getElementById('modalVisualizarProntuario'));
    modal.show();
}

// Escuta o envio do formulário expandido para gravação
document.addEventListener('DOMContentLoaded', () => {
    const formNovoProntuario = document.getElementById('formNovoProntuario');
    if (formNovoProntuario) {
        formNovoProntuario.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                paciente_nome: document.getElementById('prontuarioPacienteSelect').value,
                data_sessao: document.getElementById('prontuarioDataInput').value,
                sexo: document.getElementById('prontuarioSexo').value,
                endereco: document.getElementById('prontuarioEndereco').value,
                telefone: document.getElementById('prontuarioTelefone').value,
                email: document.getElementById('prontuarioEmail').value,
                responsavel_contato: document.getElementById('prontuarioResponsavel').value,
                medico_responsavel: document.getElementById('prontuarioMedico').value,
                escolaridade: document.getElementById('prontuarioEscolaridade').value,
                ocupacao: document.getElementById('prontuarioOcupacao').value,
                limitacao_cognitiva: document.getElementById('limitacaoCognitiva').checked,
                limitacao_locomocao: document.getElementById('limitacaoLocomocao').checked,
                limitacao_visao: document.getElementById('limitacaoVisao').checked,
                limitacao_audicao: document.getElementById('limitacaoAudicao').checked,
                limitacao_outras: document.getElementById('limitacaoOutras').value,
                alergia: document.getElementById('prontuarioAlergia').value,
                evolucao_clinica: document.getElementById('prontuarioTextoInput').value
            };

            try {
                const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);
                const { error } = await conexaoDb.from('prontuarios').insert([payload]);
                if (error) throw error;

                alert("Prontuário de Admissão gravado com sucesso!");
                formNovoProntuario.reset();
                bootstrap.Modal.getInstance(document.getElementById('modalNovoProntuario'))?.hide();
                buscarProntuarios();
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            }
        });
    }
});

// Mantém a função auxiliar de exclusão ativa
async function excluirProntuarioDoBanco(id) {
    if (!confirm("Remover este prontuário permanentemente?")) return;
    try {
        const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);
        const { error } = await conexaoDb.from('prontuarios').delete().eq('id', id);
        if (error) throw error;
        alert("Removido.");
        buscarProntuarios();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================================
// CORREÇÃO: FUNÇÃO PARA ALIMENTAR O SELECT DE PACIENTES NO PRONTUÁRIO
// ==========================================================

async function prepararSelectPacientesProntuario() {
    try {
        // Tenta encontrar o select usando o ID esperado pelo seu script atual 
        // ou o id padrão comum para esse campo estruturado
        const selectProntuario = document.getElementById('prontuarioPacienteSelect') || document.querySelector('select[id*="Paciente"]') || document.querySelector('.modal-body select');
        
        if (!selectProntuario) {
            console.warn("Elemento select de pacientes do prontuário não foi encontrado no HTML.");
            return;
        }

        // Se o cache global estiver vazio por algum motivo, busca do banco na hora
        if (!listaPacientesGlobais || listaPacientesGlobais.length === 0) {
            const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);
            const { data, error } = await conexaoDb
                .from('pacientes_clinica')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;
            listaPacientesGlobais = data || [];
        }

        // Monta o HTML das opções salvando o nome do paciente como Value
        let optionsHTML = '<option value="" disabled selected>Selecione o paciente...</option>';
        listaPacientesGlobais.forEach(paciente => {
            optionsHTML += `<option value="${paciente.nome}" data-id="${paciente.id}">${paciente.nome}</option>`;
        });

        selectProntuario.innerHTML = optionsHTML;
        console.log("Select de pacientes do prontuário alimentado com sucesso!");

    } catch (err) {
        console.error("Erro ao preparar o select de pacientes para o prontuário:", err);
    }
}

// OUVINTE AUTOMÁTICO DE INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    // Escuta o modal de Novo Prontuário abrir para rodar a função automaticamente
    const modalNovoProntuarioEl = document.getElementById('modalNovoProntuario');
    if (modalNovoProntuarioEl) {
        modalNovoProntuarioEl.addEventListener('show.bs.modal', () => {
            prepararSelectPacientesProntuario();
        });
    }
});

// ==========================================================
// FUNÇÃO: AUTO-PREENCHIMENTO AUTOMÁTICO DO PRONTUÁRIO
// ==========================================================
function autopreencherDadosDoPaciente(nomeSelecionado) {
    if (!nomeSelecionado) return;

    // Encontra o objeto do paciente dentro do cache global do sistema
    const pacienteEncontrado = listaPacientesGlobais.find(p => p.nome === nomeSelecionado);

    if (pacienteEncontrado) {
        console.log("Paciente localizado para auto-preenchimento:", pacienteEncontrado);

        // Preenche o campo de Telefone se existir no formulário
        const inputTelefone = document.getElementById('prontuarioTelefone');
        if (inputTelefone) inputTelefone.value = pacienteEncontrado.telefone || '';

        // Preenche o campo de E-mail
        const inputEmail = document.getElementById('prontuarioEmail');
        if (inputEmail) inputEmail.value = pacienteEncontrado.email_institucional || '';

        // Preenche automaticamente a Data de Abertura com o dia e hora atual do sistema
        const inputData = document.getElementById('prontuarioDataInput');
        if (inputData && !inputData.value) {
            const agora = new Date();
            const tzOffset = agora.getTimezoneOffset() * 60000;
            inputData.value = (new Date(agora.getTime() - tzOffset)).toISOString().substring(0, 16);
        }

        // Se houver um campo de idade oculto ou visível na ficha médica, podemos tentar estimar ou resgatar
        // Nota: Como o sexo não é coletado no cadastro simplificado de pacientes, deixamos o select livre para o psicólogo definir.
        
        console.log("Campos preenchidos de forma automatizada!");
    } else {
        console.warn("Paciente selecionado não foi encontrado na lista global.");
    }
}

// Escutas de Formulários (Novo e Edição)
document.addEventListener('DOMContentLoaded', () => {
    // Form de Inserção
    const formNovoProntuario = document.getElementById('formNovoProntuario');
    if (formNovoProntuario) {
        formNovoProntuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const paciente_nome = document.getElementById('prontuarioPacienteSelect').value;
            const data_sessao = document.getElementById('prontuarioDataInput').value;
            const evolucao_clinica = document.getElementById('prontuarioTextoInput').value;

            try {
                const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);
                const { error } = await conexaoDb.from('prontuarios').insert([{ paciente_nome, data_sessao, evolucao_clinica }]);
                if (error) throw error;

                alert("Evolução clínica registrada com sucesso!");
                formNovoProntuario.reset();
                bootstrap.Modal.getInstance(document.getElementById('modalNovoProntuario'))?.hide();
                buscarProntuarios();
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            }
        });
    }

    // Form de Edição
    const formEditarProntuario = document.getElementById('formEditarProntuario');
    if (formEditarProntuario) {
        formEditarProntuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editarProntuarioId').value;
            const data_sessao = document.getElementById('editarProntuarioData').value;
            const evolucao_clinica = document.getElementById('editarProntuarioTexto').value;

            try {
                const conexaoDb = typeof db !== 'undefined' ? db : (typeof supabase !== 'undefined' ? supabase : null);
                const { error } = await conexaoDb
                    .from('prontuarios')
                    .update({ data_sessao, evolucao_clinica })
                    .eq('id', id);

                if (error) throw error;

                alert("Prontuário atualizado com sucesso!");
                bootstrap.Modal.getInstance(document.getElementById('modalEditarProntuario'))?.hide();
                buscarProntuarios();
            } catch (err) {
                alert("Erro ao atualizar: " + err.message);
            }
        });
    }
});