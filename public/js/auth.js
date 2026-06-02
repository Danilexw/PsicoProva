// js/auth.js

async function realizarLogin(email, password) {
    console.log("Tentando login..."); 
    
    // Mudamos de 'supabase.auth' para 'db.auth'
    const { data, error } = await db.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Erro no login: " + error.message);
        return;
    }

    console.log("Usuário autenticado, buscando perfil...");

    // Mudamos de 'supabase.from' para 'db.from'
    const { data: perfil, error: perfilError } = await db
        .from('perfis')
        .select('tipo, nome')
        .eq('id', data.user.id)
        .single();

    if (perfilError || !perfil) {
        console.error("Erro ao buscar perfil:", perfilError);
        alert("Erro: Perfil não encontrado no banco de dados.");
        return;
    }

    localStorage.setItem('user_role', perfil.tipo);
    localStorage.setItem('user_name', perfil.nome);

    if (perfil.tipo === 'psicologo') {
        window.location.href = 'dashboard-psicologo.html';
    } else if (perfil.tipo === 'paciente') {
        window.location.href = 'dashboard-paciente.html';
    }
}

// Adicionar ao final do seu js/auth.js
async function realizarLogout() {
    try {
        await db.auth.signOut();
        localStorage.clear();
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Erro ao sair:", error);
        // Fallback caso a rede falhe
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await realizarLogin(email, password);
    });
}