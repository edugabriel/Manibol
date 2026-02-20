/* === 1. CONFIGURAÇÃO E ESTADO === */
// --- Variáveis de Estado (Memória do App) ---
window.currentMatches = []; 
window.favorites = JSON.parse(localStorage.getItem('manibol_favs')) || []; 
window.selectedMatchId = null; 
window.selectedLeague = ""; 
window.activeStrategy = null; 
window.lastDataSnapshot = {}; 
window.activeTab = 'live';
window.pressureHistory = {}; 
window.statusFilter = 'live'; // 'live' ou 'upcoming'

// --- Objetos de Áudio ---
const alertSounds = {
    goal: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
    redCard: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3')
};

// --- Funções de Controle de Estado ---
window.setStatusFilter = function(status) {
    window.statusFilter = status;
    
    // Captura os botões no HTML
    const btnLive = document.getElementById('btn-live');
    const btnUpcoming = document.getElementById('btn-upcoming');
    
    // Se os botões existirem, troca as classes CSS para dar o efeito visual de "selecionado"
    if (btnLive && btnUpcoming) {
        if (status === 'live') {
            btnLive.className = "flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all bg-cyan-500 text-slate-900";
            btnUpcoming.className = "flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all text-slate-500 hover:text-white";
        } else {
            btnUpcoming.className = "flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all bg-cyan-500 text-slate-900";
            btnLive.className = "flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all text-slate-500 hover:text-white";
        }
    }
    
    // Força o dashboard a se atualizar para filtrar a lista de jogos imediatamente
    if (typeof window.updateDashboard === 'function') {
        window.updateDashboard();
    }
};

/* === 2. MOTOR DE ATUALIZAÇÃO E ALERTAS === */
window.updateDashboard = async function() {
    try {
        const api = window.FootballAPI || window.MockAPI;
        if (!api) return;

        // 1. CLONAGEM INDEPENDENTE
        const matchesAntigos = window.currentMatches.map(m => ({ ...m }));

        // 2. Buscamos os dados novos da API
        const data = await api.fetchMatches();
        const matchesNovos = api.mapApiFootballData(data);
        
        // 3. COMPARAÇÃO (Alertas de gol/cartão)
        if (matchesAntigos.length > 0) {
            checkForAlerts(matchesNovos, matchesAntigos);
        }
        
        // 4. ATUALIZAÇÃO DA MEMÓRIA
        window.currentMatches = matchesNovos;
        
        // 5. RENDERIZAÇÃO VISUAL (COM OS FILTROS)
        let filtered = matchesNovos;

        // --- INSERÇÃO DO FILTRO DE STATUS (LIVE vs PRÓXIMOS) ---
        filtered = filtered.filter(m => {
            const isLive = m.time > 0;
            return window.statusFilter === 'live' ? isLive : !isLive;
        });
        // ------------------------------------------------------

        if (window.selectedLeague) filtered = filtered.filter(m => m.league === window.selectedLeague);
        if (window.activeStrategy) filtered = filtered.filter(m => window.checkStrategy(m, window.activeStrategy));
        
        renderLeagues(matchesNovos);
        renderFeed(filtered);
        renderFavorites();
        renderAnalysis(); 
        
    } catch (e) { 
        console.error("Erro no motor de atualização:", e); 
    }
};

function checkForAlerts(newMatches, oldMatches) {
    newMatches.forEach(match => {
        const oldMatch = oldMatches.find(m => m.id == match.id);
        
        if (oldMatch) {
            // 1. LÓGICA DE GOL
            const novoPlacar = Number(match.scoreHome) + Number(match.scoreAway);
            const antigoPlacar = Number(oldMatch.scoreHome) + Number(oldMatch.scoreAway);

            if (novoPlacar > antigoPlacar) {
                if (alertSounds.goal) alertSounds.goal.play().catch(e => console.log("Som bloqueado"));
                showNotification(`⚽ GOL! ${match.home} ${match.scoreHome} - ${match.scoreAway} ${match.away}`, "cyan");
            }

            // 2. LÓGICA DE CARTÃO VERMELHO
            const novoRed = Number(match.redCardsHome) + Number(match.redCardsAway);
            const antigoRed = Number(oldMatch.redCardsHome) + Number(oldMatch.redCardsAway);

            if (novoRed > antigoRed) {
                if (alertSounds.redCard) alertSounds.redCard.play().catch(e => console.log("Som bloqueado"));
                showNotification(`🟥 CARTÃO VERMELHO! Expulsão em ${match.home} x ${match.away}`, "red");
                console.log("%c 🟥 CARTÃO VERMELHO DETECTADO!", "color: #ef4444; font-weight: bold;");
            }
        }
    });
}

function showNotification(text, type = "cyan") {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const n = document.createElement('div');
    // Define a cor baseada no tipo
    const bgColor = type === "red" ? "bg-red-600" : "bg-cyan-600";
    
    n.className = `${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-500 translate-y-10 opacity-0 font-bold border border-white/20`;
    n.innerHTML = `<i class="fas ${type === "red" ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> <span>${text}</span>`;
    
    container.appendChild(n);
    setTimeout(() => { n.classList.remove('translate-y-10', 'opacity-0'); }, 100);
    setTimeout(() => {
        n.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => n.remove(), 500);
    }, 5000);
}

/* === 3. RENDERIZAÇÃO LATERAIS E FEED === */
function renderLeagues(matches) {
    const list = document.getElementById('leagues-list');
    if (!list) return;
    const leagues = [...new Set(matches.map(m => m.league))].sort();
    
    let html = `<div onclick="filterLeague('')" class="p-4 hover:bg-slate-800 cursor-pointer border-l-4 ${window.selectedLeague === '' ? 'border-cyan-500 bg-slate-800 text-white' : 'border-transparent text-slate-400'} transition-all">
        <span class="text-[10px] font-black uppercase tracking-widest">Todas as Ligas</span>
    </div>`;
    
    leagues.forEach(l => {
        html += `<div onclick="filterLeague('${l}')" class="p-4 hover:bg-slate-800 cursor-pointer border-l-4 ${window.selectedLeague === l ? 'border-cyan-500 bg-slate-800 text-white' : 'border-transparent text-slate-400'} transition-all">
            <span class="text-[10px] font-bold uppercase">${l}</span>
        </div>`;
    });
    list.innerHTML = html;
}

function renderFeed(matches) {
    const feed = document.getElementById('match-feed');
    if (!feed) return;
    
    feed.innerHTML = matches.map(m => {
        const isHT = m.time === "HT" || m.time === 45;
        const isFav = window.favorites.includes(m.id.toString());
        const homeHighPressure = m.apHome > 90;
        const awayHighPressure = m.apAway > 90;

        return `
        <div onclick="selectMatch('${m.id}')" class="bg-slate-900/50 border ${window.selectedMatchId == m.id ? 'border-cyan-500/50 bg-slate-900' : 'border-white/5'} p-3 rounded-lg cursor-pointer hover:bg-slate-900 transition-all group mb-1 relative overflow-hidden">
            
            ${(homeHighPressure || awayHighPressure) ? '<div class="absolute top-0 left-0 w-full h-0.5 bg-orange-500 animate-pulse"></div>' : ''}

            <div class="flex justify-between items-center mb-2">
                <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">${m.league}</span>
                <span class="text-[9px] font-mono ${isHT ? 'text-amber-500 animate-pulse font-black' : 'text-cyan-500'}">
                    ${isHT ? 'INTERVALO (HT)' : m.time + "'"}
                </span>
            </div>

            <div class="flex items-center justify-between">
                <div class="space-y-1.5 flex-1">
                    <div class="flex justify-between items-center pr-4">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold transition-colors ${homeHighPressure ? 'text-orange-500 animate-pulse' : m.apHome > 70 ? 'text-cyan-400' : 'text-slate-200'}">
                                ${m.home} ${homeHighPressure ? '🔥' : ''}
                            </span>
                            ${m.redCardsHome > 0 ? `
    <div class="relative flex items-center justify-center w-4 h-5 bg-red-600 rounded-[2px] shadow-lg rotate-[12deg] animate-pulse ml-2 border border-red-400">
        <span class="text-[9px] font-black text-white rotate-[-12deg]">${m.redCardsHome}</span>
        <div class="absolute inset-0 bg-white opacity-20 animate-ping rounded-[2px]"></div>
    </div>
` : ''}
                        </div>
                        <span class="text-[11px] font-black text-white font-mono">${m.scoreHome}</span>
                    </div>
                    
                    <div class="flex justify-between items-center pr-4">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold transition-colors ${awayHighPressure ? 'text-orange-500 animate-pulse' : m.apAway > 70 ? 'text-cyan-400' : 'text-slate-200'}">
                                ${m.away} ${awayHighPressure ? '🔥' : ''}
                            </span>
                            ${m.redCardsAway > 0 ? `
    <div class="relative flex items-center justify-center w-4 h-5 bg-red-600 rounded-[2px] shadow-lg rotate-[12deg] animate-pulse ml-2 border border-red-400">
        <span class="text-[9px] font-black text-white rotate-[-12deg]">${m.redCardsAway}</span>
        <div class="absolute inset-0 bg-white opacity-20 animate-ping rounded-[2px]"></div>
    </div>
` : ''}
                        </div>
                        <span class="text-[11px] font-black text-white font-mono">${m.scoreAway}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2 pl-3 border-l border-white/5">
                    <button onclick="event.stopPropagation(); toggleFavorite('${m.id}')" class="text-slate-600 hover:text-amber-500 transition-colors p-1">
                        <i class="${isFav ? 'fas fa-star text-amber-500' : 'far fa-star'}"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderFavorites() {
    const list = document.getElementById('favorites-list');
    if (!list) return;
    const favMatches = window.currentMatches.filter(m => window.favorites.includes(m.id.toString()));
    
    if (favMatches.length === 0) {
        list.innerHTML = `<div class="p-4 text-center opacity-20 text-[8px] font-black uppercase tracking-widest">Nenhum favorito</div>`;
        return;
    }

    list.innerHTML = favMatches.map(m => `
        <div onclick="selectMatch('${m.id}')" class="p-2 mb-1 bg-slate-900/30 border border-white/5 rounded flex justify-between items-center cursor-pointer hover:bg-slate-800">
            <span class="text-[9px] font-bold truncate pr-2">${m.home}</span>
            <span class="text-[9px] font-black text-cyan-500">${m.scoreHome}-${m.scoreAway}</span>
        </div>
    `).join('');
}

/* === 4. ANÁLISE E ABAS === */
function renderAnalysis() {
    const container = document.getElementById('quick-analysis');
    if (!container) return;
    if (!window.selectedMatchId) {
        container.innerHTML = `<div class="h-full flex items-center justify-center opacity-20 flex-col gap-4 text-center">
            <i class="fas fa-chart-line text-6xl"></i>
            <p class="text-[10px] font-bold uppercase tracking-[0.2em]">Selecione um jogo</p>
        </div>`;
        return;
    }

    const m = window.currentMatches.find(x => x.id == window.selectedMatchId);
    if (!m) return;

    // --- 1. VERIFICAÇÃO DE STATUS ---
    const isLive = m.time > 0;
    
    // Se o jogo NÃO começou e o usuário está na aba 'live', força a troca para 'h2h'
    if (!isLive && window.activeTab === 'live') {
        window.activeTab = 'h2h';
    }

    // --- NOVA LÓGICA DO BOT DE INSIGHTS ---
    const isLateGame = m.time > 75;
    const muitosEscanteios = (m.ckHome + m.ckAway) >= 9;
    const pressaoAlta = (m.apHome > 80 || m.apAway > 80);

    let insightContent = "";
    if (isLive) {
        if (isLateGame && pressaoAlta && muitosEscanteios) {
            insightContent = `<div class="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl border-l-4 border-amber-500 animate-in">
                <div class="flex items-center gap-2 mb-2">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <p class="text-amber-500 font-black text-[10px] uppercase tracking-wider">Estratégia: Canto Limite</p>
                </div>
                <p class="text-slate-300 text-[11px] leading-relaxed">Volume crítico de cantos detectado (${m.ckHome + m.ckAway}). O time sob pressão deve ceder novas oportunidades nos minutos finais.</p>
            </div>`;
        } else if (m.apHome > 85 || m.apAway > 85) {
            insightContent = `<div class="bg-cyan-500/10 border border-cyan-500/50 p-4 rounded-xl border-l-4 border-cyan-500 animate-in">
                <p class="text-cyan-400 font-black text-[10px] uppercase mb-2">⚠️ Alerta de Pressão Extrema</p>
                <p class="text-slate-300 text-[11px] leading-relaxed">Padrão de golo iminente identificado. A linha de pressão rompeu os 85 AP.</p>
            </div>`;
        } else {
            insightContent = `<div class="flex flex-col items-center justify-center p-10 opacity-40 animate-in">
                <i class="fas fa-microchip mb-3 text-slate-500 text-xl"></i>
                <p class="text-slate-500 italic text-[11px] text-center">Analisando fluxo da partida...</p>
            </div>`;
        }
    } else {
        // Conteúdo para Jogo Pré-Live
        insightContent = `<div class="bg-slate-800/50 border border-white/5 p-4 rounded-xl animate-in">
            <p class="text-white font-black text-[10px] uppercase mb-2 italic">📋 Análise Pré-Jogo</p>
            <p class="text-slate-400 text-[11px]">Aguardando escalações oficiais para gerar insights de tendência de pressão.</p>
        </div>`;
    }

    // --- LOGICA DE ATUALIZAÇÃO INTELIGENTE ---
    const hasHeader = container.querySelector('.bg-slate-900');
    
    // NOVIDADE: Verifica se as abas que estão lá condizem com o status do jogo atual
    const abasAtuaisSaoLive = container.querySelector('button[onclick*="switchTab(\'live\')"]') !== null;
    const precisaTrocarAbas = isLive !== abasAtuaisSaoLive;

    // Se não tem header OU se precisamos trocar o tipo de abas (Live vs Upcoming)
    if (!hasHeader || precisaTrocarAbas) {
        // Forçamos a reconstrução completa do container para atualizar as abas
        container.innerHTML = `
            <div class="animate-in">
                <div class="bg-slate-900 p-6 rounded-2xl border border-white/5 mb-6 text-center shadow-2xl">
                    <div class="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em]">${m.league}</div>
                    <div class="flex justify-around items-center">
                        <div class="w-1/3 text-center">
                            <div class="text-[11px] font-black text-white uppercase mb-2 truncate">${m.home}</div>
                            <div class="text-4xl font-black font-mono text-white" id="score-home-detail">${m.scoreHome}</div>
                        </div>
                        <div class="text-slate-700 italic font-black text-xl">${isLive ? 'VS' : (m.time_start || 'VS')}</div>
                        <div class="w-1/3 text-center">
                            <div class="text-[11px] font-black text-white uppercase mb-2 truncate">${m.away}</div>
                            <div class="text-4xl font-black font-mono text-white" id="score-away-detail">${m.scoreAway}</div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5 mb-6">
                    ${isLive ? `
                        <button onclick="switchTab('live')" class="tab-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${window.activeTab === 'live' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-white'}">Live Stats</button>
                    ` : ''}
                    <button onclick="switchTab('h2h')" class="tab-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${window.activeTab === 'h2h' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-white'}">${isLive ? 'Insights Bot' : 'Análise Pré-Jogo'}</button>
                    ${!isLive ? `
                        <button onclick="switchTab('lineups')" class="tab-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${window.activeTab === 'lineups' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-white'}">Escalações</button>
                    ` : ''}
                </div>

                <div id="tab-content"></div>
            </div>`;
    } else {
        // Se já tem o header certo, apenas atualiza os números para ser rápido
        const scoreH = document.getElementById('score-home-detail');
        const scoreA = document.getElementById('score-away-detail');
        if(scoreH) scoreH.innerText = m.scoreHome;
        if(scoreA) scoreA.innerText = m.scoreAway;
    }

    const tabContent = document.getElementById('tab-content');
    
    // Gerenciamento Inteligente do Conteúdo
    if (window.activeTab === 'live' && isLive) {
        const canvas = document.getElementById('pressureChartCanvas');
        if (!canvas) {
            tabContent.innerHTML = renderLiveTab(m);
            setTimeout(() => window.initPressureChart(m), 50);
        } else {
            window.initPressureChart(m);
        }
    } else if (window.activeTab === 'lineups') {
        tabContent.innerHTML = `<div class="p-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Escalações disponíveis 1h antes do jogo</div>`;
    } else {
        tabContent.innerHTML = insightContent;
    }
}

function renderLiveTab(m) {
    const totalAP = (m.apHome + m.apAway) || 1;
    const percH = ((m.apHome / totalAP) * 100).toFixed(0);

    return `
    <div class="space-y-6">
        <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
            <div class="flex justify-between mb-2"><span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pressão (AP)</span><span class="text-xs font-mono text-cyan-400 font-black">${m.apHome} - ${m.apAway}</span></div>
            <div class="h-1.5 bg-slate-950 rounded-full overflow-hidden flex mb-4 border border-white/5 shadow-inner">
                <div style="width: ${percH}%" class="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]"></div>
            </div>
            <div style="height: 120px;"><canvas id="pressureChartCanvas"></canvas></div>
        </div>

        <div class="bg-slate-900/20 rounded-2xl border border-white/5 overflow-hidden shadow-lg">
            <div class="grid grid-cols-3 p-2 bg-white/5 text-[7px] font-black text-slate-500 uppercase text-center tracking-widest"><span>CASA</span><span>ESTATÍSTICA</span><span>FORA</span></div>
            ${renderStatRow("Chutes no Alvo", m.shOnHome, m.shOnAway, true)}
            ${renderStatRow("Chutes Fora", m.shOffHome, m.shOffAway)}
            ${renderStatRow("Posse", (m.posHome || 50) + "%", (m.posAway || 50) + "%")}
            ${renderStatRow("Cantos", m.ckHome, m.ckAway)}
            ${renderStatRow("Amarelos", m.yellowHome, m.yellowAway, false, "text-amber-500")}
            ${renderStatRow("Vermelhos", m.redCardsHome, m.redCardsAway, false, "text-red-500")}
            ${renderStatRow("Impedimentos", m.offsidesHome, m.offsidesAway)}
        </div>
    </div>`;
}

function renderStatRow(label, v1, v2, highlight = false, colorClass = "text-white") {
    return `<div class="grid grid-cols-3 p-3 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors">
        <span class="text-center text-[11px] font-black ${highlight ? 'text-cyan-400' : 'text-slate-300'}">${v1 || 0}</span>
        <span class="text-center text-[8px] font-bold text-slate-500 uppercase">${label}</span>
        <span class="text-center text-[11px] font-black ${colorClass}">${v2 || 0}</span>
    </div>`;
}

function renderH2HTab(m) {
    return `<div class="p-8 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl text-center">
        <i class="fas fa-robot text-cyan-500 mb-4 text-3xl"></i>
        <p class="text-[12px] font-bold text-slate-300 leading-relaxed italic uppercase tracking-tighter">
            ${m.apHome > 80 ? '⚠️ Alerta de Pressão Extrema: Probabilidade de golo do ' + m.home + ' acima de 85% nos próximos 10 minutos.' : 'Aguardando padrão de entrada agressivo no mercado...'}
        </p>
    </div>`;
}

/* === 5. MOTOR DO GRÁFICO E UTILITÁRIOS === */
window.initPressureChart = function(m) {
    const canvas = document.getElementById('pressureChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. Definição das cores dinâmicas
    const corLinha = m.apHome > 90 ? '#f97316' : '#06b6d4';
    const corFundo = m.apHome > 90 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(6, 182, 212, 0.1)';

    // 2. Gerenciamento do Histórico (Memória)
    if (!window.pressureHistory[m.id]) {
        window.pressureHistory[m.id] = { home: [m.apHome], labels: [m.time + "'"] };
    } else {
        const hist = window.pressureHistory[m.id];
        // Só adiciona se o tempo for novo OU a pressão mudou
        if (hist.labels[hist.labels.length - 1] !== m.time + "'" || hist.home[hist.home.length - 1] !== m.apHome) {
            hist.home.push(m.apHome);
            hist.labels.push(m.time + "'");
            if (hist.home.length > 15) { hist.home.shift(); hist.labels.shift(); }
        }
    }

    const currentHist = window.pressureHistory[m.id];

    // 3. A MÁGICA: Se o gráfico já existe, APENAS ATUALIZE (Não destrua!)
    if (window.myPressureChart instanceof Chart && window.myPressureChart.ctx.canvas.id === 'pressureChartCanvas') {
        window.myPressureChart.data.labels = currentHist.labels;
        window.myPressureChart.data.datasets[0].data = currentHist.home;
        window.myPressureChart.data.datasets[0].borderColor = corLinha;
        window.myPressureChart.data.datasets[0].pointBackgroundColor = corLinha;
        window.myPressureChart.data.datasets[0].backgroundColor = corFundo;
        
        window.myPressureChart.update('active'); // Atualização suave com animação
    } else {
        // Se o gráfico não existe (primeira vez ou mudou de jogo), cria um novo
        if (window.myPressureChart instanceof Chart) window.myPressureChart.destroy();

        window.myPressureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: currentHist.labels,
                datasets: [{
                    data: currentHist.home,
                    borderColor: corLinha,
                    backgroundColor: corFundo,
                    fill: true,
                    tension: 0.5, // Curvas de Bézier suaves
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: corLinha
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 9 } } },
                    y: { beginAtZero: true, max: 100, display: false }
                }
            }
        });
    }
};

window.goHome = function() {
    window.selectedMatchId = null;
    window.selectedLeague = "";
    window.activeStrategy = null;
    document.querySelectorAll('[id^="filter-"]').forEach(b => b.classList.remove('bg-cyan-500', 'text-slate-900'));
    window.updateDashboard();
};

window.selectMatch = function(id) {
    window.selectedMatchId = id;
    window.lastAnalysisSnapshot = null;
    window.updateDashboard();
};

window.switchTab = function(tab) {
    window.activeTab = tab;
    window.lastAnalysisSnapshot = null;
    renderAnalysis();
};

window.filterLeague = function(league) {
    window.selectedLeague = league;
    window.updateDashboard();
};

window.toggleFavorite = function(id) {
    const sId = id.toString();
    const idx = window.favorites.indexOf(sId);
    if (idx > -1) window.favorites.splice(idx, 1);
    else window.favorites.push(sId);
    localStorage.setItem('manibol_favs', JSON.stringify(window.favorites));
    window.updateDashboard();
};

window.applyStrategyFilter = function(strat) {
    const btn = document.getElementById(`filter-${strat}`);
    
    // Se clicar no que já está ativo, desativa voltando para a cor padrão (Slate)
    if (window.activeStrategy === strat) {
        window.activeStrategy = null;
        btn.className = "bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-white/5 transition-all";
    } else {
        // Limpa todos os botões para o estado padrão
        document.querySelectorAll('[id^="filter-"]').forEach(b => {
            b.className = "bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-white/5 transition-all";
        });
        
        window.activeStrategy = strat;
        
        // Aplica cores específicas baseadas no tipo de filtro
        if (strat === 'redCard') {
            btn.className = "bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all";
        } else if (strat === 'highPressure') {
            btn.className = "bg-amber-500 text-slate-900 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all";
        }
    }
    window.updateDashboard();
};

window.checkStrategy = function(m, strat) {
    if (strat === 'redCard') return (m.redCardsHome + m.redCardsAway) > 0;
    if (strat === 'highPressure') return (m.apHome > 80 || m.apAway > 80);
    return true;
};

/* === 6. INICIALIZAÇÃO === */
document.addEventListener('DOMContentLoaded', () => { 
    window.updateDashboard(); 
    setInterval(window.updateDashboard, 10000); 
    
    const si = document.querySelector('input[placeholder*="Buscar"]');
    if(si) si.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = window.currentMatches.filter(m => m.home.toLowerCase().includes(q) || m.away.toLowerCase().includes(q));
        renderFeed(filtered);
    });
});