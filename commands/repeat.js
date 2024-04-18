const { SlashCommandBuilder } = require('discord.js');
const { instanceCap, defaultSeedsToFind, noPingRoleId, minSeedsToScan, jarName, ownerId, errorEmoji, enableLevenshteinMatching } = require('../config.json');
let { versionName } = require('../config.json');
if (!versionName) versionName = jarName;
const responses = require('../responses.json');
const itemlists = require('../itemlists.json');
const instanceTracker = require('../utils/instancetracker.js');
const lastRequestTracker = require('../utils/lastrequesttracker.js');
const { levenshtein } = require('../utils/levenshtein.js');
const { parseItems } = require('../utils/parseitems.js');
const { spawnInstance } = require('../utils/finderspawninstance.js');
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

function handleError(status, interaction){
	if (!status) return;
	let errorcode = status.split(':')[0];
	let baditem = status.split(':')[1];
	console.log(`\x1b[1;33m■\x1b[0m finder: Rejecting request by ${interaction.user.username}. Error: ${errorcode}.`);
	console.log('\x1b[1;33m■\x1b[0m finder: Faulty request: ' + interaction.options.getString('items'));
	if (baditem) console.log('\x1b[1;33m■\x1b[0m finder: Bad item: ' + baditem);
	interaction.reply({ content: errorEmoji + " " + responses[errorcode] + (baditem ? `\nIncorrect item: **${baditem}**` : ""), ephemeral: true });
	return true;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('repeat')
		.setDescription('Repeats your previous request')
    ,
	async execute(interaction) {

		let request = {
			source: "slashCommand"
		}

		if (!lastRequestTracker.getLastRequest(interaction.member.id)){
			interaction.reply({ content: "You have no recent requests. These reset every bot restart.", ephemeral: true });
			return;
		}

		var errorstatus = "";
		request = lastRequestTracker.getLastRequest(interaction.member.id);
		request.startingseed =  (Math.floor(Math.random() * (5429503678976-request.seedstoscan)));



		//the number of concurrent processes is capped to not overload the host
		if (instanceTracker.full()){
			handleError("busy", interaction);
			return;
		}

		if (instanceTracker.checkLongscanUser(request.userId)){
			handleError("longScanOngoing", interaction)
			return;
		}

		//establishing how to address the user, mention or nickname
		var username = (noPingRoleId && interaction.member.roles.cache.has(noPingRoleId)) ? interaction.user.username : `<@${interaction.member.id}>`;
		//we use this to give the tip about long pressing on an embed to copy seed
		if (interaction.member.presence) request.userOnMobile = interaction.member.presence.clientStatus.mobile;
		else request.userOnMobile = false;

		parsedItemList = parseItems(request);

		if (parsedItemList.errorstatus){
			handleError(parsedItemList.errorstatus, interaction);
			return;
		}

		let findBeginEmbeds = [{
			description: `${instanceTracker.freeInstanceTracker(true)}. Scanning: ${request.seedstoscan/1000}k. Starting at: ${request.startingseed}. Version: ${versionName}${parsedItemList.autocorrectUsed ? ". Autocorrected":""}`,
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

		await interaction.reply({
			content: initialReplyContent,
			embeds: findBeginEmbeds
		});

		const initialreply = await interaction.fetchReply(); //we fetch the reply here while the child thread is spawning to reply with results later

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
				interaction.channel.send({
					content: `${finderResult.seedList.join("").includes("GAY")? "🏳️‍🌈" : "<:firepog:1077978284664561684>"} Done! Found ${finderResult.seedList.length} matching seed${finderResult.seedList.length > 1 ? "s" : ""} ${(request.runesOn | request.barrenOn | request.darknessOn) ? "(**__SOME CHALLENGES ON__**) " : ""}by ${username}'s request: ${finderResult.seedList.join(", ")}.${(request.userOnMobile && printAsCodeblock) ? " Long press the seed to copy it to clipboard!" : ""}`,
					files: !printAsCodeblock ? [finderResult.finderOutURL] : [],
					embeds: resultEmbedList

				});
				break;
			}
			case "failure":{
				initialreply.reply({
					content: `<:soiled:1077978326695678032> No seeds match in scanned range requested by ${username}. __Try the same request again to scan more seeds__.${(parsedItemList.autocorrectLikelyInvalid.length > 0 || request.disableAutocorrect) ? " Also check for misspellings/typos." :""}`,
					embeds: resultEmbedList
				});
				break;
			}
			case "internalError":{
				interaction.followUp({content: `<:grave:1077978773296791652> An internal error has occured. <@${ownerId}>\n*${instanceTracker.freeInstanceTracker()}*`});
				break;
			}
			case "miscError": case "itemError":{
				handleError(finderResult.errorstatus);
				return;
				break;
			}
			case "silence":{
				console.log("(quietly quitting)")
				return;
			}
			}

		},
		//this is a module export. it's so funny to me how it's just. a word here
		embedColor

	}
