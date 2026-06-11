// js/auth.js

/**
 * FUNÇÃO: Realiza a autenticação do usuário no Supabase e redireciona de acordo com o perfil
 */
async function realizarLogin(email, password) {
    console.log("Tentando login..."); 
    
    try {
        // 1. Autentica o usuário utilizando o e-mail e senha informados
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        console.log("Usuário autenticado no Auth, buscando dados do perfil...");

        // 2. Busca o tipo de usuário e o nome na tabela 'perfis' para saber para onde redirecionar
        const { data: perfil, error: perfilError } = await db
            .from('perfis')
            .select('tipo, nome')
            .eq('id', data.user.id)
            .single();

        if (perfilError || !perfil) {
            console.error("Erro ao buscar perfil:", perfilError);
            throw new Error("Perfil de usuário não localizado no banco de dados.");
        }

        // 3. Salva os dados de controle da sessão no navegador do usuário
        localStorage.setItem('user_role', perfil.tipo);
        localStorage.setItem('user_name', perfil.nome);

        // 4. Redirecionamento baseado no tipo de perfil cadastrado no Supabase
        console.log(`Perfil identificado: ${perfil.tipo}`);
        
        if (perfil.tipo === 'admin') {
    window.location.href = 'dashboard-adm.html'; // Só o Admin vê o financeiro global
} else if (perfil.tipo === 'psicologo') {
    window.location.href = 'dashboard-psicologo.html'; // Psicólogo vai para prontuários/agenda
} else if (perfil.tipo === 'paciente') {
    window.location.href = 'dashboard-paciente.html';
} else {
            throw new Error("Tipo de usuário inválido ou não identificado.");
        }

    } catch (err) {
        alert("Erro no login: " + err.message);
        console.error("Falha no processo de login:", err);
    }
}

/**
 * FUNÇÃO: Encerra a sessão ativa do usuário e limpa o armazenamento local
 */
async function realizarLogout() {
    try {
        await db.auth.signOut();
    } catch (error) {
        console.error("Erro ao desconectar do servidor:", error);
    } finally {
        // Garante que os dados locais sejam limpos mesmo se a rede falhar
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Ouvinte do formulário de Login (Verifica se o formulário existe na página atual antes de rodar)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        await realizarLogin(email, password);
    });
}

// Expõe as funções globalmente caso precise chamá-las via onclick nos botões
window.realizarLogin = realizarLogin;
window.realizarLogout = realizarLogout;