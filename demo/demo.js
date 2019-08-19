import Demo from './Demo.svelte'

const target = document.createElement('div')
document.body.appendChild(target)

new Demo({
  target,
  props: {}
})
