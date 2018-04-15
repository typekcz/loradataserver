<div class="title">
    <h2>View <span class="viewName"></span></h2>
    <a href="edit" class="button">Edit</a>
    <button onclick="ViewPages.generateEmbed()">Embed code</button>
</div>
<textarea id="clipboard-helper" readonly style="width: 0; height: 0; opacity:0; resize: none; border: 0"></textarea>
<template class="param-date">
    <label>
        <span class="description"></span>
        <div class="datetime">
            <input type="date">
            <input type="time">
        </div>
    </label>
</template>
<template class="param-float">
    <label>
        <span class="description"></span>
        <input type="number" step="any">
    </label>
</template>
<template class="param-integer">
    <label>
        <span class="description"></span>
        <input type="number" step="1">
    </label>
</template>
<template class="param-string">
    <label>
        <span class="description"></span>
        <input type="text">
    </label>
</template>
<form onsubmit="return ViewPages.submitParams(event)">
    <fieldset class="with-border-button">
        <legend>Parameters</legend>
        <div class="params"></div>
        <input type="submit" class="border-button">
    </fieldset>
</form>
<div class="iframeContainer">
    <iframe class="viewIframe" style="width:100%;height:300px"></iframe>
</div>
<!--<form class="optionsForm">
    <div class="options"></div>
    <input type="submit" value="Update options">
</form>-->
