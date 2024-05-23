const { SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const { jarName, scanresultServer, errorEmoji } = require('../config.json');
let { versionName } = require('../config.json');
const lastRequestTracker = require('../utils/lastrequesttracker.js');
if (!versionName) versionName = jarName;
const fs = require('fs');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('scanseed')
		.setDescription('Generate a full report. Accepts numbers only. Use without seed to scan last result')
		.addIntegerOption(option =>
      option.setName('seed')
     .setDescription('Number of the seed to scan. Use -1 to scan a random seed.')
		 .setRequired(false)
     .setMinValue(-1)
		 .setMaxValue(5429503678976))
		 .addBooleanOption(option =>
			 option.setName('runes_on')
			 .setDescription('Enable Forbidden Runes.')
			 .setRequired(false) )
		 .addBooleanOption(option =>
				option.setName('darkness_on')
				.setDescription('Enable Into Darkness.')
				.setRequired(false) )
		 .addBooleanOption(option =>
			 option.setName('barren_on')
			 .setDescription('Enable Barren Lands.')
			 .setRequired(false) ),
		 async execute(interaction) {

			 let runesOn = interaction.options.getBoolean('runes_on') ?? false;
			 let barrenOn = interaction.options.getBoolean('barren_on') ?? false;
			 let darknessOn = interaction.options.getBoolean('darkness_on') ?? false;
			 var spawnflags = "-";											//quiet mode enabled to only print seed codes to console
			 if (runesOn) spawnflags += 'r';						//forbidden runes flag
			 if (barrenOn) spawnflags += 'b';						//barren lands flag
			 if (darknessOn) spawnflags += 'd';					//into darkness flag

			 var seedtoscan = interaction.options.getInteger('seed') ?? lastRequestTracker.getLastResult(interaction.member.id) ?? lastRequestTracker.getLastGlobalResult()  ?? null;

			 if (!seedtoscan){
				 interaction.reply(errorEmoji + " Couldn't find a previous finding result. Please use a seed number found in the beginning of each result.\nLetter seeds from the game are not usable on purpose. See FAQ for more details.");
				 return;
			 }

			 if (seedtoscan == -1) seedtoscan = Math.floor(Math.random() * 5429503678975);


			 let filename = "ShPD-" + versionName + "-" + seedtoscan + ".txt";
			 let outputfile = "scanresults/" + filename;
			 var child = spawn('java', ['-jar', jarName, "-mode", "scan", '-seed', seedtoscan, '-output', outputfile, spawnflags]);

			 child.on('close', (code) => {
				 interaction.reply({
					 content: `<:rocc:1077978311893983262> Detailed report for ${versionName} seed ${seedtoscan}${(runesOn | barrenOn | darknessOn) ? " __with some challenges on__" : ""}:${scanresultServer ? " [(view in browser)](http://ifritserv.zapto.org:18150/"+ filename +")" : ""}`,
					 files: [outputfile]
				 });
				 //FUCK it does NOT work. some timing issue
				 //fs.unlink( path.join(__dirname, "/../" + outputfile )  ,function(err){if(err) return console.log(err);});
			 });

		 },
};
