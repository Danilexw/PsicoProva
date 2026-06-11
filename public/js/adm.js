// Garante o carregamento dos dados do ADM assim que a página abrir
document.addEventListener('DOMContentLoaded', async () => {
    // Define a data atual como padrão no campo de data do modal
    const inputData = document.getElementById('finData');
    if (inputData) inputData.value = new Date().toISOString().split('T')[0];

    // Escuta o envio do formulário de lançamento financeiro
    const formFinanceiro = document.getElementById('formNovoLancamento');
    if (formFinanceiro) {
        formFinanceiro.addEventListener('submit', salvarNovoLancamento);
    }

    // CORREÇÃO: Escutador do formulário de psicólogos centralizado corretamente aqui
    const formPsico = document.getElementById('formNovoPsicologo');
    if (formPsico) {
        formPsico.addEventListener('submit', salvarNovoPsicologo);
    }

    await verificarSessaoAdm();
});

async function verificarSessaoAdm() {
    try {
        // Valida sessão activa usando a instância 'db' do seu auth.js
        const { data: { session }, error: sessionError } = await db.auth.getSession();

        if (sessionError || !session) {
            console.log("Nenhuma sessão ativa encontrada. Redirecionando...");
            window.location.href = 'login.html';
            return;
        }

        const user = session.user;
        
        // Valida o papel (role) do usuário logado na tabela perfis
        const { data: perfil, error: perfilError } = await db
            .from('perfis')
            .select('nome, tipo')
            .eq('id', user.id)
            .single();

        // Aceita 'psicologo' ou o seu check 'admin' do banco
        if (perfilError || !perfil || (perfil.tipo !== 'psicologo' && perfil.tipo !== 'admin')) {
            console.error("Acesso negado. Perfil não autorizado.");
            window.location.href = 'login.html';
            return;
        }

        // Preenche o ID 'admNome' do seu HTML
        const campoNome = document.getElementById('admNome');
        if (campoNome) campoNome.textContent = `Dr(a). ${perfil.nome}`;

        // Carrega o painel financeiro completo
        await carregarPainelFinanceiro();

    } catch (err) {
        console.error("Erro no controle de acesso do ADM:", err);
        window.location.href = 'login.html';
    }
}

// Carrega os cards, tabelas e gera o gráfico com os dados reais do banco
async function carregarPainelFinanceiro() {
    try {
        const { data: movimentacoes, error } = await db
            .from('financeiro')
            .select('*')
            .order('data_competencia', { ascending: false });

        if (error) throw error;

        let totalReceitas = 0;
        let totalDespesas = 0;

        const tabelaBody = document.getElementById('financeiroTableBody');
        if (tabelaBody) tabelaBody.innerHTML = '';

        if (movimentacoes.length === 0) {
            if (tabelaBody) tabelaBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum lançamento financeiro registrado.</td></tr>`;
        } else {
            movimentacoes.forEach(mov => {
                const valorNumerico = parseFloat(mov.valor);
                if (mov.tipo === 'Receita') totalReceitas += valorNumerico;
                if (mov.tipo === 'Despesa') totalDespesas += valorNumerico;

                // Formata data e valores para a moeda local
                const dataF = new Date(mov.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR');
                const valorF = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const badgeTipo = mov.tipo === 'Receita' 
                    ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-arrow-up-short"></i> Receita</span>'
                    : '<span class="badge bg-danger-subtle text-danger"><i class="bi bi-arrow-down-short"></i> Despesa</span>';

                if (tabelaBody) {
                    tabelaBody.innerHTML += `
                        <tr>
                            <td>${dataF}</td>
                            <td class="fw-semibold text-dark">${mov.descricao}</td>
                            <td>${badgeTipo}</td>
                            <td class="${mov.tipo === 'Receita' ? 'text-success' : 'text-danger'} fw-bold">${valorF}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-link text-danger p-0 h4 m-0" onclick="deletarLancamento('${mov.id}', '${mov.descricao}')" title="Excluir Transação">
                                    <i class="bi bi-trash3-fill"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });
        }

        // Calcula o saldo líquido final
        const saldoLiquido = totalReceitas - totalDespesas;

        // Atualiza os elementos de texto da Dashboard
        document.getElementById('finReceitas').textContent = totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('finDespesas').textContent = totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const campoSaldo = document.getElementById('finSaldo');
        campoSaldo.textContent = saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Muda a cor do Card de saldo dinamicamente caso o balanço esteja negativo
        const cardSaldo = document.getElementById('cardSaldoContainer');
        if (cardSaldo) {
            if (saldoLiquido < 0) {
                cardSaldo.className = "card border-0 shadow-sm p-4 bg-white border-start border-danger border-4";
                campoSaldo.className = "fw-bold m-0 mt-1 text-danger";
            } else {
                cardSaldo.className = "card border-0 shadow-sm p-4 bg-white border-start border-primary border-4";
                campoSaldo.className = "fw-bold m-0 mt-1 text-primary";
            }
        }

        // Renderiza o gráfico de balanço patrimonial proporcional
        desenharGraficoProporcional(totalReceitas, totalDespesas);

    } catch (err) {
        console.error("Erro ao processar balanço financeiro:", err.message);
    }
}

// Salva uma transação capturada do formulário do Modal
async function salvarNovoLancamento(e) {
    e.preventDefault();

    const descricao = document.getElementById('finDescricao').value;
    const tipo = document.getElementById('finTipo').value;
    const valor = parseFloat(document.getElementById('finValor').value);
    const data = document.getElementById('finData').value;

    try {
        const { error } = await db
            .from('financeiro')
            .insert([{
                descricao: descricao,
                tipo: tipo,
                valor: valor,
                data_competencia: data
            }]);

        if (error) throw error;

        // Fecha o modal do bootstrap de forma limpa
        const modalElement = document.getElementById('modalNovoLancamento');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();

        // Reseta o formulário e atualiza a tela
        document.getElementById('formNovoLancamento').reset();
        await carregarPainelFinanceiro();

        // Registra rastro na tabela de logs para manter conformidade
        await db.from('logs_sistema').insert([{
            acao: `Registrou nova ${tipo}: ${descricao} no valor de R$ ${valor.toFixed(2)}`,
            tabela_afetada: 'financeiro'
        }]);

    } catch (err) {
        alert("Erro ao salvar lançamento financeiro: " + err.message);
    }
}

// Deleta um lançamento selecionado
async function deletarLancamento(id, descricao) {
    if (!confirm(`Deseja realmente remover o lançamento: "${descricao}"?`)) return;

    try {
        const { error } = await db.from('financeiro').delete().eq('id', id);
        if (error) throw error;

        await carregarPainelFinanceiro();
    } catch (err) {
        alert("Erro ao deletar item: " + err.message);
    }
}

// Injeta dinamicamente a biblioteca Chart.js para desenhar o gráfico proporcional solicitado no seu HTML
function desenharGraficoProporcional(receitas, despesas) {
    const canvas = document.getElementById('graficoFinancas');
    if (!canvas) return;

    // Se a biblioteca ainda não foi injetada na página, adiciona via CDN no cabeçalho de forma limpa
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => inicializarGrafico(canvas, receitas, despesas);
        document.head.appendChild(script);
    } else {
        inicializarGrafico(canvas, receitas, despesas);
    }
}

let instanciaGrafico = null;
function inicializarGrafico(canvas, receitas, despesas) {
    // Destrói gráfico anterior se houver para evitar bugs de sobreposição visual
    if (instanciaGrafico) instanciaGrafico.destroy();

    // Se não houver dados, exibe gráfico neutro equilibrado
    const total = receitas + despesas;
    const dReceitas = total === 0 ? 50 : receitas;
    const dDespesas = total === 0 ? 50 : despesas;

    instanciaGrafico = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Receitas', 'Despesas'],
            datasets: [{
                data: [dReceitas, dDespesas],
                backgroundColor: ['#198754', '#dc3545'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Função para alternar as abas do painel admin de forma fluida
function mudarAba(aba) {
    const secFin = document.getElementById('secaoFinanceiro');
    const secPsi = document.getElementById('secaoPsicologos');
    const btnFin = document.getElementById('btnAbaFinanceiro');
    const btnPsi = document.getElementById('btnAbaPsicologos');
    const btnTopFin = document.getElementById('btnNovoLancamentoTop');
    const btnTopPsi = document.getElementById('btnNovoPsicoTop');

    if (aba === 'financeiro') {
        if(secFin) secFin.classList.remove('d-none');
        if(secPsi) secPsi.classList.add('d-none');
        if(btnFin) btnFin.classList.add('active');
        if(btnPsi) btnPsi.classList.remove('active');
        if(btnTopFin) btnTopFin.classList.remove('d-none');
        if(btnTopPsi) btnTopPsi.classList.add('d-none');
    } else {
        if(secFin) secFin.classList.add('d-none');
        if(secPsi) secPsi.classList.remove('d-none');
        if(btnFin) btnFin.classList.remove('active');
        if(btnPsi) btnPsi.classList.add('active');
        if(btnTopFin) btnTopFin.classList.add('d-none');
        if(btnTopPsi) btnTopPsi.classList.remove('d-none');
        carregarListaPsicologos(); // Carrega os dados sempre que abrir a aba
    }
}

// Carrega os psicólogos pré-cadastrados na tabela
async function carregarListaPsicologos() {
    try {
        const { data: psicologos, error } = await db
            .from('pre_cadastro_psicologos')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;

        const tbody = document.getElementById('psicologosTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (psicologos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum psicólogo cadastrado ainda.</td></tr>`;
            return;
        }

        psicologos.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td class="fw-semibold text-dark">${p.nome}</td>
                    <td>${p.email}</td>
                    <td><span class="badge bg-secondary-subtle text-secondary">${p.crp}</span></td>
                    <td><code>${p.senha_provisoria}</code></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-link text-danger p-0" onclick="deletarPreCadastro('${p.id}', '${p.nome}')">
                            <i class="bi bi-trash3-fill h5"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Erro ao listar profissionais:", err.message);
    }
}

async function salvarNovoPsicologo(e) {
    e.preventDefault();

    // Captura os elementos do DOM com segurança
    const inputNome = document.getElementById('psiNome');
    const inputEmail = document.getElementById('psiEmail');
    const inputCRP = document.getElementById('psiCRP');
    const inputSenha = document.getElementById('psiSenha');

    if (!inputNome || !inputEmail || !inputCRP || !inputSenha) {
        alert("Erro técnico: Alguns campos do formulário não foram encontrados no HTML.");
        return;
    }

    const nome = inputNome.value;
    const email = inputEmail.value;
    const crp = inputCRP.value;
    const senha = inputSenha.value;

    try {
        console.log("Iniciando fluxo de automação de cadastro para:", email);

        // 1. Cria a credencial de login oficial no módulo de Autenticação do Supabase
        const { data: authData, error: authError } = await db.auth.signUp({
            email: email,
            password: senha
        });

        if (authError) throw authError;
        if (!authData?.user) throw new Error("Não foi possível gerar as credenciais de autenticação.");

        const novoUsuarioId = authData.user.id;
        const nomeFormatado = nome.toLowerCase().startsWith('dr') ? nome : `Dr(a). ${nome}`;

        // 2. Executa as inserções nas tabelas do banco em paralelo
        const [resPerfil, resPreCadastro] = await Promise.all([
            db.from('perfis').insert([{ 
                id: novoUsuarioId, 
                nome: nomeFormatado, 
                tipo: 'psicologo' 
            }]),

            db.from('pre_cadastro_psicologos').insert([{ 
                nome: nomeFormatado, 
                email: email, 
                crp: crp, 
                senha_provisoria: senha 
            }])
        ]);

        if (resPerfil.error) throw resPerfil.error;
        if (resPreCadastro.error) throw resPreCadastro.error;

        // 3. Fecha o modal do bootstrap localizando o elemento com segurança
        const modalEl = document.getElementById('modalNovoPsicologo');
        if (modalEl) {
            const modalInst = bootstrap.Modal.getInstance(modalEl);
            if (modalInst) modalInst.hide();
        }

        // Limpeza manual campo a campo para mitigar o bug de referências nulas do formulário
        inputNome.value = '';
        inputEmail.value = '';
        inputCRP.value = '';
        inputSenha.value = '';

        const formularioHtml = document.getElementById('formNovoPsicologo');
        if (formularioHtml) {
            formularioHtml.reset();
        }
        
        // Atualiza a tabela da tela em tempo real
        await carregarListaPsicologos();
        
        alert(`Sucesso total!\nO psicólogo ${nomeFormatado} foi cadastrado com sucesso.`);

    } catch (err) {
        console.error("Erro no fluxo automatizado de cadastro:", err);
        alert("Erro ao salvar cadastro automatizado: " + err.message);
    }
}

// Deleta o registro temporário
async function deletarPreCadastro(id, nome) {
    if (!confirm(`Remover o cadastro de ${nome}?`)) return;
    try {
        const { error } = await db.from('pre_cadastro_psicologos').delete().eq('id', id);
        if (error) throw error;
        await carregarListaPsicologos();
    } catch (err) {
        alert("Erro ao remover: " + err.message);
    }
}

// Expõe as funções globalmente para chamadas diretas via HTML (onclick)
window.mudarAba = mudarAba;
window.deletarPreCadastro = deletarPreCadastro;
window.deletarLancamento = deletarLancamento;

window.fazerLogout = async function() {
    await db.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
};