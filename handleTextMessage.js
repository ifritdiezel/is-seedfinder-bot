/*
most of this is just copied and pasted from findseeds. i'm aware it's a bad thing to do
*/

const { spawn } = require('child_process');
const fs = require('fs');
const { instanceCap, defaultSeedsToFind, noPingRoleId, minSeedsToScan, jarName, ownerId, errorEmoji, enableLevenshteinMatching, enableTextCmdNaturalLanguage } = require('./config.json');
let { versionName } = require('./config.json');
if (!versionName) versionName = jarName;
const responses = require('./responses.json');
const itemlists = require('./itemlists.json');
const instanceTracker = require('./utils/instancetracker.js');
const { levenshtein } = require('./utils/levenshtein.js');
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
		console.log('\x1b[1;33m■\x1b[0m finder: Faulty request: [PLACEHOLDER]');
		if (baditem) console.log('\x1b[1;33m■\x1b[0m finder: Bad item: ' + baditem);
		message.reply(errorEmoji + " " + responses[errorcode] + (baditem ? `\nIncorrect item: **${baditem}**` : ""));
		return true;
	}


	function handleMessage (message){

		let messageContent = message.content.toLowerCase().replaceAll("_","").replace(/\s+/g,' ');
		messageContent = messageContent.replaceAll("find seed", "findseed");
		let userId = message.author.id;
		let args = messageContent.split(" ");

		let confirmedCommandAttempt = false;

		let floors = "";
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

				if (commandWord.includes("floor") || commandWord.includes("depth")){
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
				else if (nowListingItems) items += commandWord;
			}
		}


		if (items && floors) confirmedCommandAttempt = true;
		if (args[0].includes("findseed") ) confirmedCommandAttempt = true;

		if (!confirmedCommandAttempt) return;

		if (args.length == 1 || message.content.includes("help")) {
			handleError("textCommandHelp", message);
			return;
	}
		var errorstatus = "";


		let disableAutocorrect = messageContent.includes("disable_autocorrect");
		messageContent = messageContent.replaceAll("disable_autocorrect", "")
		let longScan = messageContent.includes("longscan");
		messageContent = messageContent.replaceAll("longscan", "");
		let runesOn = messageContent.includes("runeson");
		messageContent = messageContent.replaceAll("runeson", "");
		let barrenOn = messageContent.includes("barrenon");
		messageContent = messageContent.replaceAll("barrenon", "");
		let darknessOn = messageContent.includes("darknesson");
		messageContent = messageContent.replaceAll("darknesson", "");
		let showConsumables = messageContent.includes("showconsumables");
		messageContent = messageContent.replaceAll("showconsumables", "");

		floors = floors || args[1];
		console.log("floors: "+ floors);
		if (!floors || isNaN(floors) || floors < 1 || floors > 24) {
			handleError("invalidFloorsNumber", message);
			return;
		}

		items = items || messageContent.slice("!findseeds".length + floors.length + 1);

		console.log("items: " + items);


		//the number of concurrent processes is capped to not overload the host
		if (instanceTracker.full()){
			handleError("busy", message);
			return;
		}

		let seedstoscan = (floors<=5) ? minSeedsToScan*2 : minSeedsToScan;
		if (floors == 1) seedstoscan = minSeedsToScan*10;
		if (longScan) {
			seedstoscan = 10000000;
			if (instanceTracker.checkLongscanUser(userId)){
					handleError("longScanOngoing", message);
					return;
			}
		}


		let startingseed =  (Math.floor(Math.random() * (5429503678976-seedstoscan)));
		let writeToFile = (floors > 10); //if the user is looking for 1 seed less than 10 floors, the output can fit in an embed without a file
		var startingTime = +new Date; //a timestamp of receiving the interaction, subtracted from ending timestamp to get execution time

		//establishing how to address the user, mention or nickname
		var username = (noPingRoleId && message.member.roles.cache.has(noPingRoleId)) ? message.user.username : `<@${message.member.id}>`;
		//we use this to give the tip about long pressing on an embed to copy seed
		if (message.member.presence) userOnMobile = message.member.presence.clientStatus.mobile;
		else userOnMobile = false;

		//string of flags to pass to the process
		var spawnflags = "-q";										//quiet mode enabled to only print seed codes to console
		if (runesOn) spawnflags += 'r';						//forbidden runes flag
		if (barrenOn) spawnflags += 'b';					//barren lands flag
		if (darknessOn) spawnflags += 'd';				//into darkness flag
		// ->																			//show consumables flag is enabled conditionally below, near the child process spawning
		if (!writeToFile) spawnflags += 'c';			//if attaching a file is not necessary, enable compact mode

		//fixing some commonly misused symbols
		items = items.replaceAll('’', "'");
		items = items.replaceAll('.', ",");
		items = items.replaceAll('\n', ","); //i have no idea how someone managed to sneak a newline in but it happened once

		//items with non-english symbols cannot possibly be found, so such inputs can be discarded
		//also only allows numbers 0-4: the only possible upgrade levels
		if (!items.match(/^[a-z0-4+',\- ]*$/i)) errorstatus ="badSymbols";
		if (items.includes("cursed")) errorstatus = "containsCursed";
		if (items.includes("enchantment") && floors == 1) errorstatus = "floorOneEnchantment";
		if (items.includes("shat") && floors == 1) errorstatus = "floorOneShatteredHoneypot";
		if (items.includes("energy crystal") && floors == 1) errorstatus = "floorOneAlchemy";
		if (handleError(errorstatus, message)) return;

		//flags that get set during the iteration to discard broken inputs
		//flags that get set during the iteration to discard broken inputs
		var maxupgradedrings = 0;
		var maxupgradedwands = 0;
		var hasQuestItem = items.includes("corpse") || items.includes("dust") || items.includes("embers") || items.includes("rotberry") || items.includes("candle");
		let itemlist = []; //this will be the finalized array of items after all the corrections and checks
		let baseRingsWands = []; //array of rings and wands without their upgrades. used for deck system checks
		let artifacts = []; //used to check if there are 2 of the same artifact. why not
		let ambiguousitems = []; //holds items like "frost" that can result in 2 different items
		let autocorrectLikelyInvalid = []; //holds all items that the autocorrect didn't match
		let allItemsValid = true; //invalidated if autocorrect finds no match for an item
		let autocorrectUsed = false;
		let hasConsumable = false;

		items.split(',').forEach(element => {
			let curItem = element.trim();

			//if (curItem.startsWith('+') && curItem.length > 2) errorstatus = "startsWithPlus:"+ curItem;
			let splitbyupgrades = curItem.split("+"); //item name, upgrade level
			if (splitbyupgrades.length > 2) errorstatus = "unseparated:" + curItem;

			let upgradeLevel = splitbyupgrades.at(-1);
			if (splitbyupgrades.length == 1) upgradeLevel = "";
			let itemName = splitbyupgrades[0].trim();

			//magically shuffle the upgrade level from the start of the item to the end
			if (curItem.startsWith('+')){
				if (curItem[1] && curItem[1].match(/[0-4]/)) {
					upgradeLevel = curItem[1];
					itemName = curItem.slice(2).trim();
				} else {
					itemName = curItem.slice(1).trim();
					upgradeLevel = "";
				}
			}

			if (itemName.match(/[0-4]/g)) errorstatus ="excessNumbers:" + curItem; //verifying there's no excessive numbers left in the item name


			let beforeAutocorrectItemName = itemName;
			let itemConfirmedValid = false;
			let itemCategory = false; //only used in autocorrect checks
			if (!disableAutocorrect) {

				let enchantment = ""; //enchants and glyphs are always detected but only appended if the item type is right
				for (let enchantmentname of Object.keys(itemlists.enchantments)){
					if (itemName.includes(enchantmentname)){
						enchantment = itemlists.enchantments[enchantmentname] + ' ';
						break;
					};
				};
				let glyph = "";
				for (let glyphname of Object.keys(itemlists.glyphs)){
					if (itemName.includes(glyphname)){
						glyph = ' of ' + itemlists.glyphs[glyphname];
						break;
					};
				};

				let bestLevenshteinMatch = "";
				let lowestLevenshtein = itemName.length;

				//just goes down through all the pieces one by one
				for (let autocorrectType of Object.keys(itemlists.autocorrectTypes)) {
					for (let autocorrectSample of Object.keys(itemlists.autocorrectTypes[autocorrectType])){


						let curLevenshtein = levenshtein(itemlists.autocorrectTypes[autocorrectType][autocorrectSample], itemName);
						if (enableLevenshteinMatching && (curLevenshtein < lowestLevenshtein)) {
							bestLevenshteinMatch = itemlists.autocorrectTypes[autocorrectType][autocorrectSample];
							lowestLevenshtein = curLevenshtein;
						}

						if (itemName.includes(autocorrectSample)){
							itemName = itemlists.autocorrectTypes[autocorrectType][autocorrectSample];
							itemConfirmedValid = true;
							itemCategory = autocorrectType;
							break;
						};

						if (curLevenshtein < itemName.length && curLevenshtein < 5) {
							console.log("levenshtein "+ curLevenshtein +": " + itemName+ " -> " + itemlists.autocorrectTypes[autocorrectType][autocorrectSample])
						}

						if (itemConfirmedValid) break;
					};
				}

				if (!itemConfirmedValid && lowestLevenshtein < itemName.length && lowestLevenshtein < 3){
					itemName = bestLevenshteinMatch;
					itemConfirmedValid = true;
				}

				//for items like "frost" that can only match to upgradeable items
				if (curItem.includes('+')) {
					for (let oiuname of Object.keys(itemlists.onlyifupgraded)){
						if (itemName.includes(oiuname)){
							itemName = itemlists.onlyifupgraded[oiuname];
							itemConfirmedValid = true;
							itemCategory = "onlyifupgraded";
							break;
						};
					};
				}


				if (itemCategory == "weapons") itemName = enchantment + itemName;
				if (itemCategory == "armor") itemName += glyph;
				if (!itemName.includes(beforeAutocorrectItemName)) autocorrectUsed = true;

				if (!itemConfirmedValid && itemName) autocorrectLikelyInvalid.push(itemName);

				if ( ["scrolls", "potions", "stones", "miscconsumables"].includes(itemCategory)) hasConsumable = true;

				if (itemCategory == "artifacts") artifacts.push(itemName);

				if (itemCategory == "wands" || itemCategory == "rings") baseRingsWands.push(itemName);

				if (curItem.includes('+') && itemConfirmedValid && !["weapons", "armor", "wands", "rings", "onlyifupgraded"].includes(itemCategory)) errorstatus = "unupgradeableWithUpgrades:"+curItem;

			}


			for (let ambiguousitem of Object.keys(itemlists.ambiguous)){
				if (itemName == ambiguousitem && !ambiguousitems.includes(itemName)){
					ambiguousitems.push(itemName)
					break;
				};
			};

			if (curItem.includes("+")) {
				curItem = (itemName + " +" + upgradeLevel); //makes sure there's 1 space between the item name and level
				if (curItem.includes("0")) curItem = itemName; //inputs with +0 in them are treated as just unupgraded items. sorry if you want a +0 specifically
				if (itemlists.firstWordUpgradables.includes(itemName)) errorstatus = "wrongUpgradeSyntax:"+ curItem;
			} else curItem = itemName;
			if (itemName.length > 30 || itemName.split(' ').length > 4) errorstatus = "unseparated:"+ curItem;
			if (itemName.split(' ').length == 1 && itemName.length > 14) errorstatus = "missingSpaces:"+ curItem; //the longest allowed word is "disintegration"

			if (curItem) itemlist.push(curItem);

			if (upgradeLevel > 2){
				//counting how many rings of high level we're looking for
				let isRing = false;
				for (let ringname of itemlists.ringArray){
					if (curItem.includes(ringname)) {
						isRing = true;
						if (maxupgradedrings) errorstatus = "tooManyHighRings";
						if (floors < 17) errorstatus = "maxRingTooEarly";
						maxupgradedrings++;
						break;
					}
				};
				//counting how many wands of high level we're looking for
				for (let wandname of itemlists.wandArray){
					if (curItem.includes(wandname)) {
						if (maxupgradedwands) errorstatus = "tooManyHighWands";
						if (hasQuestItem) errorstatus = "questItemAndWandmakerWand";
						if (floors < 7) errorstatus = "maxWandTooEarly";
						maxupgradedwands++;
						break;
					}
				};

				if ((upgradeLevel > 3) && !(isRing && (upgradeLevel == 4))) errorstatus = "overUpgraded:"+ curItem;

			}
		});


		if (new Set(artifacts).size != artifacts.length) errorstatus = "twoOfTheSameartifact";

		if (floors < 7 && hasQuestItem) errorstatus = "questItemTooEarly";
		if (handleError(errorstatus, message)) return;

		//finally acknowledging a valid request and assigning an output file to the instance
		instanceName = instanceTracker.getNewInstanceName();
		let outputfile = `scanresults/out${instanceName}.txt`;
		console.log(`\x1b[32m■\x1b[0m finder: New request. Using file ${outputfile}.`);
			if (longScan) instanceTracker.addLongscanUser(userId);
			else if (autocorrectLikelyInvalid.length == 0 && !disableAutocorrect) seedstoscan *= 2;

			if (!showConsumables && !hasConsumable) spawnflags += 's';	//hide consumables unless specifically asked for


			fs.writeFileSync('in.txt', itemlist.join('\n'));
			var child = spawn('java', ['-XX:+UnlockExperimentalVMOptions', '-XX:+EnableJVMCI', '-XX:-UseJVMCICompiler', '-jar', jarName, "-mode", "find", '-floors', floors, '-items', 'in.txt', '-output', outputfile, '-start', startingseed, '-end', startingseed + seedstoscan, '-seeds', 1, spawnflags]);

			//the process is assigned all these custom values so they can be displayed in /instances
			child['userId'] = userId;
			child['instanceCode'] = instanceName;
			child['floors'] = floors;
			child['items'] = itemlist;


			let findBeginEmbeds = [{
				description: `${instanceTracker.freeInstanceTracker()}. Scanning: ${seedstoscan/1000}k. Starting at: ${startingseed}. Version: ${versionName}${autocorrectUsed ? ". Autocorrected":""}`,
				color: embedColor
			}];

			//counting all instances of the same rings and wands to warn about the deck system limitations
			let counts = {};
			let showDeckLimitWarning = false;
			baseRingsWands.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
			for (let [key, value] of Object.entries(counts)) {if (value > 3) showDeckLimitWarning = true;}
			if (showDeckLimitWarning) findBeginEmbeds.push(
				{
					color: 0xf5dd0a,
					description: "Due to Shattered's deck system design it is nearly impossible to find more than 3 of the same ring or wand" + (floors < 15 ? ", especially for lower floors":"") + "."
				}
			);

			autocorrectLikelyInvalid = autocorrectLikelyInvalid.filter(n => !ambiguousitems.includes(n)); //exclude all the items that are in the ambiguous list
			if (autocorrectLikelyInvalid.length > 0) findBeginEmbeds.push(
				{
					color: 0xf5dd0a,
					description: (autocorrectLikelyInvalid.length > 1 ? "These items were" : "This item was") + " not recognized: "+ autocorrectLikelyInvalid.join(', ') + "\nIf you made a mistake, use /stop and retry."
				}
			);

			ambiguousItemsResult = [];
			for (let ambiguousitem of ambiguousitems) ambiguousItemsResult.push(ambiguousitem + ": " + itemlists.ambiguous[ambiguousitem])

			if (ambiguousitems.length > 0) findBeginEmbeds.push(
				{
					color: 0xf5dd0a,
					description: "Some of your items are ambiguous, please specify:\n"+ ambiguousItemsResult.join('\n')
				}
			);

			if (floors == 1 && itemlist.length > 2) findBeginEmbeds.push(
				{
					color: embedColor,
					description: "Floor 1 usually contains very few items. Raising the floor limit will make finding the seed much more likely."
				}
			);

			//initial confirmation, lets the user and discord know the bot isn't dead
			initialReplyContent = `<:examine:1077978273583202445> Looking for ` + "a seed" +
			(runesOn ? " __with Forbidden Runes on__" : "") + (barrenOn ? " __with Barren Lands on__" : "") +
			` up to depth ${floors}`;
			if (itemlist.length > 0) initialReplyContent += ` with item${itemlist.length > 1 ? "s" : ""}: ${itemlist.join(", ")}\n`
			else initialReplyContent += " with any items at all. Easy!"

			let initialreply = message.reply({
				content: initialReplyContent,
				embeds: findBeginEmbeds
			});

			child['initialReplyId'] = initialreply.id;

			//console.log(instanceList);
			instanceTracker.addInstance(child);


			//fucking awesome coding practices
			//gdx logs controllers connecting and disconnecting. one message is logged for creating the window and another for closing it
			//messages -1 and 0 are controller logs, >1 are printed seeds
			//if for some reasons yours creates more logs you should change the foundseeds value
			var foundseeds = -2
			var seedlist = [];
			child.stdout.on('data', (data) => {
				foundseeds++;
				if (foundseeds > 0) {
					seedlist.push(`${data}`);
				}
			});

			//when seedfinder dies for any reason (code 0: finished scanning the seed range, 130: terminated after finding enough seeds)
			child.on('close', (code) => {
				instanceTracker.freeInstanceName(child.instanceCode);
				if (longScan) instanceTracker.removeLongscanUser(userId);

				let printAsCodeblock = ""
				try { const data = fs.readFileSync(outputfile, 'utf8'); printAsCodeblock = data.replaceAll("\n\n", "\n"); } //there's a rare case when multiple seeds are requested, but 1 is found and the bot produces a non-compact result. removing double newlines at least somewhat compacts it then
				catch (err) {console.error(err);}
				if (printAsCodeblock.length > 1200) printAsCodeblock = null;

				console.log(`\x1b[32m■\x1b[0m finder: Request ${instanceName} completed. Exit code ${code}.`);

					let resultEmbedList = [];
					if (printAsCodeblock) resultEmbedList = [{
						color: embedColor,
						title: seedlist[0],
						description: printAsCodeblock,
						fields: [{name: 'Version', value: versionName, inline: true}, {name: 'Items', value: itemlist.join(", ") || "Any", inline: true}],
						footer: {text: `${instanceTracker.freeInstanceTracker()}. ${executionTimeTracker(startingTime)}`}
					}]
					else resultEmbedList = [{
						description: `Request: ${itemlist.join(", ")} before floor ${floors}.`,
						color: embedColor,
						footer:{text:`${instanceTracker.freeInstanceTracker()}. ${executionTimeTracker(startingTime)}. Version: ${versionName}`}
					}]

					// just some warning code i might reuse later
					// if (foundseeds > 0) resultEmbedList.push(
					// 	{
					// 		color: 0xf5dd0a,
					// 		description: `Th${(foundseeds > 1) ?'ese':'is'} seed${(foundseeds > 1) ?'s are':' is'} incompatible with Shattered PD Beta! Seedfinder will be updated when the release is out.`
					// 	}
					// );

					if (foundseeds > 0) message.channel.send({
						content: `<:firepog:1077978284664561684> Done! Found ${foundseeds} matching seed${foundseeds > 1 ? "s" : ""} ${(runesOn | barrenOn | darknessOn) ? "(**__SOME CHALLENGES ON__**) " : ""}by ${username}'s request: ${seedlist.join(", ")}.${(userOnMobile && printAsCodeblock) ? " Long press the seed to copy it to clipboard!" : ""}`,
						files: !printAsCodeblock ? [outputfile] : [],
						embeds: resultEmbedList
					});

					else if (code == 1) {
						message.reply({content: `<:grave:1077978773296791652> Oops! Seedfinder appears to have crashed. <@${ownerId}>\n*${instanceTracker.freeInstanceTracker()}*`});
						console.log(seedlist);
					}
					//this if check looks unnecessary but it prevents the bot from false triggering on process kills from outside
					else if (code == 0) {
						message.reply({
							content: `<:soiled:1077978326695678032> No seeds match in scanned range requested by ${username}. __Try the same request again to scan more seeds__.${(autocorrectLikelyInvalid.length > 0 || disableAutocorrect) ? " Also check for misspellings/typos." :""}`,
							embeds: resultEmbedList
						});
						let floorsPerSecond = Math.round(seedstoscan / ((+new Date - startingTime) / 1000)-3)*floors  ;
						if (!longScan) fs.appendFileSync('spslog.txt', '\n' + floorsPerSecond);
					}
				});
			}

			module.exports = {handleMessage}
