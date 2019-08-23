<div class="outer">
  <div class="dot" style="background-color: {randomColour()}"></div>
  <div class="info" style="background-color: {randomColour()}">
    {info()}
  </div>
</div>

<style>
  .outer {
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: 100%;
    width: 100%;
  }

  .dot {
    display: none;
    height: 10px;
    width: 10px;
    border-radius: 50%;
  }

  .info {
    display: flex;
    border-radius: 5px;
    padding: 3px 6px;
  }

  @media only screen and (max-device-width: 700px) {
    .dot {
      display: flex;
    }

    .info {
      display: none;
    }
  }
</style>

<script>
  import randomColour from './colours.js'

  export let events

  function info () {
    return `${events.length} event${events.length > 1 ? 's' : ''}`
  }
</script>