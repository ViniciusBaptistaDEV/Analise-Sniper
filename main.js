import { parseSportingbetPDF } from "./pdfParser.js";
import { classifyMarket } from "./marketClassifier.js";

let allBets = [];


// ========================================================
// MODAL DE ALERTA CUSTOMIZADO:
// ========================================================
window.showAlert = function (title, message, icon = "❌") {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalMessage").innerText = message;
    document.getElementById("modalIcon").innerText = icon;
    document.getElementById("customModal").style.display = "flex";
};

// Função para fechar o modal e resetar a página em caso de erro
window.closeModal = function () {
    document.getElementById("customModal").style.display = "none";
    // Como combinamos, após o erro, resetamos a tela inicial
    window.location.reload();
};


// ========================================================
// UPLOAD DO PDF
// ========================================================
window.handleFileUpload = async function () {
    const file = document.getElementById("fileInput").files[0];
    if (!file) return;

    try {
        const processedBets = await processPDF(file);

        // VALIDAÇÃO: Se não encontrar nenhuma aposta, o PDF é inválido para o sistema
        if (!processedBets || processedBets.length === 0) {
            window.showAlert(
                "Arquivo Inválido",
                "O arquivo enviado não é um histórico de apostas válido da Sportingbet ou está vazio.",
                "⚠️"
            );
            return;
        }

        // Se passar na validação, segue o fluxo normal
        allBets = processedBets;

        document.getElementById("uploadBox").classList.remove("clique");
        document.getElementById("fileName").innerText = "📄 " + file.name;
        document.getElementById("uploadBox").classList.add("loaded");

        console.log("--- AUDITORIA DAS 5 PRIMEIRAS APOSTAS ---");
        console.table(allBets.slice(0, 5));

        document.getElementById("analyzeBtn").style.display = "flex";

    } catch (error) {
        window.showAlert(
            "Erro de Leitura",
            "Não conseguimos processar este PDF. Verifique se o arquivo está correto.",
            "❌"
        );
    }
};


// ========================================================
// PROCESSAMENTO COMPLETO
// ========================================================
async function processPDF(file) {
    const parsed = await parseSportingbetPDF(file);

    return parsed.map(b => ({
        ...b,
        mercado: classifyMarket(b),
        statusLabel: resolveStatus(b),
        statusColor: resolveColor(b)
    }));
}


// ========================================================
// STATUS
// ========================================================
function resolveStatus(b) {
    if (b.retorno > b.stake) return "GREEN";
    if (b.retorno === 0) return "RED";
    if (b.retorno > 0 && b.retorno < b.stake) return "CASH OUT";
    return "RED";
}

function resolveColor(b) {
    if (b.retorno > b.stake) return "bg-green";
    if (b.retorno === 0) return "bg-red";
    return "bg-orange";
}


// ========================================================
// BOTÃO ANÁLISE
// ========================================================
window.analisarAgora = function () {

    document.getElementById("uploadBox").style.display = "none";
    document.getElementById("mainUI").style.display = "block";

    ajustarPosicaoBotao();
    preencherDashboard();
    preencherTabela(allBets);
    preencherFiltros();

};


// ========================================================
// DASHBOARD
// ========================================================
function preencherDashboard() {

    let saldo = 0, investido = 0, wins = 0;
    let labels = ["Início"];
    let dataset = [0];
    let stats = {};

    // 1. Variáveis para Odds Gerais
    let somaOdds = 0;
    let qtdOdds = 0;
    let somaOddsGreen = 0, qtdOddsGreen = 0;
    let somaOddsRed = 0, qtdOddsRed = 0;

    // 2. Variáveis para Odds Simples (Excluindo Combinados)
    let somaOddsSimples = 0, qtdOddsSimples = 0;
    let somaOddsGreenSimples = 0, qtdOddsGreenSimples = 0;
    let somaOddsRedSimples = 0, qtdOddsRedSimples = 0;

    allBets.forEach(bet => {

        saldo += bet.lucro;
        investido += bet.stake;

        if (bet.lucro > 0) wins++;

        labels.push(bet.dateStr.substring(0, 5));
        dataset.push(saldo);

        if (!stats[bet.mercado]) stats[bet.mercado] = { lucro: 0, inv: 0 };
        stats[bet.mercado].lucro += bet.lucro;
        stats[bet.mercado].inv += bet.stake;

        const status = resolveStatus(bet);

        if (bet.odd && bet.odd > 0) {
            somaOdds += bet.odd;
            qtdOdds++;

            if (status === "GREEN") {
                somaOddsGreen += bet.odd;
                qtdOddsGreen++;
            } else if (status === "RED") {
                somaOddsRed += bet.odd;
                qtdOddsRed++;
            }

            // Cálculo Apenas Simples (Filtro isMultipla)
            if (!bet.isMultipla) {
                somaOddsSimples += bet.odd;
                qtdOddsSimples++;

                if (status === "GREEN") {
                    somaOddsGreenSimples += bet.odd;
                    qtdOddsGreenSimples++;
                } else if (status === "RED") {
                    somaOddsRedSimples += bet.odd;
                    qtdOddsRedSimples++;
                }
            }

        }

    });

    document.getElementById("kpiRoi").innerText =
        investido > 0 ? ((saldo / investido) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("kpiProfit").innerText =
        "R$ " + saldo.toFixed(2);

    document.getElementById("kpiCount").innerText = allBets.length;

    document.getElementById("kpiWinrate").innerText =
        allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) + "%" : "0%";




    // ATUALIZAÇÃO DO DOM - ODDS GERAIS
    let oddMedia = qtdOdds > 0 ? (somaOdds / qtdOdds).toFixed(2) : "0.00";
    document.getElementById("kpiOddMedia").innerText = oddMedia;

    document.getElementById("kpiOddMediaGreen").innerText =
        qtdOddsGreen > 0 ? (somaOddsGreen / qtdOddsGreen).toFixed(2) : "0.00";

    document.getElementById("kpiOddMediaRed").innerText =
        qtdOddsRed > 0 ? (somaOddsRed / qtdOddsRed).toFixed(2) : "0.00";

    // ATUALIZAÇÃO DO DOM - ODDS SIMPLES
    document.getElementById("kpiOddMediaSimples").innerText = qtdOddsSimples > 0 ? (somaOddsSimples / qtdOddsSimples).toFixed(2) : "0.00";
    document.getElementById("kpiOddMediaGreenSimples").innerText = qtdOddsGreenSimples > 0 ? (somaOddsGreenSimples / qtdOddsGreenSimples).toFixed(2) : "0.00";
    document.getElementById("kpiOddMediaRedSimples").innerText = qtdOddsRedSimples > 0 ? (somaOddsRedSimples / qtdOddsRedSimples).toFixed(2) : "0.00";

    // ==========================================



    // MELHOR MERCADO
    let best = "---";
    let maxL = -999999;

    // PIOR MERCADO
    let worstM = "---";
    let minLucro = 999999;


    for (const m of Object.keys(stats)) {
        if (stats[m].lucro > maxL) {
            maxL = stats[m].lucro;
            best = m;
        }
        if (stats[m].lucro < minLucro) {
            minLucro = stats[m].lucro;
            worstM = m;
        }
    }

    document.getElementById("bestMarket").innerText = best;
    document.getElementById("worstMarket").innerText = worstM;

    // ==========================================
    // MERCADOS NA DASHBOARD (AQUI ESTÁ A OTIMIZAÇÃO)
    // ==========================================
    const box = document.getElementById("marketList");
    let marketHtml = ""; // Rascunho criado para não travar a tela

    Object.keys(stats).forEach(m => {
        const roi = stats[m].inv > 0 ? ((stats[m].lucro / stats[m].inv) * 100).toFixed(1) : 0;

        let color = "status-yellow";
        if (stats[m].lucro > 0) color = "status-green";
        if (stats[m].lucro < 0) color = "status-red";

        marketHtml += `
            <div class="market-pill">
                <span>${m}</span>
                <strong class="${color}">${roi}%</strong>
            </div>
        `;
    });

    // Injeta tudo no HTML de uma única vez (super rápido)
    box.innerHTML = marketHtml;

    // ==========================================
    // AUDITORIA MATEMÁTICA
    // ==========================================
    console.log("=== AUDITORIA FINANCEIRA GERAL ===");
    console.log("1. Total de Apostas Lidas:", allBets.length);
    console.log("2. Total de Greens (Wins):", wins);
    console.log("3. Winrate Calculado (Greens / Total):", (allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(2) : 0) + "%");
    console.log("4. Investimento Total (Soma das Stakes): R$", investido.toFixed(2));
    console.log("5. Lucro Líquido (Soma dos Lucros): R$", saldo.toFixed(2));
    console.log("6. ROI Geral (Lucro / Investimento):", (investido > 0 ? ((saldo / investido) * 100).toFixed(2) : 0) + "%");
    console.table(stats); // Mostra a matemática de cada mercado separadamente
    console.log("==================================");

}



// ========================================================
// TABELA (OTIMIZADA E COM PLACAR DINÂMICO E ACUMULADO CERTO)
// ========================================================
function preencherTabela(arr) {
    const tbody = document.getElementById("tableBody");
    const statsBox = document.getElementById("filterStats");

    // 1. Viramos a lista de cabeça para baixo para fazer a matemática do Passado para o Futuro
    let apostasCalculo = [...arr].reverse();

    // 2. Fazemos a soma do Acumulado na ordem certa do tempo
    let saldoEmTempoReal = 0;
    apostasCalculo.forEach(bet => {
        saldoEmTempoReal += bet.lucro;
        bet.acumulado = saldoEmTempoReal;
    });

    // 3. Desviramos a lista para voltar à ordem EXATA do PDF da Sportingbet
    apostasCalculo.reverse();

    let htmlString = "";
    let greens = 0;
    let reds = 0;
    let cashouts = 0;

    // 4. Montamos a tabela (agora o Acumulado maior estará no topo!)
    apostasCalculo.forEach(bet => {
        htmlString += `
            <tr>
                <td>${bet.dateStr}</td>
                <td><span class="result-pill ${bet.statusColor}">${bet.statusLabel}</span></td>
                <td>${bet.mercado}</td>
                <td>${bet.odd ? bet.odd.toFixed(2) : "-"}</td>
                <td>R$ ${bet.stake.toFixed(2)}</td>
                <td>R$ ${bet.retorno.toFixed(2)}</td>
                <td>${bet.lucro >= 0 ? "+" : ""}R$ ${bet.lucro.toFixed(2)}</td>
                <td><strong>R$ ${bet.acumulado.toFixed(2)}</strong></td>
            </tr>
        `;

        // Contadores do Placar
        if (bet.statusLabel === "GREEN") greens++;
        else if (bet.statusLabel === "RED") reds++;
        else if (bet.statusLabel === "CASH OUT") cashouts++;
    });

    tbody.innerHTML = htmlString;

    if (statsBox) {
        statsBox.innerHTML = `
            <span class="result-pill bg-green" style="font-size: 12px; padding: 6px 14px;">GREEN: ${greens}</span>
            <span class="result-pill bg-red" style="font-size: 12px; padding: 6px 14px;">RED: ${reds}</span>
            ${cashouts > 0 ? `<span class="result-pill bg-orange" style="font-size: 12px; padding: 6px 14px;">CASH OUT: ${cashouts}</span>` : ""}
            <span class="total-pill">TOTAL FILTRADO: ${arr.length}</span>
        `;
    }
}


// ========================================================
// FILTROS
// ========================================================
function preencherFiltros() {
    const markets = [...new Set(allBets.map(b => b.mercado))];

    const filter = document.getElementById("filterMarket");
    filter.innerHTML = `<option value="ALL">Todos os Mercados</option>`;

    markets.forEach(m => {
        filter.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

window.aplicarFiltros = function () {
    const status = document.getElementById("filterStatus").value;
    const market = document.getElementById("filterMarket").value;

    const filtered = allBets.filter(b => {
        const ok1 = status === "ALL" || b.statusLabel === status;
        const ok2 = market === "ALL" || b.mercado === market;
        return ok1 && ok2;
    });

    preencherTabela(filtered);
};

// ========================================================
// NAVEGAÇÃO DAS ABAS (TABS)
// ========================================================
window.switchTab = function (event, tabId) {
    // 1. Esconde todo o conteúdo das abas
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].style.display = "none";
        contents[i].classList.remove("active");
    }

    // 2. Remove o estado "ativo" de todos os botões
    const btns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < btns.length; i++) {
        btns[i].classList.remove("active");
    }

    // 3. Mostra o conteúdo da aba selecionada e marca o botão como ativo
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.style.display = "block";
        selectedTab.classList.add("active");
    }
    event.currentTarget.classList.add("active");
};

// ========================================================
// RESPONSIVIDADE DO BOTÃO (MOVER ENTRE CONTAINERS)
// ========================================================
function ajustarPosicaoBotao() {
    const btn = document.getElementById('resetBtn');
    const mobilePlace = document.getElementById('mobileButtonContainer');
    const desktopPlace = document.querySelector('.tabs');
    const imagemSportingbet = document.getElementById('imagemSportingbet');

    // Se a largura da tela for menor ou igual a 850px
    if (window.innerWidth <= 768) {
        if (mobilePlace && btn) {
            mobilePlace.appendChild(btn); // Move para a div vazia em cima
            imagemSportingbet.style.display = "none"; // Esconde a imagem no celular
        }
    } else {
        if (desktopPlace && btn) {
            desktopPlace.appendChild(btn); // Devolve para dentro das abas
        }
    }
}

// Para o botão mudar de lugar se você redimensionar o F12
window.addEventListener('resize', ajustarPosicaoBotao);

// Aguarda o carregamento do documento
document.addEventListener("DOMContentLoaded", () => {
    const uploadBox = document.getElementById("uploadBox");
    const fileInput = document.getElementById("fileInput");
    const analyzeBtn = document.getElementById("analyzeBtn");

    // 1. Faz o quadrado inteiro abrir o seletor de arquivos
    uploadBox.addEventListener("click", () => {
        fileInput.click();
    });

    // 2. IMPORTANTE: Evita que o clique no botão de "Analisar" 
    // abra o seletor de arquivos novamente (Stop Propagation)
    analyzeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
    });
});