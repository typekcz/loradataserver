/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

import * as URL from "url";
import * as HTTP from "http";
import * as FS from "fs";
import * as PATH from "path";
import ApiNode from "./apinode";
import {WebServer} from "./web_server";
import {Auth} from "./auth";
import LoRaAppServerRest from "./loraappserver_rest";
import {DatasetsDAO, DevicesDAO, ViewsDAO, ApplicationsDAO} from "./dao";
import {webServer as webSrvInstance} from "./main";
import * as Utils from "./utils";

/// REST API tree for this application.
export var apiTree = new class extends LoRaAppServerRest.ApiNode {
	isLeaf = false;
	children = {
		applications: new class extends LoRaAppServerRest.ApiNode {
			isLeaf = false;

			param = new class extends LoRaAppServerRest.ApiNode {
				isLeaf = false;

				children = {
					query: new class extends ApiNode {
						public async post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let query: string = await WebServer.getRequestBody(request, false);
							let appID = parseInt(params[0]);
							let result = await DatasetsDAO.query(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								appID, query
							);
							ApiNode.singleObjectOutput(request, response, result);
						}
					},
					datasets: new class extends ApiNode {
						public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let tables: string[] = await DatasetsDAO.list(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								parseInt(params[0])
							);
							ApiNode.collectionOutput(request, response, tables);
						}

						public async post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let dataset = await WebServer.getRequestBody(request);
							console.log(dataset);
							if(!(dataset instanceof Object)){
								ApiNode.error(request, response, "Received body could not be parsed to object. Content type may be missing.");
								return;
							}
							await DatasetsDAO.create(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								parseInt(params[0]), dataset.name, dataset.columns
							);
							response.writeHead(200);
							response.end();
						}

						param = new class extends ApiNode {
							public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								let query = WebServer.getQueryParamsWithoutArrays(request);
								let search = null;
								if(query["search"])
									search = JSON.parse(query["search"]);
								let result = await DatasetsDAO.select(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									parseInt(params[0]), params[1], search,
									(query["limit"])? parseInt(query["limit"]) : null,
									(query["offset"])? parseInt(query["offset"]) : null
								);
								ApiNode.collectionOutput(
									request, response, result.rows,
									(typeof(query["fields"]) != "undefined")? result.columns: null,
									result.totalCount
								);
							}

							public async put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								let data = await WebServer.getRequestBody(request);
								await DatasetsDAO.insert(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									parseInt(params[0]), params[1], data
								);
								response.writeHead(200);
								response.end();
							}

							public async delete(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								await DatasetsDAO.delete(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									parseInt(params[0]), params[1]
								);
								response.writeHead(200);
								response.end();
							}
						}
					},
					views: new class extends ApiNode {
						public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let views = await ViewsDAO.select(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								parseInt(params[0])
							);
							ApiNode.collectionOutput(request, response, views);
						}

						public async post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let view = await WebServer.getRequestBody(request);
							if(!(view instanceof Object)){
								ApiNode.error(request, response, "Received body could not be parsed to object. Content type may be missing.");
								return;
							}
							view.applicationID = parseInt(params[0]);
							await ViewsDAO.insert(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								view
							);
							response.writeHead(200);
							response.end();
						}

						param = new class extends ApiNode {
							public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								let view = await ViewsDAO.selectOne(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									parseInt(params[0]), params[1]
								);
								ApiNode.singleObjectOutput(request, response, view);
							}

							public async put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								let view = await WebServer.getRequestBody(request);
								if(!(view instanceof Object)){
									ApiNode.error(request, response, "Received body could not be parsed to object. Content type may be missing.");
									return;
								}
								view.applicationID = parseInt(params[0]);
								view.name = params[1];
								await ViewsDAO.update(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									view
								);
								response.writeHead(200);
								response.end();
							}

							public async delete(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
								ViewsDAO.delete(
									new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
									parseInt(params[0]),	// appID
									params[1]				// viewName
								);
								response.writeHead(200);
								response.end();
							}

							children = {
								data: new class extends ApiNode {
									public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
										let queryParams = WebServer.getQueryParamsWithoutArrays(request);
										let paramValues = [];
										let auth = new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"]));
										let viewParams = await ViewsDAO.selectParams(
											auth,
											parseInt(params[0]), params[1]
										);
										for(let i = 0; i < viewParams.length; i++){
											let queryParam = queryParams[i + 1];
											if(typeof(queryParam) === "undefined"){
												throw new Error("Parameter " + (i + 1) + " missing.");
											} else {
												paramValues.push(queryParam);
											}
										}
										let data = await ViewsDAO.selectViewData(
											auth,
											parseInt(params[0]), params[1], paramValues
										);
										ApiNode.collectionOutput(request, response, data.rows, data.columns);
									}
								},
								options: new class extends ApiNode {
									public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
										let options = await ViewsDAO.selectOptions(
											new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
											parseInt(params[0]), params[1]
										);
										ApiNode.singleObjectOutput(request, response, options);
									}
								}
							}
						}
					}
				}

				param = new LoRaAppServerRest.ApiNode();
			}
		},
		devices: new class extends LoRaAppServerRest.ApiNode {
			isLeaf = false;

			param = new class extends LoRaAppServerRest.ApiNode {
				isLeaf = false;

				public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
					let device = await DevicesDAO.selectOne(
						new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
						params[0]
					);
					ApiNode.singleObjectOutput(request, response, device);
				}

				public async put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
					let device = await WebServer.getRequestBody(request);
					device.devEUI = params[0];
					await DevicesDAO.update(
						new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
						device
					);
					response.writeHead(200);
					response.end();
				}

				children = {
					stats: new class extends ApiNode {
						public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
							let devEUI = params[0];
							let queryParams = WebServer.getQueryParamsWithoutArrays(request);
							let from = (queryParams["from"]? new Date(queryParams["from"]) : null);
							let to = (queryParams["to"]? new Date(queryParams["to"]) : null);
							let stats = await DevicesDAO.selectStats(
								new Auth(Utils.unarray(request.headers["grpc-metadata-authorization"])),
								devEUI,
								from, to
							);
							ApiNode.collectionOutput(request, response, stats);
						}
					}
				}
			}
		},
		info: new class extends ApiNode {
			children = {
				visualizers: new class extends ApiNode {
					public async get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
						let visualizersPath = PATH.join(webSrvInstance.getWebPath(), "visualizers");
						let visualizers = [];
						let folders = await Utils.promisify((c) => FS.readdir(visualizersPath, c));
						for(let folder of folders){
							try {
								let visDir = PATH.join(visualizersPath, folder);
								let stat: FS.Stats = await Utils.promisify((c) => FS.lstat(visDir, c));
								if(!stat.isDirectory())
									continue;
								let visInfoFile = await Utils.promisify((c) => FS.readFile(PATH.join(visDir, "info.json"), c));
								let visualizer = JSON.parse(visInfoFile.toString());
								visualizer.name = folder;
								visualizers.push(visualizer);
							} catch(err){
								console.error(err);
							}
						}
						ApiNode.collectionOutput(request, response, visualizers);
					}
				}
			}
		}
	}
}
