<script>
  import Scheduler from './Scheduler.svelte'

  function randomNumber (min, max) {
    return Math.floor(Math.random() * (max - min) + min)
}

  async function updateSchedule (year, month) {
    return {
      [randomNumber(1, 29)]: {
        foo: 'bar'
      }
    }
  }
</script>

<Scheduler fetchSchedule={updateSchedule} />