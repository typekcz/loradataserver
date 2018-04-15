/// Pages for user manupulation.
class UserPages {
    private static pane: HTMLElement;
    private static userId: number;
    private static orgId: number;
    private static users: Map<string, number> = new Map<string, number>();

    /**
	 * Shows page with table of all users.
	 * @param p URL parameters, none are used
	 */
    public static async show(p){
        this.pane = App.getContentPane("page");
        this.pane.innerHTML = await (await fetch("/pages/users.tpl")).text();

        document.title = "Users";

        let table = this.pane.querySelector("table") as HTMLTableElement;

        let users = (await (await fetch(
            config.rest + "/users?limit=100", {
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        )).json()).result;

        for(let user of users){
            let row = table.insertRow(-1);
            this.addUserToTable(table, user, false);
        }

        App.switchToContentPane("page");
    }

    /**
	 * Shows page with table of organization users.
	 * @param p URL parameters, the first parameter with organization ID is required
	 */
    public static async showOrg(p: string[]){
        this.pane = App.getContentPane("page");
        this.pane.innerHTML = await (await fetch("/pages/organizationUsers.tpl")).text();

        this.orgId = parseInt(p[0]);
        let org = await DAO.getOrganization(this.orgId);
        let orgAdmin = (await App.getPermissionsForOrg(this.orgId)) >= Permissions.ADMIN;

        document.title = "Users of organization " + org.name;
        (this.pane.querySelector(".title .organization") as HTMLElement).innerText = org.name;

        (this.pane.querySelector(".title a") as HTMLLinkElement).href += this.orgId.toString();

        let table = this.pane.querySelector("table") as HTMLTableElement;
        if(orgAdmin)
            table.classList.remove("hide3col");
        else
            table.classList.add("hide3col");

        (this.pane.querySelector("form") as HTMLElement).hidden = !orgAdmin;
        (this.pane.querySelector(".title a") as HTMLElement).hidden = !orgAdmin;

        let users = (await (await fetch(
            config.rest + "/organizations/" + encodeURIComponent(this.orgId.toString()) + "/users?limit=100", {
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        )).json()).result;

        let usersDatalist = document.getElementById("usersList") as HTMLDataListElement;

        for(let user of users){
            this.addUserToTable(table, user, true, !orgAdmin);
        }

        users = (await (await fetch(
            config.rest + "/users?limit=100", {
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        )).json()).result;

        this.users.clear();
        for(let user of users){
            this.users.set(user.username, parseInt(user.id));
            let option = document.createElement("OPTION") as HTMLOptionElement;
            option.value = option.innerText = user.username;
            usersDatalist.appendChild(option);
        }

        App.switchToContentPane("page");
    }

    /**
	 * Adds row with user in table.
     * @param org if table is of organization users
     * @param noLink if link for editing user should not be inserted
	 */
    private static addUserToTable(table: HTMLTableElement, user: User, org?: boolean, noLink?: boolean){
        let row = table.insertRow(-1);
        row.insertCell(0).appendChild(
            buildElement(((noLink)? "span" : "a"), {
                href: "/users/" + encodeURIComponent(user.id.toString())
            }, user.username)
        );

        if(!org){
            let cell = row.insertCell(1);
            if(user.isActive)
                cell.innerHTML = "&#x2714;";
            else
                cell.innerHTML = "&#x2716;";
            cell.style.textAlign = "center";
        }

        let cell = row.insertCell(org? 1 : 2);
        if(user.isAdmin)
            cell.innerHTML = "&#x2714;";
        else
            cell.innerHTML = "&#x2716;";
        cell.style.textAlign = "center";

        if(org){
            cell = row.insertCell(2);
            let btn = document.createElement("BUTTON");
            cell.appendChild(btn);
            btn.innerHTML = "&#x2716;";
            btn.onclick = () => {
                UserPages.removeFromOrg(row, user.id);
            };
            cell.style.textAlign = "center";
        }
    }

    /**
	 * Prepares panel with user edit form.
	 */
    public static async prepareEditPage(){
        this.pane = App.getContentPane("page");
        this.pane.innerHTML = await (await fetch("/pages/userEdit.tpl")).text();
    }

    /**
	 * Shows page with form for creating new user.
	 * @param p URL parameters, none are used
	 */
    public static async showNew(p: string[]){
        await this.prepareEditPage();
        (this.pane.querySelector(".title .delete") as HTMLElement).hidden = true;
        this.userId = null;
        App.switchToContentPane("page");
    }

    /**
	 * Show page with form for editing user.
	 * @param p URL parameters, the first parameter with user ID is required
	 */
    public static async showEdit(p: string[]){
        await this.prepareEditPage();
        this.userId = parseInt(p[0]);

        let user = await (await fetch(
            config.rest + "/users/" + encodeURIComponent(this.userId.toString()), {
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        )).json();

        let form = this.pane.querySelector("form");
        (form.querySelector(".password") as HTMLElement).style.display = "none";
        (form.querySelector("[name=password]") as HTMLInputElement).disabled = true;

        Transparency.render(form, user);

        App.switchToContentPane("page");
    }

    /**
	 * Deletes currently viewed user.
	 */
    public static async deleteCurrent(){
        let res = await fetch(
            config.rest + "/users/" + encodeURIComponent(this.userId.toString()), {
                method: "DELETE",
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        );

        if(res.ok){
            alert("User deleted.");
            window.history.back();
            App.handleLocation();
        } else {
            let body = await res.json();
            alert("Deleting failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
        }
    }

    /**
	 * Removes user from organization.
	 * @param row with user to remove, that will also be removed
	 */
    public static async removeFromOrg(row: HTMLTableRowElement, userID){
        let res = await fetch(
            config.rest + "/organizations/" + encodeURIComponent(this.orgId.toString()) + "/users/" + encodeURIComponent(userID.toString()), {
                method: "DELETE",
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        );
        if(res.ok){
            row.parentElement.removeChild(row);
            alert("User removed from organization.");
        } else {
            let body = await res.json();
            alert("\r\nRemoving user from organization failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
        }
    }

    /**
	 * Method for submiting new user.
	 * @param form that was submitted
	 */
    public static submitAddUser(form: HTMLFormElement){ (async () => {
        let isAdmin = form["isAdmin"].checked;
        let usernameInput = form["username"] as HTMLInputElement;
        let username = usernameInput.value;
        if(!this.users.has(username)){
            usernameInput.setCustomValidity("This user does not exist.");
            form.reportValidity();
            usernameInput.setCustomValidity("");
        } else {
            let userID = this.users.get(username);
            let res = await fetch(
                config.rest + "/organizations/" + encodeURIComponent(this.orgId.toString()) + "/users", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "grpc-metadata-authorization": await App.getJWT()
                    },
                    body: JSON.stringify({
                        id: this.orgId,
                        isAdmin,
                        userID
                    })
                }
            );

            if(res.ok){
                alert("\r\nUser added to organization.");
                form.reset();
                this.addUserToTable(this.pane.querySelector("table"), {
                    username,
                    isAdmin,
                    id: userID
                }, true);
            } else {
                let body = await res.json();
                alert("\r\nAdding user to organization failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
            }
        }
    })(); return false; }

    /**
	 * Handles user edit form submit.
	 */
    public static submit(){ (async () => {
        let queryParams = new URLSearchParams(window.location.search);
        let form = this.pane.querySelector("form") as HTMLFormElement;
        let formData = parseForm(form, true);
        formData.isActive = true;
        let isAdmin = formData.isAdmin == "on";
        if(queryParams.has("organizationID"))
            delete formData.isAdmin;
        else
            formData.isAdmin = isAdmin;
        let res = await fetch(
            config.rest + "/users" + ((this.userId)? "/" + encodeURIComponent(this.userId.toString()) : ""), {
                method: ((this.userId)? "PUT" : "POST"),
                headers: {
                    "content-type": "application/json",
                    "grpc-metadata-authorization": await App.getJWT()
                },
                body: JSON.stringify(formData)
            }
        );

        let message = "";
        if(res.ok){
            let userID = (await res.json()).id;
            console.log(userID);
            message += "User saved."

            if(userID != null && queryParams.has("organizationID")){
                let orgId = parseInt(queryParams.get("organizationID"));
                res = await fetch(
                    config.rest + "/organizations/" + encodeURIComponent(orgId.toString()) + "/users", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                            "grpc-metadata-authorization": await App.getJWT()
                        },
                        body: JSON.stringify({
                            id: orgId,
                            isAdmin,
                            userID
                        })
                    }
                );

                if(res.ok){
                    message += "\r\nUser added to organization.";
                    form.reset();
                } else {
                    let body = await res.json();
                    message += "\r\nAdding user to organization failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText);
                }
            }
        } else {
            let body = await res.json();
            message += "Saving user failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText);
        }

        alert(message);
    })(); return false; }
}
