<Scheduler bind:fetchSchedule />

<script>
  import Scheduler from '../src/Scheduler.svelte'
  import Smiley from './Smiley.svelte'
  import get from 'just-safe-get'

  async function fetchSchedule (year, month) {
    return get(schedules, [ year, month ])
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: Smiley,
          props: {}
        }
      }
    }
  }
</script>