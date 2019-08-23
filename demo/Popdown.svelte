<div class="container">
  {#each events as event, i}
  <div class="item" class:background-on={i % 2 == 1}>
    <div class="time" style="border-right-color: {randomColour()}">{event.time}</div>
    <div class="description">
      <div>{event.name}</div>
      <div>4 guests</div>
    </div>
  </div>
  {/each}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .item {
    display: flex;
    width: 100%;
    box-sizing: border-box;
  }

  .item.background-on {
    background-color: lightgrey;
  }

  .item > .time {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    border-right: 3px solid lightblue;
    width: 4rem;
    padding: 1rem 1rem 1rem 0.75rem;
    font-size: 14px;
    font-weight: bold;
  }

  .item > .description {
    flex: 1;
    text-align: left;
    padding: 1rem 2rem 1rem 2rem;
  }
</style>

<script>
  import randomColour from './colours.js'

  export let events
</script>