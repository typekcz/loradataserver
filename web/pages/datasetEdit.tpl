<h2>Dataset</h2>
<form onsubmit="return DatasetPages.submit(this)">
	<input type="hidden" name="appId">
	<label>
		Name
		<input type="text" name="name">
	</label>
	<template class="column">
		<div class="column deletable">
			<button class="delete" onclick="deleteParent(this)">&#10006;</button>
			<label>
				Name
				<input type="text" name="columns[].name">
			</label>
			<label>
				Type
				<select name="columns[].type">
					<option value="string">string</option>
					<option value="binary">binary</option>
					<option value="boolean">boolean</option>
					<option value="integer">integer</option>
					<option value="float">float</option>
					<option value="date">date</option>
				</select>
			</label>
			<label>
				Size
				<input type="number" name="columns[].size">
			</label>
			<label class="checkbox">
				<input type="checkbox" name="columns[].key">
				Primary key
			</label>
		</div>
	</template>
	<fieldset>
		<legend>Columns</legend>
		<div class="columns"></div>
		<button onclick="DatasetPages.addDatasetCol()" type="button" class="border-button">Add column</button>
	</fieldset>
	<input type="submit" value="Save">
</form>
