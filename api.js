const fs = require('fs')

module.exports = {
  setupRoutes () {
    app.get('/games', this.getGames.bind(this))

    app.get('/legal-values', this.getLegalValues.bind(this))

    app.post('/games', this.addGame.bind(this))
  },

  async addGame (req, res, next) {
    let [password, gameData] = [req.body.password, req.body.gameData]
    if (password !== 'Orphea') {
      res.end('Wrong password provided')
      return
    }

    let allGames = await this.readGamesContent()
    allGames.push(gameData)

    if (gameData.team.length < 2 || gameData.team.length > 5) {
      res.end('Number of players must be between 2-5!')
      return
    }

    for (let player of gameData.team) {
      player.kills = Number(player.kills)
      player.deaths = Number(player.deaths)
      player.assists = Number(player.assists)
    }

    fs.writeFile('./games.json', JSON.stringify(allGames), (err) => {
      if (err) { res.end('Error: ' + err.toString()) }
      else { res.end('Success!') }
    })
  },

  async getGames (req, res, next) {
    let games = await this.readGamesContent()

    let totalStats = this.calculateTotalStats(games)
    let playerStats = this.calculatePlayerStats(games)
    let recentGames = this.getMostRecentGames(games)
    let teamStats = this.calculateTeamStats(games)

    res.json({
      'totalStats': totalStats,
      'playerStats': playerStats,
      'recentGames': recentGames,
      'teamStats': teamStats
    })
  },

  getMostRecentGames (allGames) {
    for (let game of allGames) {
      game.date = new Date(game.date)
    }
    allGames.sort((g1, g2) => g1.date > g2.date ? -1 : 1)

    return allGames.slice(0, 10)
  },

  calculateTotalStats (allGames) {
    let stats = {
      'games': 0,
      'wins': 0,
      'losses': 0,
      'winratesByPlayerCounts': {2: {games: 0, wins: 0}, 3: {games: 0, wins: 0}, 4: {games: 0, wins: 0}, 5: {games: 0, wins: 0}},
      'winRatesByGameType': {'QM': {games: 0, wins: 0}, 'Draft': {games: 0, wins: 0}, 'Ranked': {games: 0, wins: 0}},
      'winRatesByMap': {'Alterac Pass': {games: 0, wins: 0}, 'Battlefield of Eternity': {games: 0, wins: 0}, 'Blackheart\'s Bay': {games: 0, wins: 0}, 'Braxis Holdout': {games: 0, wins: 0}, 'Cursed Hollow': {games: 0, wins: 0}, 'Dragon Shire': {games: 0, wins: 0}, 'Garden of Terror': {games: 0, wins: 0}, 'Hanamura': {games: 0, wins: 0}, 'Haunted Mines': {games: 0, wins: 0}, 'Infernal Shrines': {games: 0, wins: 0}, 'Sky Temple': {games: 0, wins: 0}, 'Tomb of the Spider Queen': {games: 0, wins: 0}, 'Towers of Chromie': {games: 0, wins: 0}, 'Volskaya Foundry': {games: 0, wins: 0}, 'Orphea Junction': {games: 0, wins: 0}},
    }

    for (let game of allGames) {
      let isWin = game.result === 1
      stats.games++
      
      if (isWin) { stats.wins++ } 
      else { stats.losses++ }

      let playerCount = game.team.length
      stats.winratesByPlayerCounts[playerCount].games++
      if (isWin) { stats.winratesByPlayerCounts[playerCount].wins++ }

      stats.winRatesByGameType[game.gameType].games++
      if (isWin) { stats.winRatesByGameType[game.gameType].wins++ }

      stats.winRatesByMap[game.map].games++
      if (isWin) { stats.winRatesByMap[game.map].wins++ }
    }

    // remove empty maps and reformat
    let newWinRatesByMap = []
    for (let mapName of Object.keys(stats.winRatesByMap)) {
      if (stats.winRatesByMap[mapName].games === 0) { continue }
      else {
        newWinRatesByMap.push({
          'map': mapName,
          'games': stats.winRatesByMap[mapName].games,
          'winRate': percent(stats.winRatesByMap[mapName].wins / stats.winRatesByMap[mapName].games)})
      }
    }
    newWinRatesByMap.sort((m1, m2) => m1.games > m2.games ? -1 : 1)
    stats.winRatesByMap = newWinRatesByMap

    stats.winratesByPlayerCounts[2].winRate = percent(stats.winratesByPlayerCounts[2].wins / stats.winratesByPlayerCounts[2].games, 2)
    stats.winratesByPlayerCounts[3].winRate = percent(stats.winratesByPlayerCounts[3].wins / stats.winratesByPlayerCounts[3].games, 2)
    stats.winratesByPlayerCounts[4].winRate = percent(stats.winratesByPlayerCounts[4].wins / stats.winratesByPlayerCounts[4].games, 2)
    stats.winratesByPlayerCounts[5].winRate = percent(stats.winratesByPlayerCounts[5].wins / stats.winratesByPlayerCounts[5].games, 2)
    stats.winRatesByGameType['QM'].winRate = percent(stats.winRatesByGameType['QM'].wins / stats.winRatesByGameType['QM'].games, 2)
    stats.winRatesByGameType['Draft'].winRate = percent(stats.winRatesByGameType['Draft'].wins / stats.winRatesByGameType['Draft'].games, 2)
    stats.winRatesByGameType['Ranked'].winRate = percent(stats.winRatesByGameType['Ranked'].wins / stats.winRatesByGameType['Ranked'].games, 2)

    stats.winRate = round(stats.wins / stats.games, 2)

    return stats
  },

  calculateTeamStats (allGames) {
    let allTeams = []

    for (let game of allGames) {
      let gamePlayersString = gameToTeam(game)
      let team = allTeams.find(t => t.playersString === gamePlayersString)
      if (!team) {
        allTeams.push({playersString: gamePlayersString, players: game.team.map(player => player.name), games: 0, wins: 0})
        team = allTeams.find(t => t.playersString === gamePlayersString)
      }

      team.games++
      if (game.result === 1) { team.wins++ }
    }

    for (let team of allTeams) {
      team.winPercent = percent(team.wins / team.games)
    }

    allTeams.sort((t1, t2) => t1.winPercent > t2.winPercent ? -1 : 1)
  
    return allTeams

    function gameToTeam (game) {
      return game.team.map(player => player.name).sort().join(', ')
    }
  },

  calculatePlayerStats (allGames) {
    let allPlayerStats = {}

    for (let game of allGames) {
      let isWin = game.result === 1
      for (let playerGame of game.team) {
        if (!(playerGame.name in allPlayerStats)) {
          allPlayerStats[playerGame.name] = createNewPlayer(playerGame.name)
        }
        let playerStats = allPlayerStats[playerGame.name]

        playerStats.games++
        if (isWin) { playerStats.wins++ }

        if (playerGame.award) { playerStats.awards[playerGame.award]++ }

        // KDA
        playerStats.kills += playerGame.kills
        playerStats.deaths += playerGame.deaths
        playerStats.assists += playerGame.assists

        // HERO
        if (!(playerGame.hero in playerStats.heroes)) {
          playerStats.heroes[playerGame.hero] = createHero(playerGame.hero)
        }
        let playerHero = playerStats.heroes[playerGame.hero]

        playerHero.games++
        if (isWin) { playerHero.wins++ }

        playerHero.avgKills = (playerHero.avgKills * (playerHero.games-1) + playerGame.kills) / playerHero.games
        playerHero.avgDeaths = (playerHero.avgDeaths * (playerHero.games-1) + playerGame.deaths) / playerHero.games
        playerHero.avgAssists = (playerHero.avgAssists * (playerHero.games-1) + playerGame.assists) / playerHero.games
      }
    }

    // make dicts list
    allPlayerStats = Object.values(allPlayerStats)
    for (let player of allPlayerStats) {
      player.heroes = Object.values(player.heroes)
      player.winRate = percent(player.wins / player.games)

      player.avgKills = round(player.kills / player.games, 1)
      player.avgAssists = round(player.assists / player.games, 1)
      player.avgDeaths = round(player.deaths / player.games, 1)
      player.avgKD = round(player.avgKills/player.avgDeaths, 1)
      player.avgKAD = round((player.avgKills+player.avgAssists)/player.avgDeaths, 1)
      
      for (let hero of player.heroes) {
        hero.winRate = percent(hero.wins / hero.games)
        hero.avgKills = round(hero.avgKills, 1)
        hero.avgAssists = round(hero.avgAssists, 1)
        hero.avgDeaths = round(hero.avgDeaths, 1)
      }

      player.heroes.sort((h1, h2) => h1.games > h2.games ? -1 : 1)
    }
    allPlayerStats.sort((p1, p2) => p1.games > p2.games ? -1 : 1)

    // remove zero values and reformat awards
    for (let player of allPlayerStats) {
      let newPlayerAwards = []
      let totalNumAwards = 0
      for (let playerAward of Object.keys(player.awards)) {
        if (player.awards[playerAward] === 0) { continue }
        else {
          newPlayerAwards.push({'award': playerAward, 'percentage': percent(player.awards[playerAward] / player.games)})
          totalNumAwards += player.awards[playerAward]
        }
      }
      player.mvpPercentage = percent((player.awards['MVP'] || 0) / player.games)
      player.awardPercentage = percent(totalNumAwards / player.games)

      player.awards = newPlayerAwards
    }

    return allPlayerStats

    function createNewPlayer (name) {
      return {
        'name': name,
        'games': 0,
        'wins': 0,
        'awards': {'MVP': 0, 'Avenger': 0, 'Bulwark': 0, 'Clutch Healer': 0, 'Combat Medic': 0, 'Daredevil': 0, 'Dominator': 0, 'Escape Artist': 0, 'Experienced': 0, 'Finisher': 0, 'Guardian': 0, 'HatTrick': 0, 'Headhunter': 0, 'Main Healer': 0, 'Painbringer': 0, 'Protector': 0, 'Scrapper': 0, 'Siege Master': 0, 'Silencer': 0, 'Sole Survivor': 0, 'Stunner': 0, 'Team Player': 0, 'Trapper': 0, 'Map-specific': 0},
        'heroes': {},
        'avgKills': 0,
        'avgDeaths': 0,
        'avgAssists': 0,
        'kills': 0,
        'deaths': 0,
        'assists': 0
      }
    }

    function createHero (heroName) {
      return {
        'name': heroName,
        'games': 0,
        'wins': 0,
        'avgKills': 0,
        'avgDeaths': 0,
        'avgAssists': 0
      }
    }
  },

  async readGamesContent () {
    return new Promise((resolve, reject) => {
      fs.readFile('./games.json', (err, data) => {
        if (err) { return [] }

        else {
          resolve(JSON.parse(data.toString()))
        }
      })
    })
  },

  async getLegalValues (req, res, next) {
    fs.readFile('./legal-values.json', (err, data) => {
      if (err) { return [] }

      else {
        res.json(JSON.parse(data.toString()))
      }
    })
  }
}

function round (number, decimals) {
  return (Math.round(number * 10 ** decimals)) / (10 ** decimals)
}
function percent (number) {
  return Math.round(number * 100)
}