export function calendarWeeks (year, month) {
  const now = new Date()
  const currentMonth = now.getFullYear() === year && now.getMonth() === month
  const weeks = []
  const start = (new Date(year, month, 1)).getDay()
  const days = []
  const feb = (year % 100 != 0) && (year % 4 == 0) || (year % 400 == 0) ? 29 : 28
  const dayPerMonth = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const numDays = dayPerMonth[month]
  for (let i = 0; i < start; i++) {
    days.push({ valid: false })
  }
  for (let i = 1; i <= numDays; i++) {
    const dateString = year + '-' + zpad(((month) + 1), 2) + '-' + zpad(i, 2)
    const date = new Date(dateString)
    days.push({
      valid: true,
      dateString,
      date,
      day: date.getDay(),
      number: i,
      today: currentMonth && now.getDate() === i
    })
  }
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  const finalWeek = weeks[weeks.length - 1]
  const toAdd = 7 - finalWeek.length
  for (let i = 0; i < toAdd; i++) {
    finalWeek.push({ valid: false })
  }
  return weeks
}

export function zpad(number, length) {
  let str = "" + number
  while (str.length < length) {
    str = '0' + str
  }
  return str
}