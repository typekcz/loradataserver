/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

class OrganizationPages {
	private static pane: HTMLElement;
	private static gateways: HTMLElement;
	private static orgId: number;
	public static map: google.maps.Map;
	public static bounds: google.maps.LatLngBounds;

	private static startDate: Date;
	private static endDate: Date;

	/**
	 * Shows organization page with gateway statistics and map showing gateways and devices.
	 * @param p URL parameters, first parameter with organization ID is required
	 */
	public static async show(p: string[]){
		this.pane = <HTMLFormElement>App.getContentPane("page");
		this.pane.innerHTML = await (await fetch("/pages/organization.tpl")).text();
		this.orgId = parseInt(p[0]);

		let org = await DAO.getOrganization(this.orgId);
		document.title = "Organization " + org.name;
		(this.pane.querySelector("h2 .name") as HTMLElement).innerText = org.name;

		this.gateways = this.pane.querySelector(".gateways");

		await Loader.loadGoogleMaps();
		await Loader.loadGoogleCharts();
		this.showStats();
	}

	/**
	 * Shows map and gateway statistics.
	 */
	public static async showStats(){
		this.map = new google.maps.Map(this.pane.querySelector('.map'), {
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		this.bounds = new google.maps.LatLngBounds();

		let promises = [];
		this.endDate = new Date();
		this.startDate = new Date();
		this.startDate.setDate(this.startDate.getDate() - 7);

		App.switchToContentPane("page");

		// This makes Google Charts fill parent's width.
		returnControlToBrowser();

		for(let gw of await DAO.getGateways(this.orgId)){
			promises.push(this.addGateway(gw.mac));
		}

		for(let app of await DAO.getApplicationList(this.orgId)){
			let devices = await DAO.getDeviceList(app.id);
			for(let device of devices)
				promises.push(this.addDeviceMarker(device.devEUI));
		}

		await Promise.all(promises);

		//this.map.fitBounds(this.bounds);
		setTimeout(() => this.map.fitBounds(this.bounds), 100);
	}

	/**
	 * Adds gateway statistics to page.
	 * @param mac address of gateway
	 */
	private static async addGateway(mac: string){
		let gw = await DAO.getGateway(mac);
		let position = new google.maps.LatLng(
			gw.latitude,
			gw.longitude
		);
		let marker = new google.maps.Marker({
			position: position,
			icon: "/img/icons8-radio-tower-32.png",
			map: this.map,
			title: gw.name
		});
		marker.addListener("click", () => {
			let infoWindow = new google.maps.InfoWindow({
				content: `<div class="detail">
					<h3>${gw.name}</h3>
					<p>${gw.description}</p>
					<p>Last seen: ${gw.lastSeenAt}</p>
				</div>`
			});
			infoWindow.open(this.map, marker);
		});
		this.bounds.extend(position);

		// List
		let chartEl = buildElement("div", {class: "chart"});
		let gwEl = buildElement("div", {}, [
			buildElement("h4", {}, gw.name),
			chartEl
		]);
		this.gateways.appendChild(gwEl);
		let gwstats = (await DAO.getGatewayStats(mac, this.startDate, this.endDate)).result;

		let table = new google.visualization.DataTable();
		table.addColumn("date", "Time");
		table.addColumn("number", "RX Packets Received");
		table.addColumn("number", "RX Packets Received OK");
		table.addColumn("number", "TX Packets Emited");
		table.addColumn("number", "TX Packets Received");

		for(let r of gwstats){
			table.addRow([
				new Date(r.timestamp),
				r.rxPacketsReceived,
				r.rxPacketsReceivedOK,
				r.txPacketsEmitted,
				r.txPacketsReceived
			]);
		}

		let chart = new google.visualization.LineChart(chartEl);
		chart.draw(table, {
			vAxis: {
				viewWindowMode: "explicit",
				viewWindow: {
					min: 0
				}
			},
			hAxis: {
				format: "yyyy-MM-dd",
				//slantedText: true
			},
			legend: {position: 'bottom'}
		})
	}

	/**
	 * Adds device marker to map.
	 */
	private static async addDeviceMarker(devEUI: string){
		let device = await DAO.getDevice(devEUI);
		if(!(device.latitude && device.longitude))
			return;
		let position = new google.maps.LatLng(
			device.latitude,
			device.longitude
		);
		let marker = new google.maps.Marker({
			position: position,
			icon: "/img/icons8-raspberry-pi-zero-32.png",
			map: this.map,
			title: device.name
		});
		marker.addListener("click", () => {
			let infoWindow = new google.maps.InfoWindow({
				content: `<div class="detail">
					<h3>${device.name}</h3>
					<p>${device.description}</p>
				</div>`
			});
			infoWindow.open(this.map, marker);
		});
		this.bounds.extend(position);
	}
}
