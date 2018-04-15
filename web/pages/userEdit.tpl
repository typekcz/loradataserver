<div class="title">
    <h2>User <span class="username"></span></h2>
    <button class="delete" onclick="UserPages.deleteCurrent()">Delete</button>
</div>

<form onsubmit="return UserPages.submit(this)">
    <label>
        Username
        <input type="text" name="username" required>
    </label>
    <label>
        Email
        <input type="email" name="email" required>
    </label>
    <label>
        Note
        <textarea name="note"></textarea>
    </label>
    <label class="password">
        Password
        <input type="password" name="password" min="6" required>
    </label>
    <label class="checkbox">
        <input type="checkbox" name="isAdmin">
        Is admin
    </label>
	<input type="submit" value="Save">
</form>
