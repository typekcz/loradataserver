import {WebServer} from "./web_server";
import {DevicesDAO} from "./dao";
import {DB} from "./db";
import PostgresGW from "./dbgw_impl/postgresql";
import {MyMQTTClient} from "./mqtt_client";
import {apiTree} from "./apitree";

export var webServer: WebServer;

export async function main(){
	process.on("unhandledRejection", (error, p) => {
		console.error("Unhandled Promise Rejection", p, error);
	});

	process.on("exit", () => {
		// Pushes currently stored device stats in memory to database.
		DevicesDAO.pushStats();
	});

	process.on("SIGINT", process.exit);

	// Shoudl capture kill signal.
	process.on("SIGUSR1", process.exit);
	process.on("SIGUSR2", process.exit);

	DevicesDAO.startStatsTimer();

	MyMQTTClient.connect();

	DB.registerDbImpl("postgresql", PostgresGW);
  	DB.connect();

	webServer = new WebServer("web");
	webServer.start();

	webServer.apiRoot = apiTree;
}
