<div class="title">
    <h2>Users of organization <span class="organization"></span></h2>
    <a href="/users/new?organizationID=" class="button">New</a>
</div>

<table>
    <tr>
        <th style="width:50%">Username</th>
        <th>Organization admin</th>
        <th>Remove from organization</th>
    </tr>
</table>

<form onsubmit="return UserPages.submitAddUser(this)">
    <fieldset class="with-border-button">
        <legend>Add existing user</legend>
        <label>
            Username
            <input list="usersList" name="username" autocomplete="off">
        </label>
        <label class="checkbox">
            <input type="checkbox" name="isAdmin">
            Organization admin
        </label>
        <input type="submit" value="Add" class="border-button">
    </fieldset>
    <datalist id="usersList"></datalist>
</form>
