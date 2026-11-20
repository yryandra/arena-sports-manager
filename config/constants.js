const sports = ['Athletics', 'Swimming', 'Football', 'Basketball', 'Cycling', 'Tennis']
const countries = [
  ['Saudi Arabia', 'SA', 'KSA'],
  ['Qatar', 'QA', 'QAT'],
  ['United Arab Emirates', 'AE', 'UAE'],
  ['Bahrain', 'BH', 'BRN'],
  ['Kuwait', 'KW', 'KUW'],
  ['Oman', 'OM', 'OMA'],
  ['Great Britain', 'GB', 'GBR'],
  ['United States', 'US', 'USA'],
  ['France', 'FR', 'FRA'],
  ['Spain', 'ES', 'ESP'],
  ['Germany', 'DE', 'GER'],
  ['Italy', 'IT', 'ITA'],
  ['Japan', 'JP', 'JPN'],
  ['Australia', 'AU', 'AUS'],
  ['Kenya', 'KE', 'KEN'],
  ['Jamaica', 'JM', 'JAM'],
  ['Brazil', 'BR', 'BRA'],
  ['Morocco', 'MA', 'MAR'],
  ['Egypt', 'EG', 'EGY'],
  ['South Africa', 'ZA', 'RSA'],
].map(([name, code, ioc]) => ({ name, code, ioc }))
module.exports = { sports, countries }
