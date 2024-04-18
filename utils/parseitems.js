const { enableLevenshteinMatching } = require('../config.json');
const itemlists = require('../itemlists.json');
const { levenshtein } = require('../utils/levenshtein.js');

function parseItems (request) {

	let response = {
		errorstatus: "",
		maxupgradedrings: 0,
		maxupgradedwands: 0,
		hasQuestItem: request.items.includes("corpse") || request.items.includes("dust") || request.items.includes("embers") || request.items.includes("rotberry") || request.items.includes("candle"),
		itemList: [], //this will be the finalized array of items after all the corrections and checks
		baseRingsWands: [], //array of rings and wands without their upgrades. used for deck system checks
		artifacts: [], //used to check if there are 2 of the same artifact. why not
		ambiguousitems: [], //holds items like "frost" that can result in 2 different items
		autocorrectLikelyInvalid: [], //holds all items that the autocorrect didn't match
		realItems: [], //everything that isn't a multirange parameter
		allItemsValid: true, //invalidated if autocorrect finds no match for an item
		autocorrectUsed: false,
		hasConsumable: false,
		hasMultirange: false,
		effectiveScanningDepth: request.floors,
		warnings: []
	}

	//fixing some commonly misused symbols
	request.items = request.items.replaceAll('’', "'");
	request.items = request.items.replaceAll('`', "'");
	request.items = request.items.replaceAll('.', ",");
	request.items = request.items.replaceAll(';', ",");
	request.items = request.items.replaceAll('\n', ","); //i have no idea how someone managed to sneak a newline in but it happened once
	request.items = request.items.replaceAll(':', ''); //for multirange support

	//items with non-english symbols cannot possibly be found, so such inputs can be discarded
	if (!request.items.match(/^[a-z0-9+',\- ]*$/i)) response.errorstatus ="badSymbols";
	if (!((request.floors + "").match(/[0-9]/g))) response.errorstatus = "illegal"; //god knows how discord's arguments work
	if (request.items.includes("uncursed")) response.errorstatus = "containsUncursed";
	else if (request.items.includes("cursed")) response.errorstatus = "containsCursed";
	if (request.items.includes("enchantment") && request.floors == 1) response.errorstatus = "floorOneEnchantment";
	if (request.items.includes("shat") && request.floors == 1) response.errorstatus = "floorOneShatteredHoneypot";
	if (request.items.includes("energy crystal") && request.floors == 1) response.errorstatus = "floorOneAlchemy";
	if (response.errorstatus) return response;

	for (let element of request.items.split(',')){
		let curItem = element.trim();

		if (curItem.startsWith("multirange")){
			response.hasMultirange = true;
			let rangeFloorValue = curItem.split(" ")[1];

			if (!rangeFloorValue || isNaN(rangeFloorValue) || rangeFloorValue < 1 || rangeFloorValue > 24) {
				response.errorstatus = invalidRangeFloorNumber;
				return response;
			}
			response.effectiveScanningDepth = Math.max(rangeFloorValue, response.effectiveScanningDepth);
			response.itemList.push(curItem);
			continue; //skips every check if the item is just multirange
		}

		//if (curItem.startsWith('+') && curItem.length > 2) errorstatus = "startsWithPlus:"+ curItem;
		let splitbyupgrades = curItem.split("+"); //item name, upgrade level
		if (splitbyupgrades.length > 2) response.errorstatus = "unseparated:" + curItem;

		let upgradeLevel = splitbyupgrades.at(-1).trim().replaceAll(" ","");
		if (splitbyupgrades.length == 1) upgradeLevel = "";

		let itemName = splitbyupgrades[0].trim();

		//magically shuffle the upgrade level from the start of the item to the end
		if (curItem.startsWith('+')){
			if (curItem[1] && curItem[1].match(/[0-9]/)) {
				upgradeLevel = curItem[1].replaceAll(" ","");
				itemName = curItem.slice(2).trim();
			} else {
				itemName = curItem.slice(1).trim();
				upgradeLevel = "";
			}
		}

		if (upgradeLevel.length > 1) response.errorstatus = "upgradesTooLong:" + curItem;

		if (itemName.match(/[0-9]/g) || (curItem.match(/[0-9]/g) && !curItem.includes("+"))) response.errorstatus ="excessNumbers:" + curItem; //verifying there's no excessive numbers left in the item name
		if (response.errorstatus) return response;

		let beforeAutocorrectItemName = itemName;
		let itemConfirmedValid = false;
		let itemCategory = false; //only used in autocorrect checks
		if (!request.disableAutocorrect) {

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
			let bestLevenshteinCategory = "";
			let lowestLevenshtein = itemName.length;

			//just goes down through all the pieces one by one
			for (let autocorrectType of Object.keys(itemlists.autocorrectTypes)) {
				for (let autocorrectSample of Object.keys(itemlists.autocorrectTypes[autocorrectType])){


					let curLevenshtein = levenshtein(itemlists.autocorrectTypes[autocorrectType][autocorrectSample], itemName);
					if (enableLevenshteinMatching && (curLevenshtein < lowestLevenshtein)) {
						bestLevenshteinMatch = itemlists.autocorrectTypes[autocorrectType][autocorrectSample];
						bestLevenshteinCategory = autocorrectType;
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
				itemCategory = bestLevenshteinCategory;
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
			if (!itemCategory && (enchantment || glyph)) {
				itemCategory = "enchantment";
				itemName = enchantment || glyph || "";
				itemConfirmedValid = true;
			}

			if (!itemName.includes(beforeAutocorrectItemName)) response.autocorrectUsed = true;

			if (!itemConfirmedValid && itemName) response.autocorrectLikelyInvalid.push(itemName);

			if ( ["scrolls", "potions", "stones", "miscconsumables"].includes(itemCategory)) response.hasConsumable = true;

			if (itemCategory == "artifacts") response.artifacts.push(itemName);

			if (itemCategory == "wands" || itemCategory == "rings") response.baseRingsWands.push(itemName);

			if (curItem.includes('+') && itemConfirmedValid && !["weapons", "armor", "wands", "rings", "onlyifupgraded", "enchantment"].includes(itemCategory)) response.errorstatus = "unupgradeableWithUpgrades:"+curItem;

		}


		for (let ambiguousitem of Object.keys(itemlists.ambiguous)){
			if (itemName == ambiguousitem && !response.ambiguousitems.includes(itemName)){
				response.ambiguousitems.push(itemName)
				break;
			};
		};

		if (curItem.includes("+")) {
			curItem = (itemName + " +" + upgradeLevel); //makes sure there's 1 space between the item name and level
			if (curItem.includes("0")) curItem = itemName; //inputs with +0 in them are treated as just unupgraded items. sorry if you want a +0 specifically
		} else curItem = itemName;
		if (itemName.length > 30 || itemName.split(' ').length > 4) response.errorstatus = "unseparated:"+ curItem;
		if (itemName.split(' ').length == 1 && itemName.length > 14) response.errorstatus = "missingSpaces:"+ curItem; //the longest allowed word is "disintegration"

		if (curItem) {
			response.itemList.push(curItem);
			response.realItems.push(curItem);
		};

		if (upgradeLevel > 2){
			//counting how many rings of high level we're looking for
			let isRing = false;
			for (let ringname of itemlists.ringArray){
				if (curItem.includes(ringname)) {
					isRing = true;
					if (response.maxupgradedrings) response.errorstatus = "tooManyHighRings";
					if (response.effectiveScanningDepth < 17) response.errorstatus = "maxRingTooEarly";
					response.maxupgradedrings++;
					break;
				}
			};
			//counting how many wands of high level we're looking for
			for (let wandname of itemlists.wandArray){
				if (curItem.includes(wandname)) {
					if (response.maxupgradedwands) response.errorstatus = "tooManyHighWands";
					if (response.hasQuestItem) response.errorstatus = "questItemAndWandmakerWand";
					if (response.effectiveScanningDepth < 7) response.errorstatus = "maxWandTooEarly";
					response.maxupgradedwands++;
					break;
				}
			};

			if ((upgradeLevel > 3) && !(isRing && (upgradeLevel == 4))) response.errorstatus = "overUpgraded:"+ curItem;

		}
	};


	if (new Set(response.artifacts).size != response.artifacts.length) response.errorstatus = "twoOfTheSameartifact";

	if (response.effectiveScanningDepth < 7 && response.hasQuestItem) response.errorstatus = "questItemTooEarly";

	let counts = {};
	let showDeckLimitWarning = false;
	response.baseRingsWands.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
	for (let [key, value] of Object.entries(counts)) {if (value > 3) response.warnings.push("deckLimitRingsWands")}

	response.autocorrectLikelyInvalid = response.autocorrectLikelyInvalid.filter(n => !response.ambiguousitems.includes(n)); //exclude all the items that are in the ambiguous list

	return response;
}

module.exports = { parseItems }
