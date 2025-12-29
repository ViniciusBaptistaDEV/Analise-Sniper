 let chartInstance = null;
        let allBets = [];

        async function handleFileUpload() {
            const file = document.getElementById('fileInput').files[0];
            if (file) {
                document.getElementById('fileName').innerText = "✅ " + file.name;
                document.getElementById('uploadBox').classList.add('loaded');
                document.getElementById('uploadIcon').innerText = "✔️";
                await extrairPDF(file);
                document.getElementById('analyzeBtn').style.display = 'flex';
            }
        }

        function switchTab(evt, tabId) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            evt.currentTarget.classList.add('active');
        }

        async function extrairPDF(file) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join("\n") + "\n";
            }
            document.getElementById('rawText').value = fullText;
        }

        function analisarAgora() {
            const text = document.getElementById('rawText').value;
            if (!text.trim()) return;

            const blocos = text.split(/ID do cupom\s*:/i);
            allBets = [];
            const uniqueMarkets = new Set();

            for (let i = 1; i < blocos.length; i++) {
                const bloco = blocos[i];
                const dateMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
                if (!dateMatch) continue;

                const [d, m, y] = dateMatch[1].split('/').map(Number);
                const betDate = new Date(y, m - 1, d);

                const isLossText = bloco.includes("DERROTA") || bloco.includes("Perdidas");
                const isCashout = bloco.includes("APOSTA ENCERRADA");
                const bLower = bloco.toLowerCase();

                const moneyMatches = bloco.match(/R\$\s?([\d\.,]+)/g);
                if (moneyMatches && moneyMatches.length > 0) {
                    const parseBRL = (s) => parseFloat(s.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').trim());
                    const stake = parseBRL(moneyMatches[0]);
                    let retorno = 0;
                    
                    if (!isLossText) {
                        const valores = moneyMatches.map(m => parseBRL(m));
                        retorno = Math.max(...valores);
                    }

                    const lucroCalculado = retorno - stake;
                    let statusLabel = "RED"; 
                    let statusColor = "bg-red";

                    if (lucroCalculado > 0.01) {
                        statusLabel = "GREEN";
                        statusColor = "bg-green";
                    } else if (isCashout || (retorno > 0 && retorno <= stake)) {
                        statusLabel = "CASH OUT";
                        statusColor = "bg-orange";
                    }

                    let mercado = "Múltipla de Vitórias 🚀";
                    
                    // PRIORIDADE DE MERCADO AJUSTADA
                    if (isCashout) {
                        mercado = "Aposta Encerrada ⚠️";
                    } else if (bLower.includes("criar aposta")) {
                        mercado = "Criar Aposta 🛠️";
                    } else if (bLower.includes("escanteios") || bLower.includes("cantos") || (bLower.includes("mais de") && bLower.includes(".5") && !bLower.includes("resultado"))) {
                        mercado = "Escanteios 🎯";
                    }

                    uniqueMarkets.add(mercado);
                    allBets.push({
                        timestamp: betDate.getTime(), dateStr: dateMatch[1], stake,
                        retorno, lucro: lucroCalculado, mercado, statusLabel, statusColor
                    });
                }
            }

            allBets.sort((a, b) => a.timestamp - b.timestamp);
            const marketSelect = document.getElementById('filterMarket');
            marketSelect.innerHTML = '<option value="ALL">Todos os Mercados</option>';
            uniqueMarkets.forEach(m => marketSelect.innerHTML += `<option value="${m}">${m}</option>`);

            document.getElementById('mainUI').style.display = 'block';
            document.getElementById('uploadBox').style.display = 'none';
            renderizarDashboard();
        }

        function aplicarFiltros() {
            const status = document.getElementById('filterStatus').value;
            const market = document.getElementById('filterMarket').value;
            const filtered = allBets.filter(bet => {
                return (status === 'ALL' || bet.statusLabel === status) && (market === 'ALL' || bet.mercado === market);
            });
            renderizarTabela(filtered);
        }

        function renderizarDashboard() {
            let saldo = 0; let investido = 0; let wins = 0;
            let labels = ["Início"]; let dataSet = [0]; let stats = {};

            allBets.forEach(bet => {
                saldo += bet.lucro; investido += bet.stake;
                if (bet.lucro > 0) wins++;
                labels.push(bet.dateStr.substring(0, 5)); dataSet.push(saldo);

                if (!stats[bet.mercado]) stats[bet.mercado] = { lucro: 0, inv: 0 };
                stats[bet.mercado].lucro += bet.lucro;
                stats[bet.mercado].inv += bet.stake;
            });

            document.getElementById("kpiRoi").innerText = investido > 0 ? ((saldo / investido) * 100).toFixed(1) + "%" : "0%";
            document.getElementById("kpiProfit").innerText = "R$ " + saldo.toFixed(2);
            document.getElementById("kpiProfit").style.color = saldo > 0 ? "var(--green)" : "var(--red)";
            document.getElementById("kpiCount").innerText = allBets.length;
            document.getElementById("kpiWinrate").innerText = allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) + "%" : "0%";

            const marketBox = document.getElementById("marketList");
            marketBox.innerHTML = "";
            let bestM = ""; let maxL = -Infinity;
            Object.keys(stats).sort((a, b) => stats[b].lucro - stats[a].lucro).forEach(m => {
                const mRoi = stats[m].inv > 0 ? ((stats[m].lucro / stats[m].inv) * 100).toFixed(1) : 0;
                let colorClass = stats[m].lucro > 0 ? 'status-green' : (stats[m].lucro < 0 ? 'status-red' : 'status-yellow');
                marketBox.innerHTML += `<div class="market-pill"><span>${m}</span><strong class="${colorClass}">${mRoi}%</strong></div>`;
                if (stats[m].lucro > maxL) { maxL = stats[m].lucro; bestM = m; }
            });
            document.getElementById("bestMarket").innerText = bestM || "---";

            const ctx = document.getElementById('chart').getContext('2d');
            if (chartInstance) chartInstance.destroy();
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Evolução Bancária',
                        data: dataSet,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.05)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { callback: value => 'R$ ' + value } } }
                }
            });
            renderizarTabela(allBets);
        }

        function renderizarTabela(bets) {
            const tbody = document.getElementById("tableBody");
            tbody.innerHTML = "";
            let tempSaldo = 0;
            bets.forEach(bet => {
                tempSaldo += bet.lucro;
                let lucroColor = bet.lucro > 0.01 ? 'status-green' : (bet.lucro < -0.01 ? 'status-red' : 'status-yellow');
                let badgeClass = "badge-multi";
                if (bet.mercado.includes('🎯')) badgeClass = "badge-sniper";
                else if (bet.mercado.includes('🛠️')) badgeClass = "badge-create";
                else if (bet.mercado.includes('⚠️')) badgeClass = "badge-cashout";

                tbody.innerHTML += `
                <tr>
                    <td>${bet.dateStr}</td>
                    <td><span class="result-pill ${bet.statusColor}">${bet.statusLabel}</span></td>
                    <td><span class="badge ${badgeClass}">${bet.mercado}</span></td>
                    <td>R$ ${bet.stake.toFixed(2)}</td>
                    <td>R$ ${bet.retorno.toFixed(2)}</td>
                    <td class="${lucroColor} font-weight-bold">${bet.lucro >= 0 ? '+' : ''}R$ ${bet.lucro.toFixed(2)}</td>
                    <td><strong>R$ ${tempSaldo.toFixed(2)}</strong></td>
                </tr>`;
            });
        }