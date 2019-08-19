import Scheduler from './Scheduler.svelte'

const target = document.createElement('div')
document.body.appendChild(target)

new Scheduler({
  target,
  props: {}
})
