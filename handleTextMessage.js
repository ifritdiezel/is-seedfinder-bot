const fs = require('fs');
const { instanceCap, defaultSeedsToFind, noPingRoleId, minSeedsToScan, jarName, ownerId, errorEmoji, enableLevenshteinMatching, enableTextCmdNaturalLanguage } = require('./config.json');
let { versionName } = require('./config.json');
if (!versionName) versionName = jarName;
const responses = require('./responses.json');
const itemlists = require('./itemlists.json');
const instanceTracker = require('./utils/instancetracker.js');
const { levenshtein } = require('./utils/levenshtein.js');
const { parseItems } = require('./utils/parseitems.js');
const lastRequestTracker = require('./utils/lastrequesttracker.js');
const { spawnInstance } = require('./utils/finderspawninstance.js');
const embedColor = 0x2ee62e; //has to be hardcoded here because json won't take this value. sucks!

function executionTimeTracker(stT){
	let seconds = Math.round((+new Date - stT) / 1000);
	let result = "";

	let interval = seconds / 3600;
	if (interval > 1) result += (Math.floor(interval) + "h");

	interval = seconds / 60;
	if (interval > 1) result += (Math.floor(interval) % 60 + "m");

	if (seconds % 60) result += (seconds % 60 + "s");

	return `Execution time: ${result}`
}

function handleError(status, message){
	if (!status) return;
	let errorcode = status.split(':')[0];
	let baditem = status.split(':')[1];
	console.log(`\x1b[1;33m■\x1b[0m finder: Rejecting request by ${message.author.username}. Error: ${errorcode}.`);
		console.log('\x1b[1;33m■\x1b[0m finder: Faulty request: '+message.content);
		if (baditem) console.log('\x1b[1;33m■\x1b[0m finder: Bad item: ' + baditem);
		message.reply(errorEmoji + " " + responses[errorcode] + (baditem ? `\nIncorrect item: **${baditem}**` : ""));
		return true;
	}


	async function handleMessage (message){

		let request = {
			source: "textCommand"
		}

		let messageContent = message.content.toLowerCase().replaceAll("_","").replace(/\s+/g,' ');
		let args = messageContent.split(" ");
		request.userId = message.author.id;

		//establishing how to address the user, mention or nickname
		var username = (noPingRoleId && message.member.roles.cache.has(noPingRoleId)) ? message.user.username : `<@${message.member.id}>`;
		//we use this to give the tip about long pressing on an embed to copy seed
		if (message.member.presence) request.userOnMobile = message.member.presence.clientStatus.mobile;
		else request.userOnMobile = false;

		if (args.length == 1 && (args[0].includes("repeat") || args[0].includes("retry") || args[0].includes("redo"))) {
			if (!lastRequestTracker.getLastRequest(request.userId)){
				message.reply("You have no recent requests. These reset every bot restart.");
				return;
			}
			else request = lastRequestTracker.getLastRequest(request.userId);
			//always randomize the seed for repeats, preset starting seeds would return the exact same results every time
			request.startingseed =  (Math.floor(Math.random() * (5429503678976-request.seedstoscan)));
		}
		else	{
			request.disableAutocorrect = messageContent.includes("disableautocorrect");
			messageContent = messageContent.replaceAll("disableautocorrect", "")
			request.longScan = messageContent.includes("longscan");
			messageContent = messageContent.replaceAll("longscan", "");
			request.runesOn = messageContent.includes("runeson");
			messageContent = messageContent.replaceAll("runeson", "");
			request.barrenOn = messageContent.includes("barrenon");
			messageContent = messageContent.replaceAll("barrenon", "");
			request.darknessOn = messageContent.includes("darknesson");
			messageContent = messageContent.replaceAll("darknesson", "");
			request.showConsumables = messageContent.includes("showconsumables");
			messageContent = messageContent.replaceAll("showconsumables", "");
			request.uncurse = messageContent.includes("uncurse");
			messageContent = messageContent.replaceAll("uncurse", "");
			request.exactUpgrades = messageContent.includes("exactupgrades");
			messageContent = messageContent.replaceAll("exactupgrades", "");
			messageContent = messageContent.replaceAll("find seed", "findseed");

			args = messageContent.split(" ");

			let confirmedCommandAttempt = false;

			let floors = "";
			natLangItemsArray = [];
			let items = "";

			//if you don't understand this that's fine probably
			let nowListingItems = false;
			if (enableTextCmdNaturalLanguage){
				for (let i = 0; i < args.length; i++){
					let commandWord = args[i];
					let nPreviousCommandWord = args[i-1] || "";
					nPreviousCommandWord = nPreviousCommandWord.replace(/\D/g,'');
					let nNextCommandWord = args[i+1] || "";
					nNextCommandWord = nNextCommandWord.replace(/\D/g,'');

					if (commandWord.includes("floor") || commandWord.includes("depth") || commandWord.includes("before")){
						if (commandWord.includes(":")) {
							floors = commandWord.split(":")[1] || "";
							floors = floors.replace(/\D/g,'');
						}
						if (nPreviousCommandWord && !isNaN(nPreviousCommandWord)) floors = nPreviousCommandWord;
						else if (nNextCommandWord && !isNaN(nNextCommandWord)) floors = nNextCommandWord;
						nowListingItems = false;
					}

					else if (commandWord.includes("item") || commandWord.includes("request")){
						nowListingItems = true;
						if (commandWord.includes(":") && commandWord.split(":")[1]) items += commandWord.split(":")[1];
					}
					else if (nowListingItems) natLangItemsArray.push(commandWord);
				}
			}
			items = natLangItemsArray.join(" ");


			if (items && floors) confirmedCommandAttempt = true;
			if (args[0].includes("findseed") ) confirmedCommandAttempt = true;

			if (!confirmedCommandAttempt) return;

			if (args.length == 1 || message.content.includes("help")) {
				handleError("textCommandHelp", message);
				return;
			}
			var errorstatus = "";

			request.floors = floors || args[1];
			if (!floors || isNaN(floors) || floors < 1 || floors > 24) {
				handleError("invalidFloorsNumber", message);
				return;
			}

			request.seedstoscan = (floors<=5) ? minSeedsToScan*2 : minSeedsToScan;
			if (floors == 1) request.seedstoscan = minSeedsToScan*10;

			request.items = items || messageContent.slice("!findseeds".length + floors.length + 1);

			request.startingseed =  (Math.floor(Math.random() * (5429503678976-request.seedstoscan)));
			request.randomizedStartingSeed = true;
			request.writeToFile = (floors > 10); //if the user is looking for 1 seed less than 10 floors, the output can fit in an embed without a file
		}


		//the number of concurrent processes is capped to not overload the host
		if (instanceTracker.full()){
			handleError("busy", message);
			return;
		}

		if (request.longScan) {
			request.seedstoscan = 10000000;
			if (instanceTracker.checkLongscanUser(request.userId)){
				handleError("longScanOngoing", message);
				return;
			}
		}

		parsedItemList = parseItems(request);

		if (parsedItemList.errorstatus){
			handleError(parsedItemList.errorstatus, message);
			return;
		}

		let findBeginEmbeds = [{
			description: `${instanceTracker.freeInstanceTracker()}. Scanning: ${request.seedstoscan/1000}k. Starting at: ${request.startingseed}. Version: ${versionName}${parsedItemList.autocorrectUsed ? ". Autocorrected":""}`,
			color: embedColor
		}];

		if (parsedItemList.warnings.includes("deckLimitRingsWands")) findBeginEmbeds.push(
			{
				color: 0xf5dd0a,
				description: "Due to Shattered's deck system design it is nearly impossible to find more than 3 of the same ring or wand" + (request.floors < 15 ? ", especially for lower floors":"") + "."
			}
		);

		if (parsedItemList.autocorrectLikelyInvalid.length > 0) findBeginEmbeds.push(
			{
				color: 0xf5dd0a,
				description: (parsedItemList.autocorrectLikelyInvalid.length > 1 ? "These items were" : "This item was") + " not recognized: "+ parsedItemList.autocorrectLikelyInvalid.join(', ') + "\nIf you made a mistake, use /stop and retry."
			}
		);

		ambiguousItemsResult = [];
		for (let ambiguousitem of parsedItemList.ambiguousitems) ambiguousItemsResult.push(ambiguousitem + ": " + itemlists.ambiguous[ambiguousitem])

		if (parsedItemList.ambiguousitems.length > 0) findBeginEmbeds.push(
			{
				color: 0xf5dd0a,
				description: "Some of your items are ambiguous, please specify:\n"+ ambiguousItemsResult.join('\n')
			}
		);

		if (parsedItemList.effectiveScanningDepth == 1 && parsedItemList.itemList.length > 2) findBeginEmbeds.push(
			{
				color: embedColor,
				description: "Floor 1 usually contains very few items. Raising the floor limit will make finding the seed much more likely."
			}
		);

		//initial confirmation, lets the user and discord know the bot isn't dead
		initialReplyContent = `<:examine:1077978273583202445> Looking for ` + (request.seedsToFind > 1 ? request.seedsToFind + " seeds" : "a seed") +
		(request.runesOn ? " __with Forbidden Runes on__" : "") + (request.barrenOn ? " __with Barren Lands on__" : "") +
		` up to depth ${request.floors}`;
		if (parsedItemList.hasMultirange) initialReplyContent += ' (' + parsedItemList.effectiveScanningDepth + ' multirange)';
		if (parsedItemList.realItems.length > 0) initialReplyContent += ` with item${parsedItemList.realItems.length > 1 ? "s" : ""}: ${parsedItemList.realItems.join(", ")}\n`
		else initialReplyContent += " with any items at all. Easy!"

		initialreply = await message.reply({
			content: initialReplyContent,
			embeds: findBeginEmbeds
		});

		request.source = "textCommand"; //we have to reset this to textcommand in case the last request was from a slash command

		finderResult = await spawnInstance(request, parsedItemList);

		let printAsCodeblock = "";
		if (finderResult.finderOut.length > 1200) printAsCodeblock = null;
		else printAsCodeblock = finderResult.finderOut;

		let resultEmbedList = [];
		if (printAsCodeblock) resultEmbedList = [{
			color: embedColor,
			title: finderResult.seedList[0],
			description: printAsCodeblock,
			fields: [{name: 'Version', value: versionName, inline: true}, {name: 'Items', value: parsedItemList.realItems.join(", ") || "Any", inline: true}],
			footer: {text: `${instanceTracker.freeInstanceTracker()}. ${executionTimeTracker(finderResult.startingTime)}`}
		}]
		else resultEmbedList = [{
			description: `Request: ${parsedItemList.realItems.join(", ")} before floor ${parsedItemList.effectiveScanningDepth}.`,
			color: embedColor,
			footer:{text:`${instanceTracker.freeInstanceTracker()}. ${executionTimeTracker(finderResult.startingTime)}. Version: ${versionName}`}
		}]

		switch (finderResult.responseType){
			case "success":{
				message.channel.send({
					content: `${finderResult.seedList.join("").includes("GAY")? "🏳️‍🌈" : "<:firepog:1077978284664561684>"} Done! Found ${finderResult.seedList.length} matching seed${finderResult.seedList.length > 1 ? "s" : ""} ${(request.runesOn | request.barrenOn | request.darknessOn) ? "(**__SOME CHALLENGES ON__**) " : ""}by ${username}'s request: ${finderResult.seedList.join(", ")}.${(request.userOnMobile && printAsCodeblock) ? " Long press the seed to copy it to clipboard!" : ""}`,
					files: !printAsCodeblock ? [finderResult.finderOutURL] : [],
					embeds: resultEmbedList

				});
				break;
			}
			case "failure":{
				initialreply.reply({
					content: `<:soiled:1077978326695678032> No seeds match in scanned range requested by ${username}. ${(parsedItemList.autocorrectLikelyInvalid.length > 0 || request.disableAutocorrect) ? "Also check for misspellings/typos." :"Use !repeat to try a different range of seeds."}`,
					embeds: resultEmbedList
				});
				break;
			}
			case "internalError":{
				message.reply({content: `<:grave:1077978773296791652> An internal error has occured. <@${ownerId}>\n*${instanceTracker.freeInstanceTracker()}*`});
				break;
			}
			case "miscError": case "itemError":{
				handleError(finderResult.errorstatus, message);
				return;
				break;
			}
			case "silence":{
				console.log("(quietly quitting)")
				return;
				break;
			}
		}
	}

	module.exports = {handleMessage}
