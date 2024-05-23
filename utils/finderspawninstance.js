const { spawn } = require('child_process');
const fs = require('fs');
const { instanceCap, defaultSeedsToFind, noPingRoleId, jarName, ownerId } = require('../config.json');
let { versionName } = require('../config.json');
if (!versionName) versionName = jarName;
const instanceTracker = require('./instancetracker.js');
const lastRequestTracker = require('./lastrequesttracker.js');
const { parseItems } = require('./parseitems.js');

function base26ToInteger(basestr) {
		str = basestr.trim().replaceAll("-","").toLowerCase();
    let result = 0;
    for (let i = 0; i < str.length; i++) {
        result = result * 26 + (str.charCodeAt(i) - 97);
    }
    return result;
}

async function spawnInstance(request, premadeParsedItemList) {
	request.seedsToFind = request.seedsToFind ?? defaultSeedsToFind;

	return new Promise(function (resolve, reject) {
		let response = {
			responseType: "",
			errorstatus: "",
			seedList: [],
			finderOutURL: "",
			finderOut: "",
			startingTime: +new Date,
			endingTime: 0
		}

		let parsedItemList = (premadeParsedItemList || parseItems(request))
		request.itemList = parsedItemList.itemList;

		if (parsedItemList.errorstatus) {
			response.responseType = "itemError";
			response.errorstatus = parsedItemList.errorstatus;
			resolve(response);
		}

		if (request.longScan) {
			request.seedstoscan = 10000000;
			if (instanceTracker.checkLongscanUser(request.userId)){
				response.errorstatus = "longScanOngoing";
				response.responseType = "miscError"
				resolve(response);
			}
		}

		if (request.intent == "verify") resolve(response);

		var spawnflags = "-q";														//quiet mode enabled to only print seed codes to console
		if (request.runesOn) spawnflags += 'r';						//forbidden runes flag
		if (request.barrenOn) spawnflags += 'b';					//barren lands flag
		if (request.darknessOn) spawnflags += 'd';				//into darkness flag
		if (request.uncurse) spawnflags += 'u';						//uncurse flag
		// ->																							//show consumables flag is enabled conditionally below, near the child process spawning
		if (!request.writeToFile) spawnflags += 'c';			//if attaching a file is not necessary, enable compact mode

		instanceName = instanceTracker.getNewInstanceName();
		if(["slashCommand", "textCommand"].includes(request.source) && request.userId) lastRequestTracker.setLastRequest(request);
		let outputfile = `scanresults/out${instanceName}.txt`;
		console.log(`\x1b[32m■\x1b[0m finder: New request. Using file ${outputfile}.`);
			if (request.longScan) instanceTracker.addLongscanUser(request.userId);

			else if (parsedItemList.autocorrectLikelyInvalid.length == 0 && !request.disableAutocorrect && !request.bonusApplied) {
				request.seedstoscan *= 2;
				request.bonusApplied = true;
			}


			if (!request.showConsumables && !parsedItemList.hasConsumable) spawnflags += 's';	//hide consumables unless specifically asked for

			fs.writeFileSync('in.txt', parsedItemList.itemList.join('\n'));
			var child = spawn('java', ['-XX:+UnlockExperimentalVMOptions', '-XX:+EnableJVMCI', '-XX:-UseJVMCICompiler', '-jar', jarName, "-mode", "find", '-floors', request.floors, '-items', 'in.txt', '-output', outputfile, '-start', request.startingseed, '-end', request.startingseed + request.seedstoscan, '-seeds', request.seedsToFind, spawnflags]);

			//the process is assigned all these custom values so they can be displayed in /instances
			child['userId'] = request.userId;
			child['instanceCode'] = instanceName;
			child['floors'] = parsedItemList.effectiveScanningDepth;
			child['items'] = parsedItemList.realItems;
			instanceTracker.addInstance(child);


			//fucking awesome coding practices
			//gdx logs controllers connecting and disconnecting. one message is logged for creating the window and another for closing it
			//messages -1 and 0 are controller logs, >1 are printed seeds
			//if for some reasons yours creates more logs you should change the foundseeds value

			child.stdout.on('data', (data) => {

				if (!`${data}`.startsWith("[Controllers]")) {
					response.seedList.push(`${data}`);
				}
			});

			//when seedfinder dies for any reason (code 0: finished scanning the seed range, 130: terminated after finding enough seeds)
			child.on('close', (code) => {
				response.endingTime = +new Date;
				instanceTracker.freeInstanceName(child.instanceCode);
				if (request.longScan) instanceTracker.removeLongscanUser(request.userId);

				response.finderOutURL = outputfile;
				try { const data = fs.readFileSync(outputfile, 'utf8'); response.finderOut = data.replaceAll("\n\n", "\n"); } //there's a rare case when multiple seeds are requested, but 1 is found and the bot produces a non-compact result. removing double newlines at least somewhat compacts it then
				catch (err) {
					console.error(err);
					response.responseType = "internalError"
					resolve(response);
				}

				console.log(`\x1b[32m■\x1b[0m finder: Request ${instanceName} completed. Exit code ${code}.`);

					// just some warning code i might reuse later
					// if (foundseeds > 0) resultEmbedList.push(
					// 	{
					// 		color: 0xf5dd0a,
					// 		description: `Th${(foundseeds > 1) ?'ese':'is'} seed${(foundseeds > 1) ?'s are':' is'} incompatible with Shattered PD Beta! Seedfinder will be updated when the release is out.`
					// 	}
					// );

					if (response.seedList.length > 0) {
						response.responseType = "success";
						if(["slashCommand", "textCommand"].includes(request.source) && request.userId) {
							lastRequestTracker.setLastResult(request.userId, base26ToInteger(response.seedList[0]));
							lastRequestTracker.setLastGlobalResult(base26ToInteger(response.seedList[0]));
						}
					}

					else if (code == 1 || response.seedList.join("").toLowerCase().includes("error")) {
						response.responseType = "internalError"
						console.log(response.seedList);
					}
					//this if check looks unnecessary but it prevents the bot from false triggering on process kills from outside
					else if (code == 0) {
						response.responseType = "failure";
						let floorsPerSecond = Math.round(request.seedstoscan / ((+new Date - response.startingTime) / 1000)-3)*parsedItemList.effectiveScanningDepth  ;
						if (!request.longScan) fs.appendFileSync('spslog.txt', '\n' + floorsPerSecond);
					}
					else response.responseType = "silence"
					resolve(response);
				});})

			}

			module.exports = {spawnInstance}
