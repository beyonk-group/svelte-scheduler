<div>
  <Scheduler bind:fetchSchedule on:select={select} />
</div>

<script>
  import Scheduler from '../src/Scheduler.svelte'
  import EventList from './EventList.svelte'
  import Popdown from './Popdown.svelte'
  import get from 'just-safe-get'

  let events = null

  async function fetchSchedule (year, month) {
    return get(schedules, [ year, month ])
  }

  async function select (e) {
    const { year, month, day } = e.detail
    events = get(schedules, [ year, month, day, 'props', 'events' ])
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: EventList,
          popdown: Popdown,
          props: {
            events: [
              { name: 'Lunch with Lyn', time: '13:30' },
              { name: 'Dinner With Steve', time: '23:00' }
            ]
          }
        }
      }
    }
  }
</script>