import Demo from './Demo.svelte'

const target = document.createElement('div')
target.style.height = '100%'
document.body.appendChild(target)

// eslint-disable-next-line no-new
new Demo({
  target,
  props: {}
})

// recreate the whole app if an HMR update touches this module
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.$destroy()
  })
  import.meta.hot.accept()
}