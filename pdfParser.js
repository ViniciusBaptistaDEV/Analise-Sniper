// pdfParser.js
export async function parseSportingbetPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(t => t.str).join("\n") + "\n";
    }

    text = normalizeText(text);
    return splitBets(text);
}


// ========================================================
// LIMPEZA COMPLETA DO TEXTO
// ========================================================
function normalizeText(t) {
    return t
        .replace(/\s+/g, " ")
        .replace(/[\u200B-\u200F\u202A-\u202E]/g, "")
        .replace(/ /g, " ")     // espaço invisível
        .trim();
}


// ========================================================
// DIVIDE O PDF EM APOSTAS
// ========================================================
function splitBets(fullText) {
    // O SEGREDO ESTÁ AQUI: Usamos um Regex para encontrar o "ID do cupom", 
    // mas se tiver a palavra "Múltipla" antes, nós incluímos ela no pacote.
    // Trocamos por um marcador único "|||BET|||" e depois cortamos com segurança.
    const replacedText = fullText.replace(/(Múltipla[\s\S]{0,40}?)?ID do cupom/gi, "|||BET|||$&");
    const parts = replacedText.split("|||BET|||");

    const bets = [];

    for (let i = 1; i < parts.length; i++) {
        const bloco = parts[i].trim();
        const bet = extractBet(bloco);
        if (bet) bets.push(bet);
    }

    // AUDITORIA (Imprimindo as duas primeiras para você conferir)
    console.log("--- AUDITORIA DAS APOSTAS ---");
    console.log("Total detectado:", bets.length);
    if (bets.length > 1) {
        console.log("Aposta [0] (Primeira):", bets[0]);
        console.log("Aposta [1] (Segunda):", bets[1]);
    }

    return bets;
}


// ========================================================
// EXTRAI UMA APOSTA COMPLETA
// ========================================================
function extractBet(bloco) {

    // DATA
    const dateMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return null;

    const [d, m, y] = dateMatch[1].split("/").map(Number);
    const date = new Date(y, m - 1, d);

    // EXTRAÇÃO BASEADA NOS CARDS DA SPORTINGBET
    // Varre o bloco e extrai todos os valores que seguem o padrão "R$ X,XX"
    const valoresR$ = [...bloco.matchAll(/R\$\s*([\d\.,]+)/g)].map(m => parseBRL(m[1]));

    // A Stake (Valor) será sempre o primeiro valor monetário encontrado no card
    const stake = valoresR$.length > 0 ? valoresR$[0] : 0;

    // STATUS E RETORNO REAL
    let status = "RED";
    let retorno = 0;

    // \b garante que pegamos a palavra exata "GANHO" da pílula, ignorando o cabeçalho "Ganhos"
    if (/\bGANHO\b/i.test(bloco)) {
        status = "GREEN";
        // Se a pílula for GANHO, o retorno é o segundo valor em R$ do card
        retorno = valoresR$.length > 1 ? valoresR$[1] : 0;
    } else if (/\b(CASH OUT|ENCERRADA)\b/i.test(bloco)) {
        status = "CASH OUT";
        retorno = valoresR$.length > 1 ? valoresR$[1] : 0;
    } else {
        // Se a pílula for DERROTA, o card exibe apenas um "-", logo não há segundo valor em R$.
        status = "RED";
        retorno = 0;
    }

    // MERCADO BRUTO
    const mercadoRaw = extractMarket(bloco.toLowerCase());

    // MULTIPLA
    // Ele procura por "Múltipla", "Seleção" ou "escolhas" dentro do bloco correto
    const isMultipla = /Múltipla/i.test(bloco) || /escolhas?/i.test(bloco) || /Seleç/i.test(bloco);


    // ODD
    // --- EXTRAÇÃO DA COTA (ODD) ---
    let odd = 0;

    // 1. Tenta achar a palavra Cota com o número logo na frente (para outros formatos)
    const oddMatch = bloco.match(/(?:Cota|Odd|@|Cotaç[õo]es)\s*:?\s*(\d+[.,]\d+)/i);

    if (oddMatch) {
        odd = parseFloat(oddMatch[1].replace(',', '.'));
    }

    // 2. A MÁGICA AQUI: Procura o número que vem imediatamente APÓS o valor investido (R$)
    // Exemplo de leitura do PDF: "R$ 100,00 1.25" ou "R$ 50,00 2,10"
    if (odd === 0) {
        const oddAposStakeMatch = bloco.match(/R\$\s*[\d.,]+\s+(\d+[,.]\d+)/);
        if (oddAposStakeMatch) {
            odd = parseFloat(oddAposStakeMatch[1].replace(',', '.'));
        }
    }

    // 3. Fallback matemático apenas para as apostas ganhas (onde o retorno existe)
    if (odd === 0 && stake > 0 && status === "GREEN" && valoresR$.length > 1) {
        odd = valoresR$[1] / stake;
    }

    // Garante que seja um número com 2 casas decimais
    odd = isNaN(odd) ? 0 : parseFloat(odd.toFixed(2));

    // -------------------------------------------

    return {
        dateStr: dateMatch[1],
        timestamp: date.getTime(),
        stake,
        retorno,
        lucro: retorno - stake,
        mercadoRaw,
        isMultipla,
        status,
        odd
    };
}


// ========================================================
// DETECÇÃO DO MERCADO BRUTO (MAPEAMENTO EXATO SPORTINGBET)
// ========================================================
function extractMarket(lower) {

    // 1. ESCANTEIOS (Mapeado com as suas frases)
    if (lower.includes("escanteios") || lower.includes("escanteio") || lower.includes("cantos"))
        return "ESCANTEIOS";

    // 2. AMBAS MARCAM
    if (lower.includes("ambas") || lower.includes("gg"))
        return "AMBAS";

    // 3. GOLS (Mapeado com as suas frases exatas)
    if (lower.includes("total de gols") || lower.includes("gols") || lower.includes("gol") || lower.includes("placar"))
        return "GOLS";

    // 4. VITÓRIAS E CLASSIFICAÇÕES
    if (lower.includes("vitória") || lower.includes("dupla chance") || lower.includes("empate") || lower.includes("classifica") || lower.includes("resultado"))
        return "VITORIA";

    return "MERCADO DESCONHECIDO"; // Fallback de segurança
}



// ========================================================
// CONVERSÃO DE VALORES
// ========================================================
function parseBRL(v) {
    return parseFloat(
        v.replace(/\./g, "").replace(",", ".")
    );
}