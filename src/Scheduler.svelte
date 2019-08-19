<div class="scheduler">
	<div class="navigation">
		<button class="button is-medium previous" on:click={prev}>
			<ChevronLeftIcon />
		</button>
		<div class="current-month">
			{currentDate.format('MMMM')}
		</div>
		<button class="button is-medium next" on:click={next}>
			<ChevronRightIcon />
		</button>
	</div>

	<div class="month">
		<div class="header">
			{#each dayNames as dayName}
			<div class="day-name">
				{dayName}
			</div>
			{/each}
		</div>
		{#each calendarWeeks(currentDate.year(), currentDate.month()) as week}
		<div class="week">
			{#each week as weekday, d}
			<div 
				class="day d-{weekday.number}"
				class:is-valid={weekday.valid}
				class:has-schedule={!!get(schedule, [ weekday.number ])}>
				<div class="content">
					{#if weekday.valid}
						<div class="number">
							<span>{weekday.number}</span>
						</div>
						{#if !!get(schedule, [ weekday.number ])}
							<svelte:component this={schedule[weekday.number].component} {...schedule[weekday.number].props} />
						{/if}
					{/if}
				</div>
			</div>
			{/each}
		</div>
		{/each}
	</div>
</div>

<script>
  import { calendarWeeks } from './utils.js'
  import { ChevronLeftIcon, ChevronRightIcon } from 'svelte-feather-icons'
	import { onMount } from 'svelte'
	import dayjs from 'dayjs'
	import get from 'just-safe-get'

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

	let currentDate = dayjs()
	let schedule
	
	onMount (async () => {
		await updateSchedule()
	})

	async function updateSchedule () {
		schedule = await fetchSchedule(currentDate.year(), currentDate.month() + 1) || {}
	}

  async function next () {
		currentDate = currentDate.add(1, 'month')
		await updateSchedule()
  }
  
  async function prev () {
		currentDate = currentDate.subtract(1, 'month')
		await updateSchedule()
	}
	
	export let fetchSchedule
</script>

<style>
	.scheduler {
		width: 100%;
	}
	
	:global(.navigation .button svg) {
		stroke: grey;
		height: 16px;
		width: 16px;
	}

	.month {
		display: flex;
		flex-direction: column;
	}
	
	.week, .header, .navigation {
		display: flex;
		flex-direction: row;
	}

	.header {
		height: 48px;
		display: flex;
	}
	
	.navigation {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin: 12px 0;
	}

	.navigation .button {
		border: 0;
		background-color: transparent;
	}

	.navigation .button,
	.navigation .current-month {
		font-size: 16px;
		display: flex;
		align-items: center;
		font-weight: 500;
	}
	
	.day-name {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--beyonk-widget-theme);
		font-weight: 500;
		border: 1px solid white;
	}

	.week {
		display: flex;
		flex-direction: row;
		width: 100%;
		justify-content: space-evenly;
	}
	
	.day {
		position: relative;
		width: 100%;
		border: 1px solid transparent;
		display: flex;
		padding: 12px;
	}

	.day::after,
	.day-name::after {
		content: '';
		display: block;
		padding-bottom: 100%;
	}
		
	.day .content {
		display: flex;
		flex: 1;
	}

	.day .number {
		position: absolute;
		top: 0;
		left: 0;
		font-size: 16px;
		color: darkgrey;
		margin: 6px;
	}

	.day.is-valid {
		border-right: 1px solid lightgrey;
		border-bottom: 1px solid lightgrey;
	}

	.day.is-valid:first-of-type {
		border-left: 1px solid lightgrey;
	}

	.day.d-1,
	.day.d-2,
	.day.d-3,
	.day.d-4,
	.day.d-5,
	.day.d-6,
	.day.d-7 {
		border-top: 1px solid lightgrey;
	}

	.day.d-1 {
		border-left: 1px solid lightgrey;
	}
</style>
