// Definimos como global para o botão de teste funcionar
window.placarArsenal = 1;
window.apArsenal = 35;

const rawData = [
    {
        id: '1', league: 'Premier League', time: 82, home: 'Arsenal', away: 'Man City',
        get scoreHome() { return window.placarArsenal; }, // Puxa o valor global
        scoreAway: 2,
        get apHome() { return window.apArsenal; }, // Puxa a pressão global
        apAway: 38, ckHome: 8, ckAway: 4,
        redCardsHome: 0, redCardsAway: 0,
        shOffHome: 7, shOffAway: 3, shOnHome: 5, shOnAway: 6,
        yellowHome: 2, yellowAway: 4, offsidesHome: 3, offsidesAway: 1,
        goalKicksHome: 5, goalKicksAway: 11, posHome: 61, posAway: 39
    },
    {
        id: '2', league: 'Brasileirão', time: 24, home: 'Flamengo', away: 'Palmeiras',
        scoreHome: 0, scoreAway: 0,
        apHome: 45, apAway: 52, ckHome: 2, ckAway: 3,
        redCardsHome: 0, redCardsAway: 0,
        shOffHome: 2, shOffAway: 4, shOnHome: 1, shOnAway: 2,
        yellowHome: 1, yellowAway: 1, offsidesHome: 1, offsidesAway: 0,
        goalKicksHome: 3, goalKicksAway: 2, posHome: 48, posAway: 52
    }
];

window.FootballAPI = {
    mapApiFootballData: (d) => d,
    fetchMatches: async () => {
        // Retorna uma cópia profunda para o main.js poder comparar
        return JSON.parse(JSON.stringify(rawData));
    }
};
window.MockAPI = window.FootballAPI;