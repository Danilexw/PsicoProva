// js/psicologo.js

let modalNovaSessao = null;
let modalEditarSessao = null;
let listaPacientesGlobais = []; // Guarda a lista de pacientes temporariamente para agilizar consultas
let cacheAgenda = [];          // CACHE GLOBAL: Guarda todos os agendamentos brutos do banco

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

    // [NOVO] Ouvintes para os elementos de filtro na UI (Ajuste os IDs se forem diferentes no seu HTML)
    const filtroData = document.getElementById('filtroData');
    const filtroPaciente = document.getElementById('filtroPaciente');
    
    if (filtroData) filtroData.addEventListener('input', renderizarAgendaFiltrada);
    if (filtroPaciente) filtroPaciente.addEventListener('input', renderizarAgendaFiltrada);

    // 3. Inicializa os dados chamando a função
    inicializarSistema();
});

// FUNÇÃO: Inicializar Sistema
async function inicializarSistema() {
    await carregarPacientesNosSelects(); 
    await listarPacientesNaAba(); 
    await carregarAgenda();
}

// FUNÇÃO ALTERADA: Carrega a agenda do banco para o cache global e chama a renderização
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

        // Guarda os dados brutos no cache global
        cacheAgenda = data || [];

        // Renderiza aplicando os filtros atuais da tela em tempo real
        renderizarAgendaFiltrada();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar dados do banco.</td></tr>';
    }
}

// NOVA FUNÇÃO: Realiza as filtragens síncronas combinadas em tempo real e desenha o HTML
// NOVA VERSÃO CORRIGIDA DA FUNÇÃO DE RENDERIZAÇÃO DA AGENDA
function renderizarAgendaFiltrada() {
    const tbody = document.getElementById('agendaBody');
    if (!tbody) return;

    // Captura os valores dos inputs de filtro da sua UI
    const filtroDataVal = document.getElementById('filtroData')?.value; // Formato YYYY-MM-DD
    const filtroPacienteVal = document.getElementById('filtroPaciente')?.value.toLowerCase().trim() || '';

    // 1. Filtragem dos dados salvos no cache global
    let dadosFiltrados = cacheAgenda.filter(item => {
        if (!item.data_hora) return false;

        // Filtro 1: Por Data (Garante tratamento limpo da string ISO do banco)
        if (filtroDataVal) {
            const dataIsoAgendamento = item.data_hora.substring(0, 10);
            if (dataIsoAgendamento !== filtroDataVal) return false;
        }

        // Filtro 2: Por Nome do Paciente (Parcial / Case-Insensitive)
        if (filtroPacienteVal) {
            const nomePaciente = (item.paciente_nome || '').toLowerCase();
            if (!nomePaciente.includes(filtroPacienteVal)) return false;
        }

        return true;
    });

    // [CORREÇÃO INTELIGENTE]: Se o filtro por data estiver ativo para o dia atual mas não houver sessões hoje,
    // o sistema limpa o filtro visual e exibe a lista completa para evitar a sensação de "agenda sumida".
    if (dadosFiltrados.length === 0 && filtroDataVal && !filtroPacienteVal) {
        const hojeIso = new Date().toISOString().substring(0, 10);
        if (filtroDataVal === hojeIso) {
            console.warn("Nenhuma sessão hoje. Mostrando cronograma completo de agendamentos.");
            document.getElementById('filtroData').value = ""; // Limpa o input visualmente
            dadosFiltrados = cacheAgenda; // Restaura a lista completa
        }
    }

    // Limpa o corpo da tabela antes de desenhar
    tbody.innerHTML = '';

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Nenhum agendamento encontrado para os filtros aplicados.</td></tr>';
        return;
    }

    // 2. Renderização das linhas filtradas na tabela
    dadosFiltrados.forEach(item => {
        const dataObjeto = new Date(item.data_hora);
        
        // Exibe a data completa (Dia/Mês + Hora) se nenhum filtro específico de dia estiver selecionado
        const formatoOpcoes = filtroDataVal 
            ? { hour: '2-digit', minute: '2-digit' } 
            : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
            
        const horaFormatada = dataObjeto.toLocaleTimeString('pt-BR', formatoOpcoes);

        // Define a cor do badge com base no status do banco
        const statusColor = item.status === 'Confirmada' ? 'bg-success' : 'bg-warning';
        const nomeEscapado = item.paciente_nome ? item.paciente_nome.replace(/'/g, "\\'") : 'Paciente Sem Nome';

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold align-middle">${horaFormatada}</td>
                <td class="align-middle">${item.paciente_nome || '-'}</td>
                <td class="align-middle">
                    <span class="badge ${statusColor}" style="cursor: pointer; user-select: none;" onclick="alternarStatus('${item.id}', '${item.status}')" title="Clique para alterar o status">
                        ${item.status}
                    </span>
                </td>
                <td class="align-middle">
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
    document.getElementById('aba-agenda')?.classList.add('d-none');
    document.getElementById('aba-pacientes')?.classList.add('d-none');
    document.getElementById('aba-financeiro')?.classList.add('d-none');
    document.getElementById('aba-prontuarios')?.classList.add('d-none'); 

    document.getElementById('btn-agenda')?.classList.remove('active');
    document.getElementById('btn-pacientes')?.classList.remove('active');
    document.getElementById('btn-financeiro')?.classList.remove('active');
    document.getElementById('btn-prontuarios')?.classList.remove('active');

    const abaAlvo = document.getElementById(`aba-${aba}`);
    const btnAlvo = document.getElementById(`btn-${aba}`);

    if (abaAlvo && btnAlvo) {
        abaAlvo.classList.remove('d-none');
        btnAlvo.classList.add('active');
    }

    if (aba === 'prontuarios') {
        buscarProntuarios(); 
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

        // Atualiza a lista de pacientes globais
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
// MÓDULO DE PRONTUÁRIOS E EVOLUÇÃO CLÍNICA
// ==========================================================
let cacheProntuarios = [];
let emCarregamentoProntuarios = false;

async function buscarProntuarios() {
    if (emCarregamentoProntuarios) return;
    
    try {
        const tbody = document.getElementById('prontuariosTableBody');
        if (!tbody) return;

        emCarregamentoProntuarios = true;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Buscando prontuários...</td></tr>';

        const { data: prontuarios, error } = await db
            .from('prontuarios')
            .select('*')
            .order('data_sessao', { ascending: false });

        if (error) throw error;
        cacheProntuarios = prontuarios || [];

        tbody.innerHTML = '';

        if (cacheProntuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum prontuário registrado.</td></tr>';
            return;
        }

        cacheProntuarios.forEach((item, index) => {
            const dataObjeto = new Date(item.data_sessao);
            const dataFormatada = dataObjeto.toLocaleDateString('pt-BR') + ' às ' + dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-dark">${item.paciente_nome}</td>
                    <td class="text-muted">${dataFormatada}</td>
                    <td>
                        <div class="text-truncate" style="max-width: 320px;">
                            ${item.evolucao_clinica || 'Sem evolução registrada.'}
                        </div>
                    </td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary px-2" onclick="verProntuarioDetalhado(${index})" title="Ver Ficha">
                                <i class="bi bi-eye"></i> Ver Ficha
                            </button>
                            <button class="btn btn-sm btn-outline-warning px-2" onclick="abrirModalEditarProntuario(${index})" title="Editar Evolução">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger px-2" onclick="excluirProntuarioDoBanco('${item.id}')" title="Excluir">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Erro ao buscar prontuários:", err);
        const tbody = document.getElementById('prontuariosTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro: ${err.message}</td></tr>`;
    } finally {
        emCarregamentoProntuarios = false;
    }
}

function abrirModalEditarProntuario(index) {
    const p = cacheProntuarios[index];
    if (!p) return;

    document.getElementById('editarProntuarioId').value = p.id;
    document.getElementById('editarProntuarioPaciente').value = p.paciente_nome;
    
    if (p.data_sessao) {
        const dataFormatadaParaInput = p.data_sessao.substring(0, 16);
        document.getElementById('editarProntuarioData').value = dataFormatadaParaInput;
    } else {
        document.getElementById('editarProntuarioData').value = '';
    }

    document.getElementById('editarProntuarioTexto').value = p.evolucao_clinica || '';

    const modal = new bootstrap.Modal(document.getElementById('modalEditarProntuario'));
    modal.show();
}

function verProntuarioDetalhado(index) {
    const p = cacheProntuarios[index];
    if (!p) return;

    const dataObjeto = new Date(p.data_sessao);
    const dataFormatada = dataObjeto.toLocaleDateString('pt-BR') + ' ' + dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

async function excluirProntuarioDoBanco(id) {
    if (!confirm("Remover este prontuário permanentemente?")) return;
    try {
        const { error } = await db.from('prontuarios').delete().eq('id', id);
        if (error) throw error;
        alert("Removido com sucesso.");
        buscarProntuarios();
    } catch (err) {
        alert(err.message);
    }
}

async function prepararSelectPacientesProntuario() {
    try {
        const selectProntuario = document.getElementById('prontuarioPacienteSelect');
        if (!selectProntuario) return;

        if (!listaPacientesGlobais || listaPacientesGlobais.length === 0) {
            const { data, error } = await db
                .from('pacientes_clinica')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;
            listaPacientesGlobais = data || [];
        }

        let optionsHTML = '<option value="" disabled selected>Selecione o paciente...</option>';
        listaPacientesGlobais.forEach(paciente => {
            optionsHTML += `<option value="${paciente.nome}" data-id="${paciente.id}">${paciente.nome}</option>`;
        });

        selectProntuario.innerHTML = optionsHTML;
    } catch (err) {
        console.error("Erro ao preparar o select de pacientes para o prontuário:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modalNovoProntuarioEl = document.getElementById('modalNovoProntuario');
    if (modalNovoProntuarioEl) {
        modalNovoProntuarioEl.addEventListener('show.bs.modal', () => {
            prepararSelectPacientesProntuario();
        });
    }
});

function autopreencherDadosDoPaciente(nomeSelecionado) {
    if (!nomeSelecionado) return;

    const pacienteEncontrado = listaPacientesGlobais.find(p => p.nome === nomeSelecionado);

    if (pacienteEncontrado) {
        const inputTelefone = document.getElementById('prontuarioTelefone');
        if (inputTelefone) inputTelefone.value = pacienteEncontrado.telefone || '';

        const inputEmail = document.getElementById('prontuarioEmail');
        if (inputEmail) inputEmail.value = pacienteEncontrado.email_institucional || '';

        const inputData = document.getElementById('prontuarioDataInput');
        if (inputData && !inputData.value) {
            const agora = new Date();
            const tzOffset = agora.getTimezoneOffset() * 60000;
            inputData.value = (new Date(agora.getTime() - tzOffset)).toISOString().substring(0, 16);
        }
    }
}

// Gerenciamento dos Envios de Formulários (Inserção e Edição de Prontuários)
document.addEventListener('DOMContentLoaded', () => {
    const formNovoProntuario = document.getElementById('formNovoProntuario');
    if (formNovoProntuario) {
        formNovoProntuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSalvar = formNovoProntuario.querySelector('button[type="submit"]');
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.textContent = "Salvando...";
            }

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
                const { error } = await db.from('prontuarios').insert([payload]);
                if (error) throw error;

                alert("Prontuário gravado com sucesso!");
                formNovoProntuario.reset();
                bootstrap.Modal.getInstance(document.getElementById('modalNovoProntuario'))?.hide();
                buscarProntuarios();
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            } finally {
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.textContent = "Salvar Prontuário";
                }
            }
        });
    }

    const formEditarProntuario = document.getElementById('formEditarProntuario');
    if (formEditarProntuario) {
        formEditarProntuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editarProntuarioId').value;
            const data_sessao = document.getElementById('editarProntuarioData').value;
            const evolucao_clinica = document.getElementById('editarProntuarioTexto').value;

            try {
                const { error } = await db
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