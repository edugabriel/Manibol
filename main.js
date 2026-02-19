/* === 1. CONFIGURAÇÃO E ESTADO === */
window.currentMatches = []; 
window.favorites = JSON.parse(localStorage.getItem('manibol_favs')) || []; 
window.selectedMatchId = null; 
window.selectedLeague = ""; 
window.activeStrategy = null; 
window.lastDataSnapshot = {}; 
window.activeTab = 'live';

const alertSounds = {
    goal: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
    redCard: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3')
};

/* === 2. MOTOR DE ATUALIZAÇÃO E ALERTAS === */
window.updateDashboard = async function() {
    try {
        const api = window.FootballAPI || window.MockAPI;
        if (!api) return;

        // 1. CLONAGEM INDEPENDENTE: Criamos uma cópia real dos dados atuais
        // Isso impede que o "passado" mude antes da hora.
        const matchesAntigos = window.currentMatches.map(m => {
            return { ...m };
        });

        // 2. Buscamos os dados novos da API
        const data = await api.fetchMatches();
        const matchesNovos = api.mapApiFootballData(data);
        
        // 3. COMPARAÇÃO: Só comparamos se já existia algo na tela (evita alerta ao abrir a página)
        if (matchesAntigos.length > 0) {
            checkForAlerts(matchesNovos, matchesAntigos);
        }
        
        // 4. ATUALIZAÇÃO DA MEMÓRIA: Agora sim o presente vira o que veio da API
        window.currentMatches = matchesNovos;
        
        // 5. RENDERIZAÇÃO VISUAL
        let filtered = matchesNovos;
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
            const novo = Number(match.scoreHome) + Number(match.scoreAway);
            const antigo = Number(oldMatch.scoreHome) + Number(oldMatch.scoreAway);

            // SE ESSE LOG NÃO APARECER NO CONSOLE, A FUNÇÃO NÃO ESTÁ SENDO CHAMADA
            console.log(`[AUDITORIA] ${match.home}: ${antigo} ➔ ${novo}`);

            if (novo > antigo) {
                console.log("%c ⚽ GOL DETECTADO!", "color: #06b6d4; font-weight: bold; font-size: 14px;");
                
                alertSounds.goal.play().catch(() => {
                    console.warn("Áudio bloqueado! Clique na página para liberar.");
                });
                
                showNotification(`GOL! ${match.home} ${match.scoreHome} - ${match.scoreAway} ${match.away}`);
            }
        }
    });
}

function showNotification(text) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'goal-alert';
    el.innerHTML = `<i class="fas fa-futbol mr-2"></i> ${text}`;
    
    container.appendChild(el);

    // Remove após 5 segundos
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
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
        
        // Lógica de destaque por pressão extrema (>90)
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
                        <span class="text-[11px] font-bold transition-colors ${homeHighPressure ? 'text-orange-500 animate-pulse' : m.apHome > 70 ? 'text-cyan-400' : 'text-slate-200'}">
                            ${m.home} ${homeHighPressure ? '🔥' : ''}
                        </span>
                        <span class="text-[11px] font-black text-white font-mono">${m.scoreHome}</span>
                    </div>
                    
                    <div class="flex justify-between items-center pr-4">
                        <span class="text-[11px] font-bold transition-colors ${awayHighPressure ? 'text-orange-500 animate-pulse' : m.apAway > 70 ? 'text-cyan-400' : 'text-slate-200'}">
                            ${m.away} ${awayHighPressure ? '🔥' : ''}
                        </span>
                        <span class="text-[11px] font-black text-white font-mono">${m.scoreAway}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2 pl-3 border-l border-white/5">
                    <button onclick="event.stopPropagation(); toggleFavorite('${m.id}')" class="text-slate-600 hover:text-amber-500 transition-colors p-1">
                        <i class="${isFav ? 'fas fa-star text-amber-500' : 'far fa-star'}"></i>
                    </button>
                </div>
            </div>
            
            <div class="mt-2 h-1 bg-white/5 rounded-full overflow-hidden flex">
                <div style="width: ${(m.apHome / (m.apHome + m.apAway)) * 100}%" class="h-full bg-cyan-500/50"></div>
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

    // Evita flickering
    const snapshot = JSON.stringify(m) + window.activeTab;
    if (window.lastAnalysisSnapshot === snapshot) return;
    window.lastAnalysisSnapshot = snapshot;

    container.innerHTML = `
        <div class="animate-in">
            <div class="bg-slate-900 p-6 rounded-2xl border border-white/5 mb-6 text-center shadow-2xl">
                <div class="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em]">${m.league}</div>
                <div class="flex justify-around items-center">
                    <div class="w-1/3">
                        <div class="text-[11px] font-black text-white uppercase mb-2 truncate">${m.home}</div>
                        <div class="text-4xl font-black font-mono text-white">${m.scoreHome}</div>
                    </div>
                    <div class="text-slate-700 italic font-black text-xl">VS</div>
                    <div class="w-1/3">
                        <div class="text-[11px] font-black text-white uppercase mb-2 truncate">${m.away}</div>
                        <div class="text-4xl font-black font-mono text-white">${m.scoreAway}</div>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5 mb-6">
                <button onclick="switchTab('live')" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${window.activeTab === 'live' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-white'}">Live Stats</button>
                <button onclick="switchTab('h2h')" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${window.activeTab === 'h2h' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-white'}">Insights Bot</button>
            </div>

            <div id="tab-content">${window.activeTab === 'live' ? renderLiveTab(m) : renderH2HTab(m)}</div>
        </div>`;

    if (window.activeTab === 'live') {
        setTimeout(() => window.initPressureChart(m), 50);
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
    if (window.myPressureChart instanceof Chart) window.myPressureChart.destroy();
    const ctx = canvas.getContext('2d');
    window.myPressureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [1,2,3,4,5,6,7,8,9,10],
            datasets: [{
                data: [10, 25, 40, 30, 50, 70, 60, 85, 80, m.apHome],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
        }
    });
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
    if (window.activeStrategy === strat) {
        window.activeStrategy = null;
        btn.classList.remove('bg-cyan-500', 'text-slate-900');
        btn.classList.add('bg-slate-800', 'text-slate-400');
    } else {
        document.querySelectorAll('[id^="filter-"]').forEach(b => {
            b.classList.remove('bg-cyan-500', 'text-slate-900');
            b.classList.add('bg-slate-800', 'text-slate-400');
        });
        window.activeStrategy = strat;
        btn.classList.add('bg-cyan-500', 'text-slate-900');
        btn.classList.remove('bg-slate-800', 'text-slate-400');
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