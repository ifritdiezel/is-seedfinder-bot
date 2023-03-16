const { SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const { instanceCap, defaultSeedsToFind, versionName, noPingRoleId, minSeedsToScan, jarName } = require('../config.json')
const { rings, wands } = require('../itemlists.json');
var instances = 0;

const embedColor = 0x2ee62e; //has to be hardcoded here because json won't take this value

function freeInstanceTracker() {
  return `Free instances: ${instanceCap-instances}`
}

function executionTimeTracker(stT){
	return `Execution time: ${(+new Date - stT) / 1000}s`
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('findseeds')
		.setDescription('Looks for seeds matching given criteria')
    .addIntegerOption(option =>
		   option.setName('floors')
			.setDescription('How many depths to check for items')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(24) )
    .addStringOption(option =>
      option.setName('items')
      .setDescription('List of items split by commas. See #info-usage for details')
      .setRequired(true) )
    .addIntegerOption(option =>
      option.setName('starting_seed')
     .setDescription('The number of the seed to start with. Can be found in detailed reports')
     .setMinValue(0)
		 .setMaxValue(5429503678976))
		.addIntegerOption(option =>
 		  option.setName('seeds_to_find')
 			.setDescription('How many seeds the bot should try to find before stopping')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10) )
		.addBooleanOption(option =>
			option.setName('runes_on')
			.setDescription('Look for seeds compatible with Forbidden Runes. Less SoU affects dungeon generation')
			.setRequired(false) )
		.addBooleanOption(option =>
			option.setName('show_consumables')
			.setDescription('Shows consumables. Forces the bot to attach report results as a file')
			.setRequired(false) )
    ,
	async execute(interaction) {

		//the number of concurrent processes is capped to not overload the host
		if (instances >= instanceCap){
			await interaction.reply({ content: 'Busy processing previous requests. Please wait for them to finish.', ephemeral: true });
			return;
		}

		//parsing options to normal variables for ease of use
		let floors =  interaction.options.getInteger('floors');
		let items = interaction.options.getString('items');
		//10x for floor 1, 2x for floors 2-4 and 1x for deeper floors
		let seedstoscan = (floors<=5) ? minSeedsToScan*2 : minSeedsToScan;
		if (floors == 1) seedstoscan = minSeedsToScan*10;
		let startingseed =  interaction.options.getInteger('starting_seed') ?? (Math.floor(Math.random() * (5429503678976-seedstoscan)));
		let seedsToFind = interaction.options.getInteger('seeds_to_find') ?? defaultSeedsToFind;
		let runesOn = interaction.options.getBoolean('runes_on') ?? false;
		let showConsumables = interaction.options.getBoolean('show_consumables') ?? false;

		//temporary
		floors++;
		floors--;

		let writetofile = (floors > 10) || showConsumables || seedsToFind > 1; //if the user is looking for 1 seed less than 10 floors, the output can fit in an embed without a file
		var startingTime = +new Date; //a timestamp of receiving the interaction, subtracted from ending timestamp to get execution time

		//establishing how to address the user
		var username = interaction.member.roles.cache.has(noPingRoleId) ? interaction.user.username : `<@${interaction.member.id}>`;
		//we use this to give the tip about long pressing on an embed to copy seed
		if (interaction.member.presence) userOnMobile = interaction.member.presence.clientStatus.mobile;

		//string of flags to pass to the process
		var spawnflags = "q";											//quiet mode enabled to only print seed codes to console
		if (runesOn) spawnflags += 'r';						//forbidden runes flag
		if (!showConsumables) spawnflags += 's';	//hide consumables unless specifically asked for
		if (!writetofile) spawnflags += 'c';			//if attaching a file is not necessary, enable compact mode

		//items with non-english symbols cannot possibly be found, so such inputs can be discarded
		//also only allows numbers 0-4: the only possible upgrade levels
		if (!items.match(/^[a-z0-4+',\- ]*$/i)) {
			await interaction.reply({ content: '<:surprise:1077978332798402570> Item names have to be accurate to their names in English in Shattered PD and upgrade levels can only be 0-4.', ephemeral: true });
			return;
		}

		//flags that get set during the iteration to discard broken inputs
		var maxupgradedrings = 0;
		var maxupgradedwands = 0;
		var startswithplus = false;
		var overUpgraded = false;
		var hasQuestItem = items.includes("corpse") || items.includes("dust") || items.includes("embers" || items.includes("rotberry"));

		//we iterate over every submitted item and runs checks on them
		//after which they're added to an array so they can be later joined with different separators as needed
		let itemlist = [];
		items.split(',').forEach(element => {
			let curItem = element.trim().toLowerCase(); //this makes the input case insensitive
			if (curItem.startsWith('+') && curItem.length > 2) startswithplus = true; //todo make misplaced upgrades automatically correct

			let splitbyupgrades = curItem.split("+"); //item name, upgrade level
			let upgradeLevel = splitbyupgrades.at(-1);
			if (curItem.includes("+")) curItem = (splitbyupgrades[0].trim() + " +" + splitbyupgrades[1]); //makes sure there's 1 space between the item name and level
			if (curItem.includes("0")) curItem = splitbyupgrades[0]; //inputs with +0 in them are treated as just unupgraded items

			itemlist.push(curItem);

			if (upgradeLevel > 2){
				//counting how many rings of high level we're looking for
				let isRing = false;
				for (let ringname of rings){
					if (curItem.includes(ringname)) {
						isRing = true;
						maxupgradedrings++;
						break;
					}
				};
				//counting how many wands of high level we're looking for
				for (let wandname of wands){
					if (curItem.includes(wandname)) {
						maxupgradedwands++;
						break;
					}
				};

				if (upgradeLevel > 3) overUpgraded = true; //could be merged with the line below but then it couldn't handle numbers over 4
				if ((upgradeLevel == 4) && isRing) overUpgraded = false; //rings can be +4 as imp reward

			}
		});

		//item upgrade level restriction
		if (overUpgraded){
			await interaction.reply({ content: `<:surprise:1077978332798402570> Rings are the only item that can be +4 as a reward from Imp. Others are limited to +3.`, ephemeral: true });
			return;
		}

		if (hasQuestItem && maxupgradedwands){
			await interaction.reply({ content: `<:surprise:1077978332798402570> You cannot get both a +3 wand and a Wandmaker quest item.`, ephemeral: true });
			return;
		}

		//it's only possible to get 1 ring of >+2 from imp and 1 wand of >+2 from wandmaker
		if (maxupgradedrings > 1){
			await interaction.reply({ content: `<:surprise:1077978332798402570> It's only possible to find one ring of +3 and above as a reward from Imp.`, ephemeral: true });
			return;
		}
		if (maxupgradedwands > 1){
			await interaction.reply({ content: `<:surprise:1077978332798402570> It's only possible to find one wand above +2 as a reward from the Wandmaker.`, ephemeral: true });
			return;
		}

		//wands and rings >+2 can only be obtained from their respective quests
		if (floors < 7 && maxupgradedwands){
			await interaction.reply({ content: `<:surprise:1077978332798402570> You can only get +3 wands from the Wandmaker, who spawns on depths 7-9.`, ephemeral: true });
			return;
		}
		if (floors < 7 && hasQuestItem){
			await interaction.reply({ content: `<:surprise:1077978332798402570> You can only get Wandmaker quest items on depths 7-9.`, ephemeral: true });
			return;
		}
		if (floors < 17 && maxupgradedrings){
			await interaction.reply({ content: `<:surprise:1077978332798402570> You can only get +3 and above rings from the Imp, who spawns on depths 17-19.`, ephemeral: true });
			return;
		}

		if (startswithplus){
			await interaction.reply({ content: '<:surprise:1077978332798402570> Sorry, the upgrade level has to be *after* the item name. For example: `shortsword +2` or `mail armor of affection +3`. ', ephemeral: true });
			return;
		}

		//finally acknowledging a valid request and assigning an output file to the instance
		instances++;
		let outputfile = `scanresults/out${instances}.txt`;
		console.log(`Request received. Using file ${outputfile}`);

		//initial confirmation, lets the user and discord know the bot isn't dead
		await interaction.reply({
			content:`<:examine:1077978273583202445> Looking for ${(seedsToFind > 1) ? (seedsToFind + " seeds") : ("a seed")} ${runesOn ? "__with Forbidden Runes on__ " : ""}up to depth ${floors} with items: ${itemlist.join(", ")}\n`,
			embeds: [{ description: `${freeInstanceTracker()}. Scanning: ${seedstoscan/1000}k. Starting at: ${startingseed}. Version: ${versionName}`, color: embedColor}]
		});

		//spawning a child process
		fs.writeFileSync('in.txt', itemlist.join('\n'));
		var child = spawn('java', ['-XX:+UnlockExperimentalVMOptions', '-XX:+EnableJVMCI', '-XX:-UseJVMCICompiler', '-jar', jarName, floors, 'all', 'in.txt', outputfile, startingseed, startingseed + seedstoscan, spawnflags]);
		//var child = spawn('./desktop-1.4.3', [floors, 'all', 'in.txt', outputfile, startingseed, startingseed + seedstoscan, 'q' + (runesOn ? "r" : "")]);
		const initialreply = await interaction.fetchReply(); //we fetch the reply here while the child thread is spawning to reply with results later

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
			//force stop when enough seeds are found
			if (foundseeds >= seedsToFind) {
				child.kill('SIGINT');
			}
		});

		//when seedfinder dies for any reason (code 0: finished scanning the seed range, 130: terminated after finding enough seeds)
		child.on('close', (code) => {
			let printAsCodeblock = ""
			if (!writetofile){
				try { const data = fs.readFileSync(outputfile, 'utf8'); printAsCodeblock = data; } catch (err) {console.error(err);}
			}
			console.log(`Request ${instances} completed. Exit code ${code}.`);
			instances--;

			let resultEmbedList = [];
			if (!writetofile) resultEmbedList = [{
				color: embedColor,
				title: seedlist[0],
				description: printAsCodeblock,
				fields: [{name: 'Version', value: versionName, inline: true}, {name: 'Items', value: itemlist.join(", "), inline: true}],
				footer: {text: `${freeInstanceTracker()}. ${executionTimeTracker(startingTime)}`}
			}]
			else resultEmbedList = [{
				description: `Request: ${itemlist.join(", ")} before floor ${floors}.`,
				color: embedColor,
				footer:{text:`${freeInstanceTracker()}. ${executionTimeTracker(startingTime)}. Version: ${versionName}`}
			}]

			if (foundseeds > 0) interaction.channel.send({
				content: `<:firepog:1077978284664561684> Done! Found ${foundseeds} matching seed${foundseeds > 1 ? "s" : ""} ${runesOn ? "(📜 **__FORBIDDEN RUNES ONLY__**) " : ""}by ${username}'s request: ${seedlist.join(", ")}.${(userOnMobile && !writetofile) ? " Long press the seed to copy it to clipboard!" : ""}`,
				files: writetofile ? [outputfile] : [],
				embeds: resultEmbedList
			});

			else if (code == 1) interaction.followUp({
				content: `<:grave:1077978773296791652> Oops! Seedfinder appears to have crashed. <@534750346309009428> <@534750346309009428> <@534750346309009428>\n*${freeInstanceTracker()}*`,
			})

			else initialreply.reply({
				content: `<:soiled:1077978326695678032> No seeds found by ${username}'s request. Did you spell the item names correctly? If yes, try running the same command again to scan more seeds.`,
				embeds: resultEmbedList
			});
		});

	},
};
