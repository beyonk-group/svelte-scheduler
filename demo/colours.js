export default function randomColour () {
  return `hsla(${~~(360 * Math.random())}, 70%, 80%, 1)`
}