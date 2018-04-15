<h2>Device <span data-bind="name"></span></h2>
<form onsubmit="return DevicePages.submit(this)">
    <label>
        Dev EUI
        <input type="text" readonly name="devEUI">
    </label>
    <label>
        Description
        <input type="text" readonly name="description">
    </label>
    <fieldset class="radio-group">
        <legend>Received data processing</legend>
        <label><input type="radio" name="formtype" value="auto" onclick="DevicePages.editFormTypeChanged(this)" checked> Automatic JSON</label>
        <label><input type="radio" name="formtype" value="custom" onclick="DevicePages.editFormTypeChanged(this)"> Custom</label>
    </fieldset>
    <fieldset>
        <legend>Position</legend>
        <label>
            Latitude
            <input type="number" name="latitude" step="any">
        </label>
        <label>
            Longitude
            <input type="number" name="longitude" step="any">
        </label>
    </fieldset>
    <div class="auto">
        <label>
            Dataset
            <select name="dataset">
                <option data-bind="dataset"></option>
            </select>
        </label>
    </div>
    <div class="custom" hidden>
        <label>
            Receive function
            <textarea name="receiveFunction"></textarea>
        </label>
    </div>
    <input type="submit" value="Save">
</form>
