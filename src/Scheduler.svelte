<div class="byk-scheduler">
	<div class="byk-navigation">
		<button on:click={prev}>
			<ChevronLeftIcon />
		</button>
		<div class="byk-current-month">
			{formatDate(currentDate)}
		</div>
		<button on:click={next}>
			<ChevronRightIcon />
		</button>
	</div>
	<div class="byk-month">
		<div class="byk-header">
			{#each dayNames as dayName}
			<div class="byk-day-name">
				{dayName}
			</div>
			{/each}
		</div>
		{#await schedules then schedule}
			{#each calendarWeeks(currentDate.getYear(), currentDate.getMonth()) as week, i (i)}
			<div class="byk-week">
				{#each week as weekday, d (i + d)}
				<div 
					class="byk-day d-{weekday.number}"
					class:is-valid={weekday.valid}
					class:is-selected={selected && selected.date.getDay() === weekday.number}
					class:has-schedule={schedule.hasOwnProperty(weekday.number)}
					on:click={() => setSchedule(weekday.number)}>
					<div class="byk-content">
						{#if weekday.valid}
							<div class="byk-day-number">{weekday.number}</div>
						{/if}
					</div>
				</div>
				{/each}
			</div>
			{/each}
		{/await}
	</div>
</div>

<script>
  import { calendarWeeks } from './utils.js'
  import { ChevronLeftIcon, ChevronRightIcon } from 'svelte-feather-icons'

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  let schedules = {}
  let currentDate = new Date()

  export let selected = null
  export let fetchSchedule = () => {}

  function formatDate (date) {
    const dtf = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' })
    const [{ value: mo },,,, { value: ye }] = dtf.formatToParts(date)

    return `${mo} ${ye}`
  }

  $: {
    schedules = fetchSchedule(currentDate.getFullYear(), currentDate.getMonth())
  }

  function next () {
    currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1))
  }
  
  function prev () {
    currentDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1))
  }

  function setSchedule (day) {
    if (!hasSchedule(day)) { return }
    selected = schedules[day]
  }

  function hasSchedule (day) {
    return schedules.hasOwnProperty(day)
  }
</script>

<style>
	.byk-scheduler {
		width: 100%;
	}

	.byk-month {
		display: flex;
		flex-direction: column;
	}
	
	.byk-week, .byk-header, .byk-navigation {
		display: flex;
		flex-direction: row;
	}

	.byk-header {
		height: 40px;
		display: flex;
	}
	
	.byk-navigation {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin: 6px 0;
	}

	.byk-navigation button {
    padding: 0;
		border: 0;
		background-color: transparent;
    width: 24px;
	}

	:global(.byk-navigation button svg) {
		height: 24px;
		width: 24px;
	}

	.byk-navigation button,
	.byk-navigation .byk-current-month {
		font-size: 16px;
		display: flex;
		align-items: center;
		font-weight: 500;
	}
	
	.byk-day-name {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 500;
		border: 1px solid white;
	}

	.byk-week {
		display: flex;
		flex-direction: row;
		width: 100%;
		justify-content: space-evenly;
	}

	.byk-day {
    border-radius: 5px;
		position: relative;
		width: 100%;
		border: 1px solid transparent;
		display: flex;
		cursor: not-allowed;
	}

	.byk-day.has-schedule {
		font-weight: 700;
		cursor: pointer;
	}

  .byk-day.has-schedule .byk-day-number {
    color: var(--scheduler-day-number-with-schedule-color);
  }

	.byk-day .byk-day-number {
		color: var(--scheduler-day-number-color);
	}

	.byk-day.has-schedule:hover {
		background-color: var(--scheduler-day-with-schedule-hover-background-color);
	}

	.byk-day.is-selected {
		background-color: var(--scheduler-day-selected-background-color);
	}

  .byk-day.is-selected .byk-day-number{
    color: var(--scheduler-day-number-selected-color);
	}

	.byk-day::after,
	.byk-day-name::after {
		content: '';
		display: block;
		padding-bottom: 100%;
	}
		
	.byk-day .byk-content {
		display: flex;
		flex: 1;
    justify-content: center;
    align-items: center;
	}
</style>
