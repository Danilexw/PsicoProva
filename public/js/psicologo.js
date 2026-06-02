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
    document.getElementById('userName').innerText = `Olá, ${nome}`;

    // Inicializa os modais do Bootstrap
    modalNovaSessao = new bootstrap.Modal(document.getElementById('modalSessao'));
    modalEditarSessao = new bootstrap.Modal(document.getElementById('modalEditarSessao'));

    // Ouvinte do formulário de novos pacientes
    document.getElementById('formNovoPaciente').addEventListener('submit', cadastrarPaciente);

    // 3. Inicializa os dados chamando a função
    inicializarSistema();
});

// >>> COLOQUE A FUNÇÃO EXATAMENTE AQUI <<<
async function inicializarSistema() {
    await carregarPacientesNosSelects(); 
    await listarPacientesNaAba(); 
    await carregarAgenda();
}

// FUNÇÃO: Carregar Agenda
async function carregarAgenda() {
    const tbody = document.getElementById('agendaBody');
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
            // Conversão segura respeitando o fuso horário local do navegador
            const dataObjeto = new Date(item.data_hora);
            const horaFormatada = dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const statusColor = item.status === 'Confirmada' ? 'bg-success' : 'bg-warning';
            
            // Escapar strings para evitar quebra de sintaxe no HTML inline do onclick
            const nomeEscapado = item.paciente_nome.replace(/'/g, "\\'");

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${horaFormatada}</td>
                    <td>${item.paciente_nome}</td>
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
    
    // Converte timestamp do banco para formato local exigido pelo input (YYYY-MM-DDTHH:MM)
    const dataLocal = new Date(dataHoraISO);
    const tzOffset = dataLocal.getTimezoneOffset() * 60000; // Ajuste de fuso horário local
    const dataFormatada = (new Date(dataLocal.getTime() - tzOffset)).toISOString().substring(0, 16);
    
    document.getElementById('editarSessaoData').value = dataFormatada;
    modalEditarSessao.show();
}

// EVENTO: Salvar dados editados
document.getElementById('formEditarSessao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editarSessaoId').value;
    const nome = document.getElementById('editarPacienteNome').value;
    const dataInput = document.getElementById('editarSessaoData').value; 

    // Transforma a data inserida localmente em formato ISO internacional aceito corretamente pelo Supabase
    const dataParaBanco = new Date(dataInput).toISOString();

    try {
        const { error } = await db
            .from('agendamentos')
            .update({ paciente_nome: nome, data_hora: dataParaBanco })
            .eq('id', id);

        if (error) throw error;

        modalEditarSessao.hide();
        carregarAgenda();
    } catch (err) {
        alert("Erro ao salvar alterações: " + err.message);
    }
});

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

// FUNÇÃO: Trocar Abas da Sidebar (SPA)
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

// FUNÇÃO: Abrir Modal de Nova Sessão
function novaSessao() {
    modalNovaSessao.show();
}

// Garanta que o evento mapeie o valor textual do select de forma limpa
document.getElementById('formNovaSessao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectPaciente = document.getElementById('pacienteNome');
    const nome = selectPaciente.value; // Pega o nome selecionado
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

        modalNovaSessao.hide();
        e.target.reset(); 
        carregarAgenda();
    } catch (err) {
        alert("Erro ao salvar agendamento: " + err.message);
    }
});

// FUNÇÃO: Rastreabilidade / Atender (Muda o status para Confirmada e gera o log)
async function atender(idSessao, nomePaciente) {
    alert(`Iniciando atendimento de: ${nomePaciente}`);
    
    try {
        // 1. Atualiza o status do agendamento atual para 'Confirmada'
        const { error: errorStatus } = await db
            .from('agendamentos')
            .update({ status: 'Confirmada' })
            .eq('id', idSessao);

        if (errorStatus) throw errorStatus;

        // 2. Registra a ação nos logs do sistema para auditoria
        const { data: { user } } = await db.auth.getUser();
        await db.from('logs_sistema').insert([{
            usuario_id: user.id,
            acao: `Atendimento iniciado`,
            detalhes: `Paciente: ${nomePaciente} - Status alterado para Confirmada`
        }]);

        // 3. Atualiza a tabela na tela para mostrar o novo badge verde instantaneamente
        carregarAgenda();

    } catch (err) {
        console.error("Erro ao iniciar atendimento:", err);
        alert("Erro ao atualizar o atendimento: " + err.message);
    }
}

async function cadastrarPaciente(e) {
    e.preventDefault();
    
    // Captura os elementos do DOM
    const nomeInput = document.getElementById('novoPacienteNome');
    const emailInput = document.getElementById('novoPacienteEmail');
    const aniversarioInput = document.getElementById('novoPacienteAniversario');
    const idadeInput = document.getElementById('novoPacienteIdade');
    const telefoneInput = document.getElementById('novoPacienteTelefone');

    // Extrai os valores de forma segura
    const nomePaciente = nomeInput ? nomeInput.value.trim() : '';
    const emailInstitucional = emailInput ? emailInput.value.trim() : '';
    const aniversario = aniversarioInput ? aniversarioInput.value : null;
    const idade = idadeInput ? idadeInput.value : null;
    const telefone = telefoneInput ? telefoneInput.value.trim() : '';

    try {
        // Envia para o Supabase mapeando exatamente os nomes das colunas da tabela
        const { error } = await db
            .from('pacientes_clinica')
            .insert([
                { 
                    nome: nomePaciente,
                    email_institucional: emailInstitucional ? emailInstitucional : null,
                    aniversario: aniversario ? aniversario : null, 
                    idade: idade ? parseInt(idade) : null,
                    telefone: telefone ? telefone : null
                }
            ]);

        if (error) throw error;

        alert('Paciente cadastrado com sucesso!');
        
        // Limpa o formulário após o sucesso
        document.getElementById('formNovoPaciente').reset();
        
        // Fecha a aba expansível do Bootstrap
        const collapseEl = document.getElementById('collapseCadastroPaciente');
        const collapseInstance = bootstrap.Collapse.getInstance(collapseEl);
        if (collapseInstance) collapseInstance.hide();
        
        // Força a atualização imediata dos dados na tela
        await carregarPacientesNosSelects();
        await listarPacientesNaAba();

    } catch (err) {
        alert('Erro ao cadastrar paciente: ' + err.message);
        console.error("Erro completo ao inserir:", err);
    }
}

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
        // Tratamento simples para o caso de algum campo antigo estar nulo no banco
        const email = paciente.email_institucional || '-';
        const telefone = paciente.telefone || '-';
        const idade = paciente.idade ? `${paciente.idade} anos` : '-';

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${paciente.nome}</td>
                <td class="text-muted">${email}</td>
                <td>${telefone}</td>
                <td>${idade}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirPaciente('${paciente.id}', '${paciente.nome.replace(/'/g, "\\'")}')">
                        <i class="bi bi-trash"></i> Excluir
                    </button>
                </td>
            </tr>
        `;
    });
}

// CORREÇÃO DA FUNÇÃO: Trocar Abas da Sidebar (SPA)
function trocarAba(nomeAba) {
    // Esconde todas as seções conhecidas
    document.getElementById('aba-agenda').classList.add('d-none');
    document.getElementById('aba-pacientes').classList.add('d-none');
    document.getElementById('aba-conteudo').classList.add('d-none');
    
    // Remove classe ativa de todos os botões da sidebar
    document.querySelectorAll('.nav-link-custom').forEach(link => link.classList.remove('active'));

    // Ativa a aba clicada
    if (nomeAba === 'agenda') {
        document.getElementById('aba-agenda').classList.remove('d-none');
        document.getElementById('btn-agenda').classList.add('active');
        carregarAgenda();
    } else if (nomeAba === 'pacientes') {
        document.getElementById('aba-pacientes').classList.remove('d-none');
        document.getElementById('btn-pacientes').classList.add('active');
        listarPacientesNaAba(); // Alimenta a tabela assim que o usuário entra na aba
    } else {
        const secaoGenerica = document.getElementById('aba-conteudo');
        document.getElementById('tituloAba').innerText = nomeAba.charAt(0).toUpperCase() + nomeAba.slice(1);
        document.getElementById('descricaoAba').innerText = `Módulo de ${nomeAba} em desenvolvimento.`;
        document.getElementById(`btn-${nomeAba}`).classList.add('active');
        secaoGenerica.classList.remove('d-none');
    }
}

// FUNÇÃO CORRIGIDA: Deleta o registro da tabela 'perfis'
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

async function carregarPacientesNosSelects() {
    try {
        // CORREÇÃO: Mudamos de 'id, nome' para '*' para trazer e-mail, telefone e idade também
        const { data, error } = await db
            .from('pacientes_clinica')
            .select('*')
            .order('nome', { ascending: true });

        if (error) {
            console.error("ERRO CRÍTICO DO SUPABASE:", error.message);
            throw error;
        }

        listaPacientesGlobais = data || [];
        console.log("Pacientes carregados com sucesso de pacientes_clinica:", listaPacientesGlobais);

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

// FUNÇÃO CORRIGIDA: Gera o e-mail institucional dinamicamente sem travar o script
function gerarEmailInstitucional(nomeCompleto) {
    const emailInput = document.getElementById('novoPacienteEmail');
    if (!emailInput) return;

    // Remove espaços extras nas pontas e divide o nome por qualquer quantidade de espaços
    const partes = nomeCompleto.trim().toLowerCase().split(/\s+/);
    
    // Se o campo estiver vazio, limpa o input de e-mail e para a execução
    if (partes.length === 0 || partes[0] === "") {
        emailInput.value = "";
        return;
    }

    const primeiroNome = partes[0];

    if (partes.length > 1) {
        // Pega a primeira letra do segundo nome (Ex: "pereira" -> "p")
        const primeiraLetraSobrenome = partes[1].charAt(0);
        emailInput.value = `${primeiroNome}.${primeiraLetraSobrenome}@psico.com`;
    } else {
        // Se o usuário só digitou o primeiro nome por enquanto
        emailInput.value = `${primeiroNome}@psico.com`;
    }
}

// NOVA FUNÇÃO: Calcula a idade automaticamente com base na data de nascimento
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

    idadeInput.value = idade >= 0 ? idade : 0;
}

// ATUALIZAÇÃO DA FUNÇÃO: Salva os novos campos no Supabase
async function cadastrarPaciente(e) {
    e.preventDefault();
    
    const nomePaciente = document.getElementById('novoPacienteNome').value;
    const emailInstitucional = document.getElementById('novoPacienteEmail').value;
    const aniversario = document.getElementById('novoPacienteAniversario').value;
    const idade = document.getElementById('novoPacienteIdade').value;
    const telefone = document.getElementById('novoPacienteTelefone').value;

    try {
        const { error } = await db
            .from('pacientes_clinica')
            .insert([
                { 
                    nome: nomePaciente,
                    email_institucional: emailInstitucional,
                    aniversario: aniversario ? aniversario : null, // Evita enviar string vazia para o campo DATE
                    idade: idade ? parseInt(idade) : null,
                    telefone: telefone
                }
            ]);

        if (error) throw error;

        alert('Paciente cadastrado com sucesso!');
        document.getElementById('formNovoPaciente').reset();
        
        // Fecha o painel collapse do Bootstrap
        const collapseEl = document.getElementById('collapseCadastroPaciente');
        const collapseInstance = bootstrap.Collapse.getInstance(collapseEl);
        if (collapseInstance) collapseInstance.hide();
        
        // Atualiza as tabelas e seletores da tela
        await carregarPacientesNosSelects();
        await listarPacientesNaAba();
    } catch (err) {
        alert('Erro ao cadastrar paciente: ' + err.message);
    }
}