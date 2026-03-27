// marketClassifier.js

export function classifyMarket(bet) {

    if (bet.isMultipla)
        return "🎫 BILHETE COMBINADO";

    switch (bet.mercadoRaw) {

        case "VITORIA":
            return "🏆 RADAR DE VITÓRIAS";

        case "GOLS":
            return "⚽ MERCADO DE GOLS";

        case "AMBAS":
            return "⚽ AMBAS MARCAM";

        case "ESCANTEIOS":
            return "💎 ANÁLISE DE ESCANTEIOS";

        default:
            return "🏆 RADAR DE VITÓRIAS";
    }
}