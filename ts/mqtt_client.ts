import {DatasetsDAO, DevicesDAO, ApplicationsDAO} from "./dao";
import * as MQTT from "mqtt";
import * as CONF from "config";
import {VM, VMScript} from "vm2";
import {Auth} from "./auth";

/**
 * MQTT client subscribing device topics.
 */
export class MyMQTTClient {
	private static re_node_rx = /^application\/[0-9]*\/node\/([0-9a-fA-F]*)\/([a-zA-Z]*)$/;
	private static mqttClient;

	public static connect(){
		this.mqttClient = MQTT.connect(
			CONF.get("connections.mqtt.url"),
			CONF.get("connections.mqtt.options")
		);
		this.mqttClient.on("message", (topic, message) => {
			console.log("mqtt_client> Received message, topic: " + topic);
			let result = this.re_node_rx.exec(topic);
			if(result){
				switch(result[2]){
					case "rx":
						MyMQTTClient.handleRXMessage(result[1], message);
						DevicesDAO.addDeviceStats(result[1], 1, 0, 0, 0);
						break;
					case "tx":
						DevicesDAO.addDeviceStats(result[1], 0, 1, 0, 0);
						break;
					case "ack":
						DevicesDAO.addDeviceStats(result[1], 0, 0, 0, 1);
						break;
					case "error":
						DevicesDAO.addDeviceStats(result[1], 0, 0, 1, 0);
						break;
					default:
						console.log("mqtt_client> Topic not handled.");
						break;
				}
			}
		});
		this.mqttClient.on("error", function(error){
			console.log("mqtt_client> Error: " + error);
		});
		this.mqttClient.on("connect", function(){
			console.log("mqtt_client> Connected");
		});
		this.mqttClient.subscribe("#");
		console.log("mqtt_client> Connecting");
	}

	/**
	 * Handles message with received data from device.
	 */
	private static async handleRXMessage(devEUI: string, message){
		try {
			message = JSON.parse(message);
			//console.log(message);
			var received_time = null;
			message.data = new Buffer(message.data, 'base64').toString();

			if(typeof(message.rxInfo[0].time) !== "undefined")
				received_time = message.rxInfo[0].time;
			else if(typeof(message.time) !== "undefined")
				received_time = message.time;

			let time = Math.round(new Date().getTime()/1000);
			let device = await DevicesDAO.selectOneLocalOnly(devEUI);
			let appId = parseInt(device.applicationID.toString());
			let data = message.data;
			console.log(data);

			if(!device.receiveFunction){
				console.log("no receive function");
				if(device.dataset)
					DatasetsDAO.insert(Auth.getServerAdminAuth(), appId, device.dataset, JSON.parse(data));
				else
					console.log("no dataset");
				return;
			}

			// Functions provided in VM

			/**
			 * Inserts a row into a table in the application schema where the device belongs.
			 */
			function datasetInsert(table, value){
				DatasetsDAO.insert(Auth.getServerAdminAuth(), appId, table, value);
			}

			/**
			 * Performs a query on application schema.
			 */
			function sqlQuery(query){
				DatasetsDAO.query(Auth.getServerAdminAuth(), appId, query);
			}

			/**
			 * Sets device location.
			 */
			function setLocation(latitude, longitude){
				DevicesDAO.update(Auth.getServerAdminAuth(), {
					devEUI,
					latitude,
					longitude
				});
			}

			/**
			 * Sends downlink back to device.
			 */
			function sendDownlink(data, confirmed = true){
				MyMQTTClient.sendDownlink(appId, devEUI, data, confirmed);
			}

			const vm = new VM({
				timeout: 1000, // TODO: Configuration of timeout.
				sandbox: {
					receivedTime: received_time,
					data: data,
					Datasets: {
						insert: datasetInsert
					},
					sqlQuery: sqlQuery,
					Device: {
						setLocation: setLocation,
						sendDownlink: sendDownlink
					}
				}
			});

			console.log(device.receiveFunction);
			vm.run(device.receiveFunction);
		} catch(error){
			console.error(error);
		}
	}

	/**
	 * Sends a downlink message to the MQTT that should be sent to the specified device.
	 * @param confirmed should device acknowledge receipt
	 */
	public static sendDownlink(appId: number, devEUI: string, data: string, confirmed: boolean = true){
		this.mqttClient.publish(
			"application/" + appId.toString() + "/node/" + devEUI + "/tx",
			JSON.stringify({
				reference: (new Date()).toISOString(),
				confirmed: confirmed,
				fPort: 10,
				data: data
			})
		)
	}
}
