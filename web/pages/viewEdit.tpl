<div class="title">
    <h2>View <span class="viewName"></span></h2>
    <button class="delete" onclick="ViewPages.deleteCurrent()">Delete</button>
</div>

<form onsubmit="return ViewPages.submit(this)" id="editViewForm">
    <label>
        Name
        <input type="text" name="name" required>
    </label>
    <label class="checkbox">
        <input type="checkbox" name="public">
        Public
    </label>
    <fieldset class="radio-group">
        <legend>Data selection method</legend>
        <label><input type="radio" name="formtype" value="simple" onclick="ViewPages.editFormTypeChanged(this)" checked> Simple</label>
        <label><input type="radio" name="formtype" value="advanced" onclick="ViewPages.editFormTypeChanged(this)"> Advanced</label>
    </fieldset>
    <div class="simple">
        <div>
            <label>
                Dataset
                <select name="dataset" onchange="ViewPages.datasetChanged(this)" required></select>
            </label>
        </div>
        <template class="select">
            <div><label><input type="checkbox" name="query.select[]"> <span></span></label></div>
        </template>
        <fieldset class="radio-group">
            <legend>Select columns</legend>
            <div class="cols"></div>
        </fieldset>
        <template class="condition">
            <div class="condition">
                <select name="query.conditions[].column" class="column"></select>
                <select name="query.conditions[].operator" class="operator">
                    <option value="" disabled selected>Operator</option>
                    <option value="eq">=</option>
                    <option value="ne">&ne;</option>
                    <option value="gt">&gt;</option>
                    <option value="ge">&ge;</option>
                    <option value="lt">&lt;</option>
                    <option value="le">&le;</option>
                    <option value="li" data-for="string">LIKE</option>
                    <option value="nl" data-for="string">NOT LIKE</option>
                </select>
                <input type="checkbox" name="query.conditions[].param" class="param">
                <span data-comp="value">
                    <input type="text" name="query.conditions[].value" data-for="string">
                    <input type="number" name="query.conditions[].value" data-for="integer" step="1" hidden>
                    <input type="number" name="query.conditions[].value" data-for="float" step="any" hidden>
                    <span data-for="date" hidden>
                        <input type="hidden" name="query.conditions[].value" placeholder="Value">
                        <input type="date" oninput="dateTimeInput(this)" placeholder="Value">
                        <input type="time" oninput="dateTimeInput(this)" placeholder="Value">
                    </span>
                </span>
                <span data-comp="param" hidden>
                    <label>
                        Description
                        <input type="text" name="query.conditions[].paramDesc" class="desc" placeholder="Description">
                    </label>
                </span>
            </div>
        </template>
        <fieldset class="with-border-button">
            <legend>Conditions</legend>
            <div class="conditions"></div>
            <button type="button" class="border-button" onclick="ViewPages.addCondition()">Add condition</button>
        </fieldset>
    </div>
    <div class="advanced" hidden>
        <label>
            SQL Query
            <textarea name="query" required disabled></textarea>
        </label>
        <template class="param">
            <div class="param deletable">
                <button class="delete" onclick="deleteParent(this)">&#10006;</button>
                <label>
                    Type
                    <select name="params[].type" class="type" required>
                        <option value="string">string</option>
                        <option value="binary">binary</option>
                        <option value="boolean">boolean</option>
                        <option value="integer">integer</option>
                        <option value="float">float</option>
                        <option value="date">date</option>
                    </select>
                </label>
                <label>
                    Description
                    <input type="text" name="params[].description" class="desc" required>
                </label>
            </div>
        </template>
        <fieldset class="with-border-button">
            <legend>Parameters</legend>
            <div class="params"></div>
            <button type="button" class="border-button" onclick="ViewPages.addParameter()">Add parameter</button>
        </fieldset>
    </div>
    <label>
        Visualizer
        <select name="visualizer" onchange="ViewPages.visualizerChanged(this.value)" required></select>
    </label>
</form>
<fieldset>
    <legend>Visualizer options</legend>
    <form class="options"></form>
</fieldset>
<input type="submit" form="editViewForm">
