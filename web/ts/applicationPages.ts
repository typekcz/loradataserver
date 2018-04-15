/// Page with appliaction device statistics.
class ApplicationPages {
    private static pane: HTMLElement;
    private static appId: number;

    /// Date from which statistics are displayed to the current date.
    private static startDate: Date;

    /**
	 * Shows application page
	 * @param p URL parameters, first parameter with application ID is required
	 */
    public static async show(p: string[]){
        this.pane = <HTMLFormElement>App.getContentPane("page");
        this.pane.innerHTML = await (await fetch("/pages/application.tpl")).text();
        this.appId = parseInt(p[0]);

        await Loader.loadGoogleMaps();
        await Loader.loadGoogleCharts();

        let app = await DAO.getApplication(this.appId);
        document.title = "Application " + app.name;
        (this.pane.querySelector("h2 .name") as HTMLElement).innerText = app.name;

        if(await App.getPermissionsForApp(this.appId) < Permissions.WRITE){
            for(let a of this.pane.querySelectorAll("h2 a")){
                (a as HTMLElement).hidden = true;
            }
        }

        this.startDate = new Date();
        this.startDate.setDate(this.startDate.getDate() - 2);

        let devicesEl = this.pane.querySelector(".devices");

        App.switchToContentPane("page");

        for(let dev of await DAO.getDeviceList(this.appId, true)){
            let stats = await DAO.getDeviceStats(dev.devEUI, this.startDate);
            let chartEl = buildElement("div", {class: "chart"});
            let devEl = buildElement("div", {}, [
                buildElement("h4", {}, dev.name),
                chartEl
            ]);
            devicesEl.appendChild(devEl);

            let table = new google.visualization.DataTable();
            table.addColumn("datetime", "Time");
            table.addColumn("number", "RX Packets Received");
            table.addColumn("number", "TX Packets Emited");
            table.addColumn("number", "Errors");
            table.addColumn("number", "ACKs");

            for(let r of stats){
                table.addRow([
                    new Date(r.time),
                    r.rxReceived,
                    r.txEmitted,
                    r.errors,
                    r.acks
                ]);
            }

            // This makes Google Charts fill parent's width.
            returnControlToBrowser();

            let chart = new google.visualization.ColumnChart(chartEl);
            chart.draw(table, {
                height: 300,
                vAxis: {
                    viewWindowMode: "explicit",
                    viewWindow: {
                        min: 0
                    }
                },
                hAxis: {
                    format: "HH:mm"
                },
                bar: {
                    groupWidth: "100%",
                },
                isStacked: true,
                legend: {position: 'bottom'},
                /*chartArea: {
                    left: "10%",
                    top: "3%",
                    height: "90%",
                    width: "80%"
                },*/
            })
        }
    }
}
