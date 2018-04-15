var appId = null;
var view = null;
var params = {};
var jwt = null;
var options:any = {
	chartType: "LineChart"
};

var documentReady = false;

async function init(){
    let queryParams = location.search.substr(1).split("&").reduce((res, item) => {
        let p = item.split("=");
        res[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
        return res;
    }, {});
    appId = queryParams["appId"];
    view = queryParams["view"];
    let i = 0;
    while(typeof(queryParams[i]) !== "undefined"){
        params[i] = queryParams[i];
        i++;
    }

    google.charts.load('current', {'packages':['corechart', 'map']});
    var chartsLoad = new Promise((resolve, reject) => {
        try {
            google.charts.setOnLoadCallback(resolve);
        } catch(e){
            reject(e);
        }
    });
    var domLoad = new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", (event) => {
        	resolve();
        });
    });
    await Promise.all([chartsLoad, domLoad]);

    let response = await fetch(
		"/api/applications/" + encodeURIComponent(appId) + "/views/" + encodeURIComponent(view) + "/options",
		((jwt)? {headers: {"grpc-metadata-authorization": jwt}} : null)
	);
	Object.assign(options, await response.json());

    documentReady = true;
    show();
}

window.addEventListener("message", (event) => {
    console.log("message", event.data);
    if(event.data.appId)
        appId = event.data.appId;
    if(event.data.view)
        view = event.data.view;
    if(event.data.params instanceof Object)
        params = event.data.params;
	if(event.data.options instanceof Object)
        Object.assign(options, event.data.options);
	if(event.data.jwt)
        jwt = event.data.jwt;
    if(documentReady)
        show();
});

async function show(){
    if(appId && view){
        let data = await getData(appId, view, params);
        draw(data);
    }
}

async function getData(appId: string, view: string, params?: {}){
    let url = "/api/applications/" + encodeURIComponent(appId) + "/views/" + encodeURIComponent(view) + "/data";
    if(typeof(params) === "object")
        url += "?" + queryString(params);
    let res = await fetch(
		url,
		((jwt)? {headers: {"grpc-metadata-authorization": jwt}} : null)
	);
    let json = await res.json();
    if(!res.ok)
        throw new Error(json.error.message);
    return json;
}

function draw(data){
    let table = new google.visualization.DataTable();
    for(let col of data.fields){
        let type = col.type;
        if(["integer", "float"].indexOf(type) >= 0)
            type = "number";
        table.addColumn(type, col.name);
    }
    for(let row of data.result){
        let rowArray = [];
        for(let col of data.fields){
            let val = row[col.name];
            if(col.type == "date")
                val = new Date(val);
            rowArray.push(val);
        }
        table.addRow(rowArray);
    }

    var chart = new google.visualization[options.chartType](document.body);
	console.log("drawOptions", options);
    chart.draw(table, options);

}


function queryString(data: Object){
	return Object.keys(data).map(
		key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
	).join("&");
}

init();
